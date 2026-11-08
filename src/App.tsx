import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type {
  AuthUser,
  ClientTenant,
  FieldColSpan,
  FieldDropPosition,
  FieldType,
  FormField,
  FormIntegrationConfig,
  FormSchema,
  FormValues,
  IntegrationDeliveryLog,
  SubmissionRecord,
  SubmissionSettings,
} from './domain/form-schema/index.ts';
import {
  addField,
  buildCrmPayload,
  createInitialSchema,
  duplicateField,
  insertFieldAtTarget,
  moveField,
  removeField,
  removeIntegration,
  reorderField,
  updateField,
  updateSchemaMeta,
  updateSubmissionSettings,
  upsertIntegration,
} from './domain/form-schema/index.ts';
import { createFieldByType, getFieldCatalog } from './fields/index.ts';
import { BuilderCanvas, NewFieldModal } from './features/builder-canvas/index.ts';
import { toSnakeCase } from './shared/lib/index.ts';
import { FieldPalette } from './features/field-palette/index.ts';
import { FormRenderer } from './features/form-renderer/index.ts';
import { IntegrationsHub } from './features/integrations-hub/index.ts';
import { PropertyInspector } from './features/property-inspector/index.ts';
import { SchemaInspector } from './features/schema-io/index.ts';
import { SubmissionsLedger } from './features/submissions-ledger/index.ts';
import { MobileNavDrawer, SideNav } from './features/tenant-workspace/index.ts';
import { PublicFormRunner } from './features/public-runner/index.ts';
import { AuthPage, LoginModal } from './features/auth/index.ts';
import { clearStoredAuth, getStoredAuth, setStoredAuth } from './shared/lib/auth-storage.ts';
import { cn } from './shared/lib/cn.ts';
import { generateId } from './shared/lib/id.ts';
import { Button } from './shared/ui/button.tsx';
import { Input } from './shared/ui/input.tsx';
import { Kbd } from './shared/ui/kbd.tsx';
import { Skeleton } from './shared/ui/skeleton.tsx';

const STORAGE_KEY = 'fb_multi_tenant_v2';

type WorkspaceTab = 'build' | 'preview' | 'integrations' | 'submissions' | 'schema';

const SEED_CLIENTS: ClientTenant[] = [
  {
    id: 'client_acme',
    name: 'Acme Home Services',
    slug: 'acme',
    primaryDomain: 'forms.acmehomeservices.com',
    allowedDomains: ['forms.acmehomeservices.com', 'acmehomeservices.com'],
    industry: 'Home Services',
    status: 'active',
  },
  {
    id: 'client_apex',
    name: 'Apex B2B SaaS',
    slug: 'apex',
    primaryDomain: 'intake.apexcloud.io',
    allowedDomains: ['intake.apexcloud.io', 'app.apexcloud.io'],
    industry: 'B2B SaaS',
    status: 'active',
  },
  {
    id: 'client_elevate',
    name: 'Elevate MedSpa',
    slug: 'elevate',
    primaryDomain: 'book.elevatemedspa.com',
    allowedDomains: ['book.elevatemedspa.com', 'elevatemedspa.com'],
    industry: 'Healthcare & Wellness',
    status: 'active',
  },
];

const SEED_FORMS: FormSchema[] = [
  {
    id: 'form_acme_quote',
    clientId: 'client_acme',
    title: 'Service Quote & Dispatch Intake',
    slug: 'service-quote',
    customDomain: 'forms.acmehomeservices.com',
    status: 'published',
    description:
      'Fast, upfront dispatch quotes for residential heating, cooling, and plumbing emergency service.',
    settings: {
      submitButtonText: 'Request Instant Dispatch Quote',
      actionType: 'message',
      successTitle: 'Quote Request Received!',
      successMessage:
        'A certified dispatch technician is reviewing your service request and will call you within 15 minutes.',
    },
    fields: [
      {
        id: 'acme_sec_contact',
        type: 'section',
        label: '1. Customer Contact Information',
        subtitle: 'Where should we send your instant quote and technician dispatch alerts?',
        required: false,
        colSpan: 12,
        showDivider: true,
      },
      {
        id: 'acme_name',
        type: 'text',
        label: 'Full Name',
        required: true,
        placeholder: 'e.g. Sarah Jenkins',
        crmFieldKey: 'full_name',
        colSpan: 4,
      },
      {
        id: 'acme_email',
        type: 'email',
        label: 'Email Address',
        required: true,
        placeholder: 'sarah.jenkins@example.com',
        crmFieldKey: 'email',
        colSpan: 4,
      },
      {
        id: 'acme_phone',
        type: 'phone',
        label: 'Mobile Phone',
        required: true,
        placeholder: '(555) 234-5678',
        crmFieldKey: 'phone',
        helperText: 'We will text dispatch ETA and technician details to this number',
        colSpan: 4,
      },
      {
        id: 'acme_sec_service',
        type: 'section',
        label: '2. Service & Property Scope',
        subtitle: 'Select the required service type to customize your estimate.',
        required: false,
        colSpan: 12,
        showDivider: true,
      },
      {
        id: 'acme_service',
        type: 'select',
        label: 'Service Needed',
        required: true,
        placeholder: 'Select required home service...',
        crmFieldKey: 'service_type',
        colSpan: 6,
        options: [
          { label: 'HVAC Repair', value: 'HVAC Repair' },
          { label: 'Plumbing Emergency', value: 'Plumbing Emergency' },
          { label: 'Full Installation', value: 'Full Installation' },
        ],
      },
      {
        id: 'acme_date',
        type: 'date',
        label: 'Preferred Service Date',
        required: false,
        colSpan: 6,
        crmFieldKey: 'preferred_date',
      },
      {
        id: 'acme_budget',
        type: 'number',
        label: 'Estimated Budget ($)',
        required: false,
        placeholder: 'e.g. 8500',
        min: 500,
        max: 50000,
        step: 100,
        crmFieldKey: 'deal_value',
        colSpan: 12,
        helperText: 'Provide an estimated target budget for full system replacement',
        condition: {
          sourceFieldId: 'acme_service',
          operator: 'equals',
          value: 'Full Installation',
        },
      },
      {
        id: 'acme_utm',
        type: 'hidden',
        label: 'UTM Source',
        required: false,
        urlParamKey: 'utm_source',
        crmFieldKey: 'utm_source',
        defaultValue: 'direct',
      },
    ],
    integrations: [
      {
        id: 'int_ghl_acme',
        provider: 'ghl',
        name: 'GoHighLevel Lead Connector',
        enabled: true,
        endpointUrl: 'https://services.leadconnectorhq.com/hooks/custom-v2',
        targetResource: 'loc_acme_home_01',
        apiKeyMasked: 'ghl_live_••••••••••••8f2a',
        fieldMappings: [
          { formFieldId: 'acme_name', remoteFieldKey: 'full_name' },
          { formFieldId: 'acme_email', remoteFieldKey: 'email' },
          { formFieldId: 'acme_phone', remoteFieldKey: 'phone' },
          { formFieldId: 'acme_service', remoteFieldKey: 'service_type' },
          { formFieldId: 'acme_date', remoteFieldKey: 'preferred_date' },
          { formFieldId: 'acme_budget', remoteFieldKey: 'deal_value' },
          { formFieldId: 'acme_utm', remoteFieldKey: 'utm_source' },
        ],
      },
      {
        id: 'int_zoho_acme',
        provider: 'zoho',
        name: 'Zoho CRM Leads Module',
        enabled: true,
        endpointUrl: 'https://www.zohoapis.com/crm/v2/Leads',
        targetResource: 'Leads',
        apiKeyMasked: '1000.••••••••••••••••34a1',
        fieldMappings: [
          { formFieldId: 'acme_name', remoteFieldKey: 'Last_Name' },
          { formFieldId: 'acme_email', remoteFieldKey: 'Email' },
          { formFieldId: 'acme_phone', remoteFieldKey: 'Phone' },
          { formFieldId: 'acme_service', remoteFieldKey: 'Lead_Source_Detail' },
        ],
      },
      {
        id: 'int_airtable_acme',
        provider: 'airtable',
        name: 'Airtable Dispatch Base',
        enabled: true,
        endpointUrl: 'https://api.airtable.com/v0/appAcmeQuoteBase/tblDispatch',
        targetResource: 'tblDispatch',
        apiKeyMasked: 'pat_••••••••••••••••c8d9',
        fieldMappings: [
          { formFieldId: 'acme_name', remoteFieldKey: 'Client Name' },
          { formFieldId: 'acme_email', remoteFieldKey: 'Contact Email' },
          { formFieldId: 'acme_phone', remoteFieldKey: 'Direct Phone' },
          { formFieldId: 'acme_service', remoteFieldKey: 'Requested Service' },
          { formFieldId: 'acme_budget', remoteFieldKey: 'Estimated Budget' },
        ],
      },
    ],
  },
  {
    id: 'form_apex_demo',
    clientId: 'client_apex',
    title: 'Enterprise Demo & Qualification',
    slug: 'enterprise-demo',
    customDomain: 'intake.apexcloud.io',
    status: 'published',
    description:
      'Schedule a tailored architecture walkthrough and technical evaluation of Apex Cloud Platform.',
    settings: {
      submitButtonText: 'Schedule Engineering Walkthrough',
      actionType: 'message',
      successTitle: 'Demo Request Scheduled',
      successMessage:
        'Our solutions architecture team has received your technical brief and will reach out with a calendar link.',
    },
    fields: [
      {
        id: 'apex_name',
        type: 'text',
        label: 'Full Name',
        required: true,
        placeholder: 'e.g. David Lin',
        crmFieldKey: 'name',
        colSpan: 6,
      },
      {
        id: 'apex_email',
        type: 'email',
        label: 'Work Email',
        required: true,
        placeholder: 'david@enterprise.com',
        crmFieldKey: 'email',
        colSpan: 6,
      },
      {
        id: 'apex_company_size',
        type: 'radio',
        label: 'Company Size',
        required: true,
        crmFieldKey: 'company_size',
        options: [
          { label: '1 - 50 employees', value: '1-50' },
          { label: '51 - 250 employees', value: '51-250' },
          { label: '251 - 1000 employees', value: '251-1000' },
          { label: '1000+ employees', value: '1000+' },
        ],
      },
      {
        id: 'apex_notes',
        type: 'textarea',
        label: 'Project Notes & Architecture Needs',
        required: false,
        rows: 4,
        placeholder:
          'Tell us about your current stack, database scale, and high-availability requirements...',
        crmFieldKey: 'notes',
      },
      {
        id: 'apex_utm',
        type: 'hidden',
        label: 'UTM Campaign',
        required: false,
        urlParamKey: 'utm_source',
        crmFieldKey: 'utm_source',
        defaultValue: 'organic',
      },
    ],
    integrations: [
      {
        id: 'int_close_apex',
        provider: 'close',
        name: 'Close CRM Leads & Opportunities',
        enabled: true,
        endpointUrl: 'https://api.close.com/api/v1/lead/',
        targetResource: 'leads',
        apiKeyMasked: 'api_••••••••••••••••e3c1',
        fieldMappings: [
          { formFieldId: 'apex_name', remoteFieldKey: 'name' },
          { formFieldId: 'apex_email', remoteFieldKey: 'email' },
          { formFieldId: 'apex_company_size', remoteFieldKey: 'custom.cf_company_size' },
          { formFieldId: 'apex_notes', remoteFieldKey: 'description' },
        ],
      },
      {
        id: 'int_webhook_apex',
        provider: 'webhook',
        name: 'n8n Enterprise Router Webhook',
        enabled: true,
        endpointUrl: 'https://n8n.apexcloud.io/webhook/intake-leads',
        targetResource: 'POST /intake-leads',
        apiKeyMasked: 'whsec_••••••••••••••••49a2',
        fieldMappings: [
          { formFieldId: 'apex_name', remoteFieldKey: 'contact_name' },
          { formFieldId: 'apex_email', remoteFieldKey: 'work_email' },
          { formFieldId: 'apex_company_size', remoteFieldKey: 'org_size' },
          { formFieldId: 'apex_notes', remoteFieldKey: 'project_brief' },
          { formFieldId: 'apex_utm', remoteFieldKey: 'lead_source' },
        ],
      },
    ],
  },
  {
    id: 'form_elevate_consult',
    clientId: 'client_elevate',
    title: 'New Patient Consultation',
    slug: 'consultation',
    customDomain: 'book.elevatemedspa.com',
    status: 'published',
    description:
      'Schedule a personalized skincare & medical aesthetics consultation with Dr. Miller.',
    settings: {
      submitButtonText: 'Confirm Consultation Request',
      actionType: 'message',
      successTitle: 'Consultation Requested!',
      successMessage:
        'We have received your appointment request. Our clinical coordinator will call you to confirm your time slot.',
    },
    fields: [
      {
        id: 'elevate_name',
        type: 'text',
        label: 'Patient Full Name',
        required: true,
        placeholder: 'e.g. Jessica Sterling',
        crmFieldKey: 'patient_name',
      },
      {
        id: 'elevate_phone',
        type: 'phone',
        label: 'Cell Phone',
        required: true,
        placeholder: '(555) 890-1234',
        crmFieldKey: 'phone',
      },
      {
        id: 'elevate_date',
        type: 'date',
        label: 'Preferred Consultation Date',
        required: true,
        crmFieldKey: 'booking_date',
      },
      {
        id: 'elevate_consent',
        type: 'checkbox',
        label: 'HIPAA & Communications Consent',
        checkboxLabel:
          'I consent to receive SMS appointment notifications and agree to clinical policies.',
        required: true,
        defaultChecked: false,
        crmFieldKey: 'consent_confirmed',
      },
    ],
    integrations: [
      {
        id: 'int_ghl_elevate',
        provider: 'ghl',
        name: 'GoHighLevel MedSpa Pipeline',
        enabled: true,
        endpointUrl: 'https://services.leadconnectorhq.com/hooks/custom-v2',
        targetResource: 'loc_elevate_spa_99',
        apiKeyMasked: 'ghl_live_••••••••••••55b7',
        fieldMappings: [
          { formFieldId: 'elevate_name', remoteFieldKey: 'name' },
          { formFieldId: 'elevate_phone', remoteFieldKey: 'phone' },
          { formFieldId: 'elevate_date', remoteFieldKey: 'appointment_date' },
          { formFieldId: 'elevate_consent', remoteFieldKey: 'consent_confirmed' },
        ],
      },
    ],
  },
];

const SEED_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'sub_acme_sample_1',
    formId: 'form_acme_quote',
    formTitle: 'Service Quote & Dispatch Intake',
    clientId: 'client_acme',
    domain: 'forms.acmehomeservices.com',
    submittedAt: '2026-11-06T10:15:30.000Z',
    values: {
      acme_name: 'Marcus Vance',
      acme_email: 'marcus@vanceproperties.com',
      acme_phone: '(555) 349-8821',
      acme_service: 'Full Installation',
      acme_budget: '12500',
      acme_utm: 'google-cpc',
    },
    capturedUrlParams: {
      utm_source: 'google-cpc',
      utm_campaign: 'spring_hvac_promo',
      gclid: 'CjwKCAiA2SampleGclidToken',
    },
    deliveryLogs: [
      {
        integrationId: 'int_ghl_acme',
        provider: 'ghl',
        integrationName: 'GoHighLevel Lead Connector',
        status: 'delivered',
        statusCode: 200,
        payloadPreview: JSON.stringify(
          {
            full_name: 'Marcus Vance',
            email: 'marcus@vanceproperties.com',
            phone: '(555) 349-8821',
            service_type: 'Full Installation',
            deal_value: '12500',
            utm_source: 'google-cpc',
            _meta: {
              clientId: 'client_acme',
              formSlug: 'service-quote',
              domain: 'forms.acmehomeservices.com',
            },
          },
          null,
          2,
        ),
        responseMessage:
          '200 OK — Lead synced to Location loc_acme_home_01 (Contact ID: ghl_cnt_78912)',
        timestamp: '2026-11-06T10:15:31.200Z',
      },
      {
        integrationId: 'int_zoho_acme',
        provider: 'zoho',
        integrationName: 'Zoho CRM Leads Module',
        status: 'delivered',
        statusCode: 201,
        payloadPreview: JSON.stringify(
          {
            Last_Name: 'Marcus Vance',
            Email: 'marcus@vanceproperties.com',
            Phone: '(555) 349-8821',
            Lead_Source_Detail: 'Full Installation',
            _meta: {
              clientId: 'client_acme',
              formSlug: 'service-quote',
              domain: 'forms.acmehomeservices.com',
            },
          },
          null,
          2,
        ),
        responseMessage:
          '201 Created — Record created in Leads module (ID: 55490200001892019)',
        timestamp: '2026-11-06T10:15:31.850Z',
      },
      {
        integrationId: 'int_airtable_acme',
        provider: 'airtable',
        integrationName: 'Airtable Dispatch Base',
        status: 'failed',
        statusCode: 429,
        payloadPreview: JSON.stringify(
          {
            fields: {
              'Client Name': 'Marcus Vance',
              'Contact Email': 'marcus@vanceproperties.com',
              'Direct Phone': '(555) 349-8821',
              'Requested Service': 'Full Installation',
              'Estimated Budget': '12500',
            },
            _meta: {
              clientId: 'client_acme',
              formSlug: 'service-quote',
              domain: 'forms.acmehomeservices.com',
            },
          },
          null,
          2,
        ),
        responseMessage:
          '429 Too Many Requests — Airtable rate limit exceeded (5 requests/sec). Stored in D1 ledger for retry.',
        timestamp: '2026-11-06T10:15:32.400Z',
      },
    ],
  },
  {
    id: 'sub_apex_sample_1',
    formId: 'form_apex_demo',
    formTitle: 'Enterprise Demo & Qualification',
    clientId: 'client_apex',
    domain: 'intake.apexcloud.io',
    submittedAt: '2026-11-06T11:42:10.000Z',
    values: {
      apex_name: 'Elena Rostova',
      apex_email: 'elena.rostova@cloudscale.net',
      apex_company_size: '251-1000',
      apex_notes:
        'Evaluating multi-tenant database routing and automated failover for Q1 migration.',
      apex_utm: 'linkedin-sponsored',
    },
    capturedUrlParams: {
      utm_source: 'linkedin-sponsored',
      utm_medium: 'cpc',
      utm_campaign: 'enterprise_q4',
    },
    deliveryLogs: [
      {
        integrationId: 'int_close_apex',
        provider: 'close',
        integrationName: 'Close CRM Leads & Opportunities',
        status: 'delivered',
        statusCode: 200,
        payloadPreview: JSON.stringify(
          {
            name: 'Elena Rostova',
            email: 'elena.rostova@cloudscale.net',
            'custom.cf_company_size': '251-1000',
            description:
              'Evaluating multi-tenant database routing and automated failover for Q1 migration.',
            _meta: {
              clientId: 'client_apex',
              formSlug: 'enterprise-demo',
              domain: 'intake.apexcloud.io',
            },
          },
          null,
          2,
        ),
        responseMessage: '200 OK — Lead created (Lead ID: lead_9a7x81f0b)',
        timestamp: '2026-11-06T11:42:11.100Z',
      },
      {
        integrationId: 'int_webhook_apex',
        provider: 'webhook',
        integrationName: 'n8n Enterprise Router Webhook',
        status: 'delivered',
        statusCode: 200,
        payloadPreview: JSON.stringify(
          {
            contact_name: 'Elena Rostova',
            work_email: 'elena.rostova@cloudscale.net',
            org_size: '251-1000',
            project_brief:
              'Evaluating multi-tenant database routing and automated failover for Q1 migration.',
            lead_source: 'linkedin-sponsored',
            _meta: {
              clientId: 'client_apex',
              formSlug: 'enterprise-demo',
              domain: 'intake.apexcloud.io',
            },
          },
          null,
          2,
        ),
        responseMessage:
          '200 OK — Webhook accepted by n8n workflow wf_lead_dispatch_v2',
        timestamp: '2026-11-06T11:42:11.750Z',
      },
    ],
  },
];

interface PersistedState {
  version: 1 | 2;
  clients: ClientTenant[];
  forms: FormSchema[];
  submissions: SubmissionRecord[];
  activeClientId?: string;
  activeFormId?: string;
}

function loadInitialData(): {
  clients: ClientTenant[];
  forms: FormSchema[];
  submissions: SubmissionRecord[];
  activeClientId: string;
  activeFormId: string;
  hasCachedStorage: boolean;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (
        (parsed.version === 1 || parsed.version === 2) &&
        Array.isArray(parsed.clients) &&
        parsed.clients.length > 0 &&
        Array.isArray(parsed.forms) &&
        parsed.forms.length > 0 &&
        Array.isArray(parsed.submissions)
      ) {
        const activeClientId =
          parsed.activeClientId && parsed.clients.some((c) => c.id === parsed.activeClientId)
            ? parsed.activeClientId
            : parsed.clients[0].id;

        const clientForms = parsed.forms.filter((f) => f.clientId === activeClientId);
        const activeFormId =
          parsed.activeFormId && clientForms.some((f) => f.id === parsed.activeFormId)
            ? parsed.activeFormId
            : clientForms[0]?.id ?? parsed.forms[0].id;

        return {
          clients: parsed.clients,
          forms: parsed.forms,
          submissions: parsed.submissions,
          activeClientId,
          activeFormId,
          hasCachedStorage: true,
        };
      }
    }
  } catch {
    // If corrupted or SSR, fall back to seeds
  }

  return {
    clients: SEED_CLIENTS,
    forms: SEED_FORMS,
    submissions: SEED_SUBMISSIONS,
    activeClientId: SEED_CLIENTS[0].id,
    activeFormId: SEED_FORMS[0].id,
    hasCachedStorage: false,
  };
}

interface PendingFieldInsertion {
  field: FormField;
  type: FieldType;
  insertTarget?: {
    targetFieldId: string;
    position: FieldDropPosition;
  };
  index?: number;
}

export default function App(): ReactElement {
  const [storedAuth] = useState(() => getStoredAuth<AuthUser>());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(storedAuth.user);
  const [authToken, setAuthToken] = useState<string | null>(storedAuth.token);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [isSideNavCollapsed, setIsSideNavCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fb_sidenav_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('fb_sidenav_collapsed', String(isSideNavCollapsed));
    } catch {
      // Ignore
    }
  }, [isSideNavCollapsed]);

  const [pendingFieldInsertion, setPendingFieldInsertion] = useState<PendingFieldInsertion | null>(null);

  const [userRole, setUserRole] = useState<'agency_admin' | 'client_editor'>(() => {
    if (storedAuth.user?.role === 'client_editor') {
      return 'client_editor';
    }
    return 'agency_admin';
  });

  const [initialData] = useState(() => {
    const data = loadInitialData();
    if (
      storedAuth.user?.role === 'client_editor' &&
      storedAuth.user.clientId &&
      data.clients.some((c) => c.id === storedAuth.user?.clientId)
    ) {
      data.activeClientId = storedAuth.user.clientId;
      const clientForms = data.forms.filter((f) => f.clientId === storedAuth.user?.clientId);
      if (clientForms.length > 0 && !clientForms.some((f) => f.id === data.activeFormId)) {
        data.activeFormId = clientForms[0].id;
      }
    }
    return data;
  });

  const [clients, setClients] = useState<ClientTenant[]>(initialData.clients);
  const [activeClientId, setActiveClientId] = useState<string>(initialData.activeClientId);

  const [forms, setForms] = useState<FormSchema[]>(initialData.forms);
  const [activeFormId, setActiveFormId] = useState<string>(initialData.activeFormId);

  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(initialData.submissions);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('build');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [mobileStudioPane, setMobileStudioPane] = useState<'canvas' | 'palette' | 'inspector'>('canvas');

  // AST Undo / Redo history tracking keyed by formId
  const [historyPast, setHistoryPast] = useState<Record<string, FormSchema[]>>({});
  const [historyFuture, setHistoryFuture] = useState<Record<string, FormSchema[]>>({});

  // Public Client View Mode
  const [isPublicView, setIsPublicView] = useState<boolean>(false);
  const [isEmbedPreview, setIsEmbedPreview] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<'url' | 'iframe' | null>(null);

  // Backend Sync State (Cloudflare Worker + D1 SQLite)
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'connected' | 'local_fallback'>('connecting');
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const hasBootstrappedRef = useRef<boolean>(false);
  const lastSavedSchemasRef = useRef<Record<string, string>>({});

  const refetchBootstrap = async (token?: string | null): Promise<void> => {
    const activeToken = token !== undefined ? token : authToken;
    try {
      const headers: Record<string, string> = activeToken
        ? { Authorization: `Bearer ${activeToken}` }
        : {};

      const res = await fetch('/api/workspace/bootstrap', { headers });
      if (!res.ok) {
        setBackendStatus('local_fallback');
        return;
      }

      const data = (await res.json()) as {
        clients?: ClientTenant[];
        forms?: FormSchema[];
        submissions?: SubmissionRecord[];
        authUser?: AuthUser | null;
      };

      if (data.authUser) {
        setCurrentUser(data.authUser);
        setStoredAuth(activeToken || '', data.authUser);
        if (data.authUser.role === 'client_editor') {
          setUserRole('client_editor');
          if (data.authUser.clientId) {
            setActiveClientId(data.authUser.clientId);
          }
        }
      }

      if (
        Array.isArray(data.clients) &&
        data.clients.length > 0 &&
        Array.isArray(data.forms) &&
        data.forms.length > 0
      ) {
        const fetchedClients = data.clients;
        const fetchedForms = data.forms;
        const fetchedSubmissions = Array.isArray(data.submissions) ? data.submissions : [];

        // Determine target client ID
        let nextClientId = fetchedClients[0].id;
        if (data.authUser?.role === 'client_editor' && data.authUser.clientId) {
          nextClientId = data.authUser.clientId;
        } else {
          setActiveClientId((prevCid) => {
            if (fetchedClients.some((c) => c.id === prevCid)) {
              nextClientId = prevCid;
              return prevCid;
            }
            return nextClientId;
          });
        }

        const clientFormsList = fetchedForms.filter((f) => f.clientId === nextClientId);
        const nextForm = clientFormsList[0] ?? fetchedForms[0];

        const formMap: Record<string, string> = {};
        for (const f of fetchedForms) {
          formMap[f.id] = JSON.stringify(f);
        }
        lastSavedSchemasRef.current = formMap;

        setClients(fetchedClients);
        setForms(fetchedForms);
        setSubmissions(fetchedSubmissions);
        setActiveClientId(nextClientId);
        setActiveFormId((prevFid) => {
          if (clientFormsList.some((f) => f.id === prevFid)) {
            return prevFid;
          }
          return nextForm.id;
        });

        hasBootstrappedRef.current = true;
        setBackendStatus('connected');
      } else {
        hasBootstrappedRef.current = true;
        setBackendStatus('local_fallback');
      }
    } catch {
      hasBootstrappedRef.current = true;
      setBackendStatus('local_fallback');
    }
  };

  // Bootstrap data from backend GET /api/workspace/bootstrap on mount
  useEffect(() => {
    let isMounted = true;

    const bootstrapBackend = async (): Promise<void> => {
      try {
        const headers: Record<string, string> = authToken
          ? { Authorization: `Bearer ${authToken}` }
          : {};
        const res = await fetch('/api/workspace/bootstrap', { headers });
        if (!res.ok) {
          if (isMounted) {
            hasBootstrappedRef.current = true;
            setBackendStatus('local_fallback');
          }
          return;
        }

        const data = (await res.json()) as {
          clients?: ClientTenant[];
          forms?: FormSchema[];
          submissions?: SubmissionRecord[];
          authUser?: AuthUser | null;
        };

        if (isMounted && data.authUser) {
          setCurrentUser(data.authUser);
          setStoredAuth(authToken || '', data.authUser);
          if (data.authUser.role === 'client_editor') {
            setUserRole('client_editor');
            if (data.authUser.clientId) {
              setActiveClientId(data.authUser.clientId);
            }
          }
        }

        if (
          isMounted &&
          Array.isArray(data.clients) &&
          data.clients.length > 0 &&
          Array.isArray(data.forms) &&
          data.forms.length > 0
        ) {
          const fetchedClients = data.clients;
          const fetchedForms = data.forms;
          const fetchedSubmissions = Array.isArray(data.submissions) ? data.submissions : [];

          // Keep activeClientId and activeFormId valid
          const preferredClientId =
            data.authUser?.role === 'client_editor' && data.authUser.clientId
              ? data.authUser.clientId
              : initialData.activeClientId;

          const nextClientId = fetchedClients.some((c) => c.id === preferredClientId)
            ? preferredClientId
            : fetchedClients[0].id;
          const clientFormsList = fetchedForms.filter((f) => f.clientId === nextClientId);
          const nextForm =
            clientFormsList.find((f) => f.id === initialData.activeFormId) ??
            clientFormsList[0] ??
            fetchedForms[0];

          const formMap: Record<string, string> = {};
          for (const f of fetchedForms) {
            formMap[f.id] = JSON.stringify(f);
          }
          lastSavedSchemasRef.current = formMap;

          setClients(fetchedClients);
          setForms(fetchedForms);
          setSubmissions(fetchedSubmissions);
          setActiveClientId(nextClientId);
          setActiveFormId(nextForm.id);

          hasBootstrappedRef.current = true;
          setBackendStatus('connected');
        } else if (isMounted) {
          hasBootstrappedRef.current = true;
          setBackendStatus('local_fallback');
        }
      } catch {
        if (isMounted) {
          hasBootstrappedRef.current = true;
          setBackendStatus('local_fallback');
        }
      }
    };

    void bootstrapBackend();
    return () => {
      isMounted = false;
    };
  }, [authToken, initialData.activeClientId, initialData.activeFormId]);

  // Sync state to localStorage
  useEffect(() => {
    try {
      const payload: PersistedState = {
        version: 2,
        clients,
        forms,
        submissions,
        activeClientId,
        activeFormId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors in restricted environments
    }
  }, [clients, forms, submissions, activeClientId, activeFormId]);

  // Derived tenant state
  const activeClient = clients.find((c) => c.id === activeClientId) ?? clients[0];
  const clientForms = forms.filter((f) => f.clientId === activeClient.id);
  const activeSchema =
    forms.find((f) => f.id === activeFormId && f.clientId === activeClient.id) ??
    clientForms[0] ??
    forms[0];

  // Debounced Auto-Save of Form Schema Changes to PUT /api/forms/:id
  useEffect(() => {
    if (!hasBootstrappedRef.current || backendStatus !== 'connected' || !activeSchema) {
      return;
    }

    const currentPayload = JSON.stringify(activeSchema);
    if (!lastSavedSchemasRef.current[activeSchema.id]) {
      lastSavedSchemasRef.current[activeSchema.id] = currentPayload;
      return;
    }

    if (lastSavedSchemasRef.current[activeSchema.id] === currentPayload) {
      return;
    }

    setSyncState('saving');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/forms/${encodeURIComponent(activeSchema.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: currentPayload,
        });

        if (res.ok) {
          lastSavedSchemasRef.current[activeSchema.id] = currentPayload;
          setSyncState('saved');
          setSyncError(null);
        } else {
          setSyncState('idle');
          setSyncError(
            `Auto-save failed: Cloudflare D1 returned HTTP ${res.status}. Form changes may not be persisted.`,
          );
        }
      } catch (err) {
        setSyncState('idle');
        setSyncError(
          `Auto-save failed (${err instanceof Error ? err.message : 'network error'}). Form changes may not be persisted.`,
        );
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [activeSchema, backendStatus]);

  // Reset 'saved' syncState back to 'idle' after 3 seconds
  useEffect(() => {
    if (syncState === 'saved') {
      const timer = setTimeout(() => {
        setSyncState('idle');
      }, 3000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [syncState]);

  // Helper to update active schema immutably with AST history push
  const updateActiveSchema = (updater: (prev: FormSchema) => FormSchema): void => {
    if (!activeSchema) return;
    const current = activeSchema;
    const next = updater(current);
    if (next === current) return;

    setHistoryPast((prev) => ({
      ...prev,
      [current.id]: [...(prev[current.id] ?? []).slice(-49), current],
    }));
    setHistoryFuture((prev) => ({
      ...prev,
      [current.id]: [],
    }));
    setForms((prev) => prev.map((f) => (f.id === current.id ? next : f)));
  };

  // AST Undo / Redo handlers
  const handleUndo = useCallback((): void => {
    if (!activeSchema) return;
    const pastList = historyPast[activeSchema.id] ?? [];
    if (pastList.length === 0) return;

    const previousSchema = pastList[pastList.length - 1];
    const newPast = pastList.slice(0, -1);
    const futureList = historyFuture[activeSchema.id] ?? [];
    const newFuture = [activeSchema, ...futureList.slice(0, 49)];

    setHistoryPast((prev) => ({
      ...prev,
      [activeSchema.id]: newPast,
    }));
    setHistoryFuture((prev) => ({
      ...prev,
      [activeSchema.id]: newFuture,
    }));
    setForms((prev) => prev.map((f) => (f.id === activeSchema.id ? previousSchema : f)));
    setSelectedFieldId(null);
  }, [activeSchema, historyPast, historyFuture]);

  const handleRedo = useCallback((): void => {
    if (!activeSchema) return;
    const futureList = historyFuture[activeSchema.id] ?? [];
    if (futureList.length === 0) return;

    const nextSchema = futureList[0];
    const newFuture = futureList.slice(1);
    const pastList = historyPast[activeSchema.id] ?? [];
    const newPast = [...pastList.slice(-49), activeSchema];

    setHistoryFuture((prev) => ({
      ...prev,
      [activeSchema.id]: newFuture,
    }));
    setHistoryPast((prev) => ({
      ...prev,
      [activeSchema.id]: newPast,
    }));
    setForms((prev) => prev.map((f) => (f.id === activeSchema.id ? nextSchema : f)));
    setSelectedFieldId(null);
  }, [activeSchema, historyPast, historyFuture]);

  // Keyboard shortcut listener for Cmd/Ctrl + Z, Cmd/Ctrl + Shift + Z, and Escape key for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (pendingFieldInsertion) {
          setPendingFieldInsertion(null);
          return;
        }
        if (isShareModalOpen) {
          setIsShareModalOpen(false);
          return;
        }
        if (isLoginModalOpen) {
          setIsLoginModalOpen(false);
          return;
        }
      }

      if (activeTab !== 'build' || isPublicView) return;

      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          (activeEl as HTMLElement).isContentEditable
        ) {
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (key === 'y') {
          e.preventDefault();
          handleRedo();
        } else if (key === 'b') {
          e.preventDefault();
          setIsSideNavCollapsed((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, isPublicView, handleRedo, handleUndo, isShareModalOpen, isLoginModalOpen, pendingFieldInsertion]);

  // Role toggle handler with client-lock enforcement
  const handleToggleUserRole = (nextRole: 'agency_admin' | 'client_editor'): void => {
    if (currentUser?.role === 'client_editor') {
      // Client editors are strictly locked to Client Portal
      return;
    }
    setUserRole(nextRole);
  };

  // Login success handler
  const handleLoginSuccess = (user: AuthUser, token: string): void => {
    setCurrentUser(user);
    setAuthToken(token);
    setStoredAuth(token, user);
    setIsLoginModalOpen(false);

    if (user.role === 'client_editor' && user.clientId) {
      setUserRole('client_editor');
      setActiveClientId(user.clientId);
      const targetForms = forms.filter((f) => f.clientId === user.clientId);
      if (targetForms.length > 0) {
        setActiveFormId(targetForms[0].id);
      }
    } else {
      setUserRole('agency_admin');
    }

    void refetchBootstrap(token);
  };

  // Logout handler
  const handleLogout = (): void => {
    clearStoredAuth();
    setCurrentUser(null);
    setAuthToken(null);
    setUserRole('agency_admin');
    void fetch('/api/auth/logout', { method: 'POST' });
    void refetchBootstrap(null);
    setIsLoginModalOpen(false);
  };

  // Switch client handler
  const handleSelectClient = (clientId: string): void => {
    if (currentUser?.role === 'client_editor' && currentUser.clientId && currentUser.clientId !== clientId) {
      return;
    }
    setActiveClientId(clientId);
    const targetForms = forms.filter((f) => f.clientId === clientId);
    if (targetForms.length > 0) {
      setActiveFormId(targetForms[0].id);
    } else {
      const prevClients = clients;
      const prevForms = forms;
      const prevActiveClientId = activeClientId;
      const prevActiveFormId = activeFormId;

      const targetClient = clients.find((c) => c.id === clientId);
      const newForm = {
        ...createInitialSchema(clientId, targetClient?.primaryDomain || 'forms.example.com'),
        title: `${targetClient?.name || 'Client'} Intake`,
      };
      lastSavedSchemasRef.current[newForm.id] = JSON.stringify(newForm);
      setForms((prev) => [...prev, newForm]);
      setActiveFormId(newForm.id);
      setSyncError(null);

      if (backendStatus === 'connected') {
        void (async () => {
          try {
            const res = await fetch(`/api/forms/${encodeURIComponent(newForm.id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newForm),
            });
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
          } catch (err) {
            console.error('Failed to sync new form to backend:', err);
            delete lastSavedSchemasRef.current[newForm.id];
            setClients(prevClients);
            setForms(prevForms);
            setActiveClientId(prevActiveClientId);
            setActiveFormId(prevActiveFormId);
            setSyncError(
              `Failed to sync initial form for client in Cloudflare D1 (${err instanceof Error ? err.message : 'network error'}). Rolled back changes.`,
            );
          }
        })();
      }
    }
    setSelectedFieldId(null);
  };

  // Switch form handler
  const handleSelectForm = (formId: string): void => {
    setActiveFormId(formId);
    setSelectedFieldId(null);
  };

  // Create new client handler
  const handleCreateClient = (newClientData: Omit<ClientTenant, 'id'>): void => {
    const prevClients = clients;
    const prevForms = forms;
    const prevActiveClientId = activeClientId;
    const prevActiveFormId = activeFormId;

    const newClientId = `client_${newClientData.slug || generateId('tenant')}`;
    const newClient: ClientTenant = {
      ...newClientData,
      id: newClientId,
    };
    const newForm: FormSchema = {
      ...createInitialSchema(newClientId, newClient.primaryDomain),
      title: `${newClient.name} Intake Form`,
      slug: 'intake',
    };
    lastSavedSchemasRef.current[newForm.id] = JSON.stringify(newForm);
    setClients((prev) => [...prev, newClient]);
    setForms((prev) => [...prev, newForm]);
    setActiveClientId(newClientId);
    setActiveFormId(newForm.id);
    setSelectedFieldId(null);
    setSyncError(null);

    if (backendStatus === 'connected') {
      void (async () => {
        try {
          const clientRes = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newClient),
          });
          if (!clientRes.ok) {
            throw new Error(`HTTP ${clientRes.status}`);
          }
          const formRes = await fetch(`/api/forms/${encodeURIComponent(newForm.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newForm),
          });
          if (!formRes.ok) {
            throw new Error(`HTTP ${formRes.status}`);
          }
        } catch (err) {
          console.error('Failed to sync new client to backend:', err);
          delete lastSavedSchemasRef.current[newForm.id];
          setClients(prevClients);
          setForms(prevForms);
          setActiveClientId(prevActiveClientId);
          setActiveFormId(prevActiveFormId);
          setSyncError(
            `Failed to create client "${newClient.name}" in Cloudflare D1 (${err instanceof Error ? err.message : 'network error'}). Rolled back changes.`,
          );
        }
      })();
    }
  };

  // Create new form for active client
  const handleCreateForm = (): void => {
    const prevForms = forms;
    const prevActiveFormId = activeFormId;

    const count = clientForms.length + 1;
    const newForm: FormSchema = {
      ...createInitialSchema(activeClient.id, activeClient.primaryDomain),
      id: generateId('form'),
      title: `${activeClient.name} Form ${count}`,
      slug: `form-${count}`,
    };
    lastSavedSchemasRef.current[newForm.id] = JSON.stringify(newForm);
    setForms((prev) => [...prev, newForm]);
    setActiveFormId(newForm.id);
    setSelectedFieldId(null);
    setSyncError(null);

    if (backendStatus === 'connected') {
      void (async () => {
        try {
          const res = await fetch(`/api/forms/${encodeURIComponent(newForm.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newForm),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch (err) {
          console.error('Failed to sync new form to backend:', err);
          delete lastSavedSchemasRef.current[newForm.id];
          setForms(prevForms);
          setActiveFormId(prevActiveFormId);
          setSyncError(
            `Failed to create form "${newForm.title}" in Cloudflare D1 (${err instanceof Error ? err.message : 'network error'}). Rolled back changes.`,
          );
        }
      })();
    }
  };

  // Reset all demo data to factory defaults
  const handleResetDemoData = (): void => {
    if (window.confirm('Reset all clients, schemas, and submission records to factory seeds?')) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
      setClients(SEED_CLIENTS);
      setForms(SEED_FORMS);
      setSubmissions(SEED_SUBMISSIONS);
      setHistoryPast({});
      setHistoryFuture({});
      setActiveClientId(SEED_CLIENTS[0].id);
      setActiveFormId(SEED_FORMS[0].id);
      setSelectedFieldId(null);
      setActiveTab('build');
      setIsPublicView(false);

      const formMap: Record<string, string> = {};
      for (const f of SEED_FORMS) {
        formMap[f.id] = JSON.stringify(f);
      }
      lastSavedSchemasRef.current = formMap;

      if (backendStatus === 'connected') {
        void (async () => {
          try {
            const resetRes = await fetch('/api/workspace/reset', { method: 'POST' });
            if (resetRes.ok) {
              const bootstrapRes = await fetch('/api/workspace/bootstrap');
              if (bootstrapRes.ok) {
                const data = (await bootstrapRes.json()) as {
                  clients?: ClientTenant[];
                  forms?: FormSchema[];
                  submissions?: SubmissionRecord[];
                };
                if (
                  Array.isArray(data.clients) &&
                  data.clients.length > 0 &&
                  Array.isArray(data.forms) &&
                  data.forms.length > 0
                ) {
                  setClients(data.clients);
                  setForms(data.forms);
                  if (Array.isArray(data.submissions)) {
                    setSubmissions(data.submissions);
                  }
                  setActiveClientId(data.clients[0].id);
                  setActiveFormId(data.forms[0].id);

                  const nextMap: Record<string, string> = {};
                  for (const f of data.forms) {
                    nextMap[f.id] = JSON.stringify(f);
                  }
                  lastSavedSchemasRef.current = nextMap;
                }
              }
            } else {
              for (const c of SEED_CLIENTS) {
                await fetch('/api/clients', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(c),
                });
              }
              for (const f of SEED_FORMS) {
                await fetch(`/api/forms/${encodeURIComponent(f.id)}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(f),
                });
              }
            }
          } catch (err) {
            console.error('Failed to reset backend data:', err);
          }
        })();
      }
    }
  };

  // Field manipulation handlers
  const handleAddField = (type: FieldType, index?: number, colSpan?: FieldColSpan): void => {
    const defaultField = createFieldByType(type);
    const autoKey = toSnakeCase(defaultField.label) || type;
    const finalField: FormField = {
      ...defaultField,
      ...(colSpan ? { colSpan } : {}),
      crmFieldKey: defaultField.crmFieldKey || autoKey,
    };
    updateActiveSchema((prev) => addField(prev, finalField, index));
    setSelectedFieldId(finalField.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileStudioPane('canvas');
    }
  };

  const handleInsertFieldAtTarget = (
    type: FieldType,
    targetFieldId: string,
    position: FieldDropPosition,
  ): void => {
    const defaultField = createFieldByType(type);
    const autoKey = toSnakeCase(defaultField.label) || type;
    const finalField: FormField = {
      ...defaultField,
      crmFieldKey: defaultField.crmFieldKey || autoKey,
    };
    updateActiveSchema((prev) =>
      insertFieldAtTarget(prev, finalField, targetFieldId, position),
    );
    setSelectedFieldId(finalField.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileStudioPane('canvas');
    }
  };

  const handleConfirmNewField = (label: string, webhookKey: string): void => {
    if (!pendingFieldInsertion) return;

    const { field, insertTarget, index } = pendingFieldInsertion;
    const finalField: FormField = {
      ...field,
      label,
      crmFieldKey: webhookKey || toSnakeCase(label) || undefined,
      ...(field.type === 'checkbox' ? { checkboxLabel: label } : {}),
    };

    if (insertTarget) {
      updateActiveSchema((prev) =>
        insertFieldAtTarget(prev, finalField, insertTarget.targetFieldId, insertTarget.position),
      );
    } else {
      updateActiveSchema((prev) => addField(prev, finalField, index));
    }

    setSelectedFieldId(finalField.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileStudioPane('canvas');
    }
    setPendingFieldInsertion(null);
  };

  const handleCancelNewField = (): void => {
    setPendingFieldInsertion(null);
  };

  const handleReorderField = (
    sourceFieldId: string,
    targetFieldId: string,
    position: FieldDropPosition = 'before',
  ): void => {
    updateActiveSchema((prev) => reorderField(prev, sourceFieldId, targetFieldId, position));
    setSelectedFieldId(sourceFieldId);
  };

  const handleAddRowPreset = (preset: '2-col' | '3-col' | 'section'): void => {
    if (preset === 'section') {
      const f = createFieldByType('section');
      const sectionField: FormField = f.type === 'section' ? { ...f, colSpan: 12 } : f;
      updateActiveSchema((prev) => addField(prev, sectionField));
      setSelectedFieldId(sectionField.id);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileStudioPane('canvas');
      }
      return;
    }

    if (preset === '2-col') {
      const f1 = createFieldByType('text');
      const f2 = createFieldByType('text');
      const field1: FormField =
        f1.type === 'text'
          ? { ...f1, label: 'First Name', placeholder: 'e.g. Jane', colSpan: 6 }
          : f1;
      const field2: FormField =
        f2.type === 'text'
          ? { ...f2, label: 'Last Name', placeholder: 'e.g. Doe', colSpan: 6 }
          : f2;

      updateActiveSchema((prev) => {
        const s1 = addField(prev, field1);
        return addField(s1, field2);
      });
      setSelectedFieldId(field1.id);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileStudioPane('canvas');
      }
      return;
    }

    if (preset === '3-col') {
      const f1 = createFieldByType('text');
      const f2 = createFieldByType('text');
      const f3 = createFieldByType('text');
      const field1: FormField =
        f1.type === 'text'
          ? { ...f1, label: 'City', placeholder: 'e.g. San Francisco', colSpan: 4 }
          : f1;
      const field2: FormField =
        f2.type === 'text'
          ? { ...f2, label: 'State / Province', placeholder: 'e.g. CA', colSpan: 4 }
          : f2;
      const field3: FormField =
        f3.type === 'text'
          ? { ...f3, label: 'Postal Code', placeholder: 'e.g. 94103', colSpan: 4 }
          : f3;

      updateActiveSchema((prev) => {
        const s1 = addField(prev, field1);
        const s2 = addField(s1, field2);
        return addField(s2, field3);
      });
      setSelectedFieldId(field1.id);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileStudioPane('canvas');
      }
      return;
    }
  };

  const handleRemoveField = (fieldId: string): void => {
    updateActiveSchema((prev) => removeField(prev, fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileStudioPane('canvas');
      }
    }
  };

  const handleUpdateField = (updatedField: FormField): void => {
    updateActiveSchema((prev) => updateField(prev, updatedField.id, () => updatedField));
  };

  const handleMoveField = (fieldId: string, direction: 'up' | 'down'): void => {
    updateActiveSchema((prev) => moveField(prev, fieldId, direction));
  };

  const handleDuplicateField = (fieldId: string): void => {
    if (!activeSchema) return;
    const result = duplicateField(activeSchema, fieldId);
    if (result.newFieldId) {
      updateActiveSchema(() => result.schema);
      setSelectedFieldId(result.newFieldId);
    }
  };

  const handleUpdateSchemaMeta = (
    patch: Partial<
      Pick<FormSchema, 'title' | 'description' | 'slug' | 'customDomain' | 'status' | 'clientId'>
    >,
  ): void => {
    updateActiveSchema((prev) => updateSchemaMeta(prev, patch));
  };

  const handleUpdateSubmissionSettings = (patch: Partial<SubmissionSettings>): void => {
    updateActiveSchema((prev) => updateSubmissionSettings(prev, patch));
  };

  const handleUpsertIntegration = (integration: FormIntegrationConfig): void => {
    updateActiveSchema((prev) => upsertIntegration(prev, integration));
  };

  const handleRemoveIntegration = (integrationId: string): void => {
    updateActiveSchema((prev) => removeIntegration(prev, integrationId));
  };

  const handleReplaceSchema = (nextSchema: FormSchema): void => {
    updateActiveSchema(() => nextSchema);
    setSelectedFieldId(null);
  };

  const handleResetSchema = (): void => {
    if (!activeClient) return;
    const fresh = createInitialSchema(activeClient.id, activeClient.primaryDomain);
    fresh.id = activeSchema.id;
    fresh.title = activeSchema.title;
    fresh.slug = activeSchema.slug;
    updateActiveSchema(() => fresh);
    setSelectedFieldId(null);
  };

  // Store-and-Forward submission handler
  const handleRecordSubmission = (
    values: FormValues,
    urlParams: Record<string, string>,
  ): SubmissionRecord | null => {
    if (!activeSchema) return null;

    const now = new Date().toISOString();
    const submissionId = generateId('sub');
    const enabledIntegrations = (activeSchema.integrations || []).filter((i) => i.enabled);

    const deliveryLogs: IntegrationDeliveryLog[] = enabledIntegrations.map((integration) => {
      const payload = buildCrmPayload(activeSchema, integration, values, urlParams);
      return {
        integrationId: integration.id,
        provider: integration.provider,
        integrationName: integration.name,
        status: 'delivered',
        statusCode: 200,
        payloadPreview: JSON.stringify(payload, null, 2),
        responseMessage: `200 OK — Committed to Cloudflare D1 & forwarded to ${integration.name}`,
        timestamp: now,
      };
    });

    const newRecord: SubmissionRecord = {
      id: submissionId,
      formId: activeSchema.id,
      formTitle: activeSchema.title,
      clientId: activeSchema.clientId,
      domain: activeSchema.customDomain,
      submittedAt: now,
      values,
      capturedUrlParams: urlParams,
      deliveryLogs,
    };

    setSubmissions((prev) => [newRecord, ...prev]);
    setSyncError(null);

    if (backendStatus === 'connected') {
      void (async () => {
        try {
          const res = await fetch('/api/public/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              formId: activeSchema.id,
              clientId: activeSchema.clientId,
              domain: activeSchema.customDomain,
              values,
              urlParams,
            }),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const data = (await res.json()) as {
            ok?: boolean;
            success?: boolean;
            submission?: SubmissionRecord;
            submissionId?: string;
            submittedAt?: string;
          };
          if (data.submission) {
            setSubmissions((prev) =>
              prev.map((s) => (s.id === newRecord.id ? data.submission! : s)),
            );
          } else if (data.submissionId) {
            setSubmissions((prev) =>
              prev.map((s) => {
                if (s.id !== newRecord.id) return s;
                return {
                  ...s,
                  id: data.submissionId ?? s.id,
                  submittedAt: data.submittedAt ?? s.submittedAt,
                };
              }),
            );
          }
        } catch (err) {
          console.error('Failed to submit form to backend:', err);
          setSyncError(
            `Failed to sync submission to Cloudflare D1 (${err instanceof Error ? err.message : 'network error'}). Form values were saved locally in browser memory.`,
          );
        }
      })();
    }

    return newRecord;
  };

  // Retry failed delivery log handler
  const handleRetrySubmission = (submissionId: string): void => {
    const prevSubmissions = submissions;

    setSubmissions((prev) =>
      prev.map((sub) => {
        if (sub.id !== submissionId) return sub;
        const updatedLogs: IntegrationDeliveryLog[] = sub.deliveryLogs.map((log) => {
          if (log.status === 'failed') {
            return {
              ...log,
              status: 'delivered',
              statusCode: 200,
              responseMessage: '200 OK — Retried & accepted by CRM endpoint',
              timestamp: new Date().toISOString(),
            };
          }
          return log;
        });
        return {
          ...sub,
          deliveryLogs: updatedLogs,
        };
      }),
    );
    setSyncError(null);

    if (backendStatus === 'connected') {
      void (async () => {
        try {
          const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/retry`, {
            method: 'POST',
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch (err) {
          console.error('Failed to retry submission on backend:', err);
          setSubmissions(prevSubmissions);
          setSyncError(
            `Failed to retry submission in Cloudflare D1 (${err instanceof Error ? err.message : 'network error'}). Rolled back status.`,
          );
        }
      })();
    }
  };

  // Clear submissions for active client
  const handleClearSubmissions = (): void => {
    const prevSubmissions = submissions;
    setSubmissions((prev) => prev.filter((s) => s.clientId !== activeClient.id));
    setSyncError(null);

    if (backendStatus === 'connected') {
      void (async () => {
        try {
          const res = await fetch(`/api/submissions?clientId=${encodeURIComponent(activeClient.id)}`, {
            method: 'DELETE',
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch (err) {
          console.error('Failed to clear submissions on backend:', err);
          setSubmissions(prevSubmissions);
          setSyncError(
            `Failed to clear submissions in Cloudflare D1 (${err instanceof Error ? err.message : 'network error'}). Restored submissions ledger.`,
          );
        }
      })();
    }
  };

  const selectedField = activeSchema?.fields.find((f) => f.id === selectedFieldId) ?? null;

  // Badges & Metrics
  const enabledIntegrationsCount = (activeSchema?.integrations || []).filter(
    (i) => i.enabled,
  ).length;
  const clientSubmissions = submissions.filter((s) => s.clientId === activeClient.id);
  const clientSubmissionsCount = clientSubmissions.length;
  const hasFailedDeliveries = clientSubmissions.some((s) =>
    s.deliveryLogs.some((l) => l.status === 'failed'),
  );

  const pastCount = historyPast[activeSchema.id]?.length ?? 0;
  const futureCount = historyFuture[activeSchema.id]?.length ?? 0;
  const canUndo = pastCount > 0;
  const canRedo = futureCount > 0;

  // If public client form view mode is active, render the clean standalone public runner
  if (isPublicView) {
    return (
      <PublicFormRunner
        client={activeClient}
        schema={activeSchema}
        embedMode={isEmbedPreview}
        onToggleEmbedMode={setIsEmbedPreview}
        onExitPublicView={() => setIsPublicView(false)}
        onSubmitPublicForm={handleRecordSubmission}
      />
    );
  }

  // If user is not authenticated, render full-page AuthPage (login & registration) as root view
  if (!currentUser) {
    return (
      <AuthPage
        onAuthSuccess={handleLoginSuccess}
        clients={clients}
      />
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased">
      <SideNav
        className="hidden lg:flex"
        isCollapsed={isSideNavCollapsed}
        onToggleCollapse={() => setIsSideNavCollapsed((prev) => !prev)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        fieldsCount={activeSchema.fields.length}
        integrationsCount={enabledIntegrationsCount}
        submissionsCount={clientSubmissionsCount}
        hasFailedDeliveries={hasFailedDeliveries}
        clients={clients}
        activeClientId={activeClientId}
        userRole={userRole}
        clientForms={clientForms}
        activeFormId={activeFormId}
        activeSchema={activeSchema}
        currentUser={currentUser}
        onSelectClient={handleSelectClient}
        onToggleUserRole={handleToggleUserRole}
        onSelectForm={handleSelectForm}
        onCreateForm={handleCreateForm}
        onCreateClient={handleCreateClient}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenPreview={() => setIsPublicView(true)}
        onResetDemo={handleResetDemoData}
        backendStatus={backendStatus}
        syncState={syncState}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Desktop Studio Top Bar (lg+) - Clean single tier toolbar */}
        <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs shadow-xs hidden lg:flex items-center justify-between px-4 sm:px-6 lg:px-8 py-2.5">
          {/* Left: Active form title, client badge, domain slug pill, status pill */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Sidebar Collapse/Expand Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSideNavCollapsed((prev) => !prev)}
              aria-label={isSideNavCollapsed ? 'Expand sidebar navigation' : 'Minimize sidebar navigation'}
              title={isSideNavCollapsed ? 'Expand sidebar navigation (⌘B)' : 'Minimize sidebar navigation (icons only) (⌘B)'}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] shadow-xs transition-all cursor-pointer shrink-0"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                {isSideNavCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10l2 2-2 2" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l-2 2 2 2" />
                )}
              </svg>
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                  {activeSchema.title}
                </h1>
                <span className="shrink-0 font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700">
                  {activeClient.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                <span className="font-mono truncate">
                  https://{activeSchema.customDomain}/{activeSchema.slug}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium border shrink-0',
                    activeSchema.status === 'published'
                      ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                      : 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      activeSchema.status === 'published'
                        ? 'bg-emerald-500 dark:bg-emerald-400'
                        : 'bg-amber-500 dark:bg-amber-400',
                    )}
                  />
                  {activeSchema.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Undo/Redo buttons, Share & Embed, Public Preview, Reset Demo, D1 Status */}
          <div className="flex items-center gap-2 shrink-0">
            {/* AST Undo / Redo History Controls */}
            <div className="flex items-center h-8 rounded-md bg-zinc-100 dark:bg-zinc-800/60 p-0.5 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title={
                  canUndo
                    ? `Undo last change (Cmd+Z) • ${pastCount} past revision${pastCount === 1 ? '' : 's'}`
                    : 'Undo last change (Cmd+Z)'
                }
                aria-label="Undo"
                className={cn(
                  'inline-flex items-center gap-1 h-7 rounded-sm px-2 text-xs font-medium transition touch-manipulation',
                  canUndo
                    ? 'text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-zinc-100 active:scale-[0.99] shadow-xs cursor-pointer'
                    : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50',
                )}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                  />
                </svg>
                <span className="hidden xl:inline">Undo</span>
                <Kbd className="inline-flex">⌘Z</Kbd>
                {canUndo && (
                  <span className="font-mono text-[9px] font-bold rounded bg-zinc-200/80 dark:bg-zinc-700 px-1 py-0.2 text-zinc-700 dark:text-zinc-300">
                    {pastCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title={
                  canRedo
                    ? `Redo change (Cmd+Shift+Z) • ${futureCount} future revision${futureCount === 1 ? '' : 's'}`
                    : 'Redo change (Cmd+Shift+Z)'
                }
                aria-label="Redo"
                className={cn(
                  'inline-flex items-center gap-1 h-7 rounded-sm px-2 text-xs font-medium transition touch-manipulation',
                  canRedo
                    ? 'text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-zinc-100 active:scale-[0.99] shadow-xs cursor-pointer'
                    : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50',
                )}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
                  />
                </svg>
                <span className="hidden xl:inline">Redo</span>
                <Kbd className="inline-flex">⌘⇧Z</Kbd>
                {canRedo && (
                  <span className="font-mono text-[9px] font-bold rounded bg-zinc-200/80 dark:bg-zinc-700 px-1 py-0.2 text-zinc-700 dark:text-zinc-300">
                    {futureCount}
                  </span>
                )}
              </button>
            </div>

            {/* Share Form button */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              title="Share form link and embed snippet"
              aria-label="Share Form"
              className="inline-flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.99] h-8 px-3 text-xs font-medium rounded-md shadow-xs transition-all cursor-pointer touch-manipulation"
            >
              <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              <span>Share Form</span>
            </button>

            {/* Customer View button */}
            <button
              type="button"
              onClick={() => setIsPublicView(true)}
              title={`Preview customer view on https://${activeSchema.customDomain}/${activeSchema.slug}`}
              aria-label="Customer View"
              className="inline-flex items-center gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 active:scale-[0.99] h-8 px-3 text-xs font-medium rounded-md shadow-xs transition-all cursor-pointer touch-manipulation"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
              <span>Customer View</span>
            </button>

            {/* Reset Demo button */}
            <button
              type="button"
              onClick={handleResetDemoData}
              title="Reset all demo tenants, schemas, and submission records to default seed state"
              aria-label="Reset Demo"
              className="inline-flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.99] h-8 px-2.5 text-xs font-medium rounded-md shadow-xs transition-all cursor-pointer touch-manipulation"
            >
              <svg
                className="h-3.5 w-3.5 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              <span className="hidden xl:inline">Reset Demo</span>
            </button>

            {/* Backend Status badge */}
            {backendStatus === 'connected' ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                title={
                  syncState === 'saving'
                    ? 'Saving active schema...'
                    : 'All changes saved and synchronized'
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                <span>
                  {syncState === 'saving'
                    ? 'Saving...'
                    : 'All Changes Saved ✓'}
                </span>
              </span>
            ) : backendStatus === 'connecting' ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                title="Connecting..."
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                <span>Loading...</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                title="Persisting state in local browser storage"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                <span>Saved in Browser</span>
              </span>
            )}
          </div>
        </header>

      {/* 2. Mobile & Tablet App Bar (< lg: Single Compact Row with Hamburger Menu) */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs flex lg:hidden items-center justify-between px-3 py-2 min-w-0 w-full shadow-xs">
        {/* Left: Hamburger Button + Brand + Form Title & Status */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileNavOpen}
            className="flex items-center justify-center h-8 w-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer touch-manipulation shrink-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-mono font-bold text-xs shadow-xs shrink-0">
              FB
            </span>

            <div className="flex flex-col min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[260px]">
                  {activeSchema.title}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    activeSchema.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  title={activeSchema.status === 'published' ? 'Published' : 'Draft'}
                />
              </div>
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[300px]">
                {activeClient.name} • {activeTab === 'build' ? 'Studio' : activeTab === 'preview' ? 'Live Form' : activeTab === 'integrations' ? 'Integrations' : activeTab === 'submissions' ? 'Submissions' : 'Schema'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Undo / Redo for build tab */}
          {activeTab === 'build' && (
            <div className="flex items-center h-8 rounded-md bg-zinc-100 dark:bg-zinc-800/60 p-0.5 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                aria-label="Undo"
                className={cn(
                  'inline-flex items-center justify-center h-7 w-7 rounded-sm text-xs transition touch-manipulation',
                  canUndo
                    ? 'text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 active:scale-95 cursor-pointer'
                    : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-40',
                )}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                aria-label="Redo"
                className={cn(
                  'inline-flex items-center justify-center h-7 w-7 rounded-sm text-xs transition touch-manipulation',
                  canRedo
                    ? 'text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900 active:scale-95 cursor-pointer'
                    : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-40',
                )}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                </svg>
              </button>
            </div>
          )}

          {/* Customer View Button */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsPublicView(true)}
            title="Customer View"
            className="h-8 px-2.5 text-xs font-medium gap-1 touch-manipulation"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            <span className="hidden xs:inline">Customer View</span>
          </Button>

          {/* User Profile Avatar / Trigger */}
          {currentUser ? (
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              title={`${currentUser.name} — Open Navigation Menu`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold text-xs shadow-xs border border-zinc-200 dark:border-zinc-700 cursor-pointer touch-manipulation"
            >
              {currentUser.name ? currentUser.name.charAt(0) : 'U'}
            </button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsLoginModalOpen(true)}
              className="h-8 px-2.5 text-xs"
            >
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* 2.1 Optimistic Sync Error Banner */}
      {syncError && (
        <aside
          role="alert"
          aria-live="assertive"
          className="border-b border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-800 dark:text-rose-300 transition-colors sm:px-6 lg:px-8"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <svg
                className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <span className="font-medium text-rose-900 dark:text-rose-200">{syncError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              aria-label="Dismiss error"
              className="inline-flex rounded-md p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:text-rose-900 dark:hover:text-rose-100 focus:outline-hidden focus:ring-1 focus:ring-rose-500 cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </aside>
      )}

      {/* 3. Main Workspace Body */}
      <main
        className="w-full max-w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 overflow-x-hidden"
        aria-busy={backendStatus === 'connecting' && !initialData.hasCachedStorage ? 'true' : undefined}
        aria-label={backendStatus === 'connecting' && !initialData.hasCachedStorage ? 'Loading workspace...' : undefined}
      >
        {backendStatus === 'connecting' && !initialData.hasCachedStorage ? (
          <div
            className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start w-full min-w-0 animate-pulse"
            aria-busy="true"
            aria-label="Loading workspace..."
          >
            {/* Left Column Skeleton: Field Palette */}
            <div className="hidden xl:block xl:col-span-3 2xl:col-span-2 space-y-4">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
                <Skeleton className="h-4 w-28 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
                <Skeleton className="h-4 w-24 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              </div>
            </div>

            {/* Center Column Skeleton: Builder Canvas */}
            <div className="w-full xl:col-span-6 2xl:col-span-8 space-y-4">
              {/* Canvas Header Card */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>

              {/* Field Rows Skeletons */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
                <div className="h-14 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800 rounded-md p-3 flex items-center justify-between">
                  <div className="space-y-1.5 w-1/3">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="h-20 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800 rounded-md p-3 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8" />
                  </div>
                  <div className="h-20 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800 rounded-md p-3 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8" />
                  </div>
                </div>

                <div className="h-20 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800 rounded-md p-3 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8" />
                </div>

                <div className="h-10 bg-zinc-100 dark:bg-zinc-800/50 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700" />
              </div>
            </div>

            {/* Right Column Skeleton: Property Inspector */}
            <div className="hidden xl:block xl:col-span-3 2xl:col-span-2 space-y-4">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-3 w-48 mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-16" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* TAB 1: FORM BUILDER STUDIO */}
        {activeTab === 'build' && (
          <div className="w-full">
            {/* Mobile / Tablet Segmented Studio Switcher (< lg) */}
            <div
              role="tablist"
              aria-label="Studio editing panes"
              className="flex lg:hidden items-center justify-around rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-1 mb-4 shadow-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mobileStudioPane === 'palette'}
                onClick={() => setMobileStudioPane('palette')}
                className={cn(
                  'flex-1 h-8 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-sm transition-all touch-manipulation cursor-pointer',
                  mobileStudioPane === 'palette'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                )}
              >
                <span>Add Questions</span>
                <span className="font-mono text-[10px] rounded px-1.5 py-0.5 bg-zinc-200/80 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                  {getFieldCatalog().length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mobileStudioPane === 'canvas'}
                onClick={() => setMobileStudioPane('canvas')}
                className={cn(
                  'flex-1 h-8 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-sm transition-all touch-manipulation cursor-pointer',
                  mobileStudioPane === 'canvas'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                )}
              >
                <span>Form Editor</span>
                <span className="font-mono text-[10px] rounded px-1.5 py-0.5 bg-zinc-200/80 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                  {activeSchema.fields.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mobileStudioPane === 'inspector'}
                onClick={() => setMobileStudioPane('inspector')}
                className={cn(
                  'flex-1 h-8 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-sm transition-all touch-manipulation cursor-pointer',
                  mobileStudioPane === 'inspector'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                )}
              >
                <span>Settings</span>
                {selectedFieldId ? (
                  <span className="font-mono text-[9px] font-semibold rounded px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Selected
                  </span>
                ) : null}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start w-full min-w-0">
              {/* Left Column: Field Palette */}
              <div
                className={cn(
                  'w-full min-w-0 lg:col-span-3 2xl:col-span-2 lg:sticky lg:top-28',
                  mobileStudioPane === 'palette' ? 'block' : 'hidden lg:block',
                )}
              >
                {/* Mobile Header for Palette */}
                <div className="flex lg:hidden items-center justify-between pb-3 mb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                      Add Questions
                    </span>
                    <span className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700">
                      {getFieldCatalog().length} types
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setMobileStudioPane('canvas')}
                    className="h-8 gap-1.5 text-xs touch-manipulation font-medium"
                  >
                    <span>Done / Back to Form Editor</span>
                    <span aria-hidden="true">→</span>
                  </Button>
                </div>
                <FieldPalette onAddField={handleAddField} />
              </div>

              {/* Center Column: Builder Canvas */}
              <div
                className={cn(
                  'w-full min-w-0 lg:col-span-6 2xl:col-span-8',
                  mobileStudioPane === 'canvas' ? 'block' : 'hidden lg:block',
                )}
              >
                {/* Quick Inspect Bar on < lg when a field is selected */}
                {selectedField && (
                  <div className="flex lg:hidden items-center justify-between gap-2 p-2.5 mb-3 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Selected:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {selectedField.label || selectedField.id}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setMobileStudioPane('inspector')}
                      className="h-7 px-2.5 text-xs shrink-0 font-medium"
                    >
                      <span>Inspect Field →</span>
                    </Button>
                  </div>
                )}

                <BuilderCanvas
                  schema={activeSchema}
                  clientName={activeClient.name}
                  allowedDomains={activeClient.allowedDomains}
                  selectedFieldId={selectedFieldId}
                  onSelectField={(id) => {
                    setSelectedFieldId(id);
                  }}
                  onInspectField={(id) => {
                    setSelectedFieldId(id);
                    setMobileStudioPane('inspector');
                  }}
                  onAddField={handleAddField}
                  onInsertFieldAtTarget={handleInsertFieldAtTarget}
                  onUpdateField={handleUpdateField}
                  onReorderField={handleReorderField}
                  onAddRowPreset={handleAddRowPreset}
                  onMoveField={handleMoveField}
                  onDuplicateField={handleDuplicateField}
                  onRemoveField={handleRemoveField}
                  onUpdateSchemaMeta={handleUpdateSchemaMeta}
                  onUpdateSubmissionSettings={handleUpdateSubmissionSettings}
                />
              </div>

              {/* Right Column: Property Inspector */}
              <div
                className={cn(
                  'w-full min-w-0 lg:col-span-3 2xl:col-span-2 lg:sticky lg:top-28',
                  mobileStudioPane === 'inspector' ? 'block' : 'hidden lg:block',
                )}
              >
                {/* Mobile Header for Property Inspector */}
                <div className="flex lg:hidden items-center justify-between pb-3 mb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setMobileStudioPane('canvas')}
                    className="h-8 gap-1.5 text-xs touch-manipulation font-medium"
                  >
                    <span aria-hidden="true">←</span>
                    <span>Back to Form Editor</span>
                  </Button>
                  {selectedField ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Editing:</span>
                      <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]">
                        {selectedField.label || selectedField.id}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">No field selected</span>
                  )}
                </div>
                <PropertyInspector
                  field={selectedField}
                  allFields={activeSchema.fields}
                  onUpdateField={handleUpdateField}
                  onRemoveField={handleRemoveField}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE CLIENT FORM & UTM SIMULATOR */}
        {activeTab === 'preview' && (
          <div className="py-2 w-full">
            <FormRenderer
              schema={activeSchema}
              clientName={activeClient.name}
              onRecordSubmission={handleRecordSubmission}
            />
          </div>
        )}

        {/* TAB 3: DOMAINS, EMBEDS & CRM INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="py-2 w-full">
            <IntegrationsHub
              schema={activeSchema}
              client={activeClient}
              onUpsertIntegration={handleUpsertIntegration}
              onRemoveIntegration={handleRemoveIntegration}
              onUpdateSchemaMeta={handleUpdateSchemaMeta}
            />
          </div>
        )}

        {/* TAB 4: D1 SUBMISSIONS & STORE-AND-FORWARD LEDGER */}
        {activeTab === 'submissions' && (
          <div className="py-2 w-full">
            <SubmissionsLedger
              client={activeClient}
              forms={clientForms}
              submissions={submissions}
              onRetrySubmission={handleRetrySubmission}
              onClearSubmissions={handleClearSubmissions}
            />
          </div>
        )}

        {/* TAB 5: SCHEMA AST JSON */}
        {activeTab === 'schema' && (
          <div className="py-2 w-full">
            <SchemaInspector
              schema={activeSchema}
              onReplaceSchema={handleReplaceSchema}
              onResetSchema={handleResetSchema}
            />
          </div>
        )}
          </>
        )}
      </main>
      </div>

      {/* 4. Share Form Modal Dialog */}
      {isShareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-embed-modal-title"
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="w-full max-w-lg mx-4 sm:mx-0 max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-5 sm:p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3
                  id="share-embed-modal-title"
                  className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-100"
                >
                  Share Your Form
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Send a direct link to customers or embed this form on your website.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Direct Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Direct Customer Link
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`https://${activeSchema.customDomain}/${activeSchema.slug}`}
                    className="font-mono text-xs select-all"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(`https://${activeSchema.customDomain}/${activeSchema.slug}`);
                      setCopiedType('url');
                      setTimeout(() => setCopiedType(null), 2000);
                    }}
                  >
                    {copiedType === 'url' ? 'Copied ✓' : 'Copy Link'}
                  </Button>
                </div>
              </div>

              {/* Responsive iFrame Snippet */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Embed on Your Website (Copy &amp; Paste Code)
                </label>
                <div>
                  <textarea
                    readOnly
                    rows={3}
                    value={`<iframe src="https://${activeSchema.customDomain}/${activeSchema.slug}?embed=true" width="100%" height="640" frameborder="0" style="border:none; border-radius:8px; width:100%; max-width:100%;"></iframe>`}
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 select-all resize-none shadow-xs"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `<iframe src="https://${activeSchema.customDomain}/${activeSchema.slug}?embed=true" width="100%" height="640" frameborder="0" style="border:none; border-radius:8px; width:100%; max-width:100%;"></iframe>`
                      );
                      setCopiedType('iframe');
                      setTimeout(() => setCopiedType(null), 2000);
                    }}
                  >
                    {copiedType === 'iframe' ? 'Copied ✓' : 'Copy Website Code'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="font-mono text-[11px] text-zinc-500">
                Account: <span className="text-zinc-900 dark:text-zinc-100 font-medium">{activeClient.name}</span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setIsShareModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsShareModalOpen(false);
                    setIsPublicView(true);
                  }}
                >
                  Open Live Form ↗
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. New Field Configuration Modal */}
      <NewFieldModal
        isOpen={pendingFieldInsertion !== null}
        fieldType={pendingFieldInsertion?.type ?? null}
        initialLabel={pendingFieldInsertion?.field.label}
        onClose={handleCancelNewField}
        onConfirm={handleConfirmNewField}
      />

      {/* 6. Authentication Modal Dialog */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        currentClientName={activeClient?.name}
      />

      {/* 6. Mobile & Tablet Navigation Drawer (Hamburger Menu) */}
      <MobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        fieldsCount={activeSchema.fields.length}
        integrationsCount={enabledIntegrationsCount}
        submissionsCount={clientSubmissionsCount}
        hasFailedDeliveries={hasFailedDeliveries}
        clients={clients}
        activeClientId={activeClientId}
        userRole={userRole}
        clientForms={clientForms}
        activeFormId={activeFormId}
        activeSchema={activeSchema}
        currentUser={currentUser}
        onSelectClient={handleSelectClient}
        onToggleUserRole={handleToggleUserRole}
        onSelectForm={handleSelectForm}
        onCreateForm={handleCreateForm}
        onCreateClient={handleCreateClient}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenPreview={() => setIsPublicView(true)}
        onResetDemo={handleResetDemoData}
        backendStatus={backendStatus}
        syncState={syncState}
      />
    </div>
  );
}
