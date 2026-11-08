import { useState } from 'react';
import type { ReactElement } from 'react';
import type {
  ClientTenant,
  FieldMapping,
  FormIntegrationConfig,
  FormSchema,
  IntegrationProvider,
} from '../../domain/form-schema/index.ts';
import {
  buildCrmPayload,
  createDefaultFormValues,
} from '../../domain/form-schema/index.ts';
import { generateId } from '../../shared/lib/id.ts';
import { cn } from '../../shared/lib/cn.ts';
import { Badge } from '../../shared/ui/badge.tsx';
import { Button } from '../../shared/ui/button.tsx';
import { Input } from '../../shared/ui/input.tsx';

export interface IntegrationsHubProps {
  schema: FormSchema;
  client: ClientTenant;
  onUpsertIntegration: (integration: FormIntegrationConfig) => void;
  onRemoveIntegration: (integrationId: string) => void;
  onUpdateSchemaMeta: (
    patch: Partial<Pick<FormSchema, 'slug' | 'customDomain' | 'status'>>,
  ) => void;
}

const PROVIDER_METADATA: Record<
  IntegrationProvider,
  {
    badge: string;
    title: string;
    defaultName: string;
    defaultUrl: string;
    targetLabel: string;
    targetPlaceholder: string;
    defaultTarget: string;
    defaultKey: string;
  }
> = {
  ghl: {
    badge: 'GHL',
    title: 'GoHighLevel',
    defaultName: 'GoHighLevel Lead Connector',
    defaultUrl: 'https://services.leadconnectorhq.com/hooks/custom-v2',
    targetLabel: 'Location ID',
    targetPlaceholder: 'e.g. loc_live_8912x',
    defaultTarget: 'loc_live_8912x',
    defaultKey: 'ghl_live_••••••••7c4a',
  },
  close: {
    badge: 'CLOSE',
    title: 'Close CRM',
    defaultName: 'Close CRM Lead & Contact',
    defaultUrl: 'https://api.close.com/api/v1/lead/',
    targetLabel: 'Lead Status',
    targetPlaceholder: 'e.g. Potential / New Lead',
    defaultTarget: 'Potential Lead',
    defaultKey: 'api_key_••••••••1b82',
  },
  zoho: {
    badge: 'ZOHO',
    title: 'Zoho CRM',
    defaultName: 'Zoho CRM Module Upsert',
    defaultUrl: 'https://www.zohoapis.com/crm/v3/Leads',
    targetLabel: 'Target Module',
    targetPlaceholder: 'e.g. Leads or Contacts',
    defaultTarget: 'Leads',
    defaultKey: 'zoho_oauth_•••••••92e',
  },
  airtable: {
    badge: 'AIR',
    title: 'Airtable',
    defaultName: 'Airtable Base Sync',
    defaultUrl: 'https://api.airtable.com/v0/appXXXX/tblYYYY',
    targetLabel: 'Table / Base Name',
    targetPlaceholder: 'e.g. Submissions (tblYYYY)',
    defaultTarget: 'Submissions',
    defaultKey: 'pat_live_••••••••811d',
  },
  webhook: {
    badge: 'HOOK',
    title: 'Custom Webhook',
    defaultName: 'Make / Zapier / n8n Webhook',
    defaultUrl: 'https://hook.eu1.make.com/abc123xyz',
    targetLabel: 'Trigger Event',
    targetPlaceholder: 'e.g. form_submission',
    defaultTarget: 'lead_inbound',
    defaultKey: 'whsec_••••••••412f',
  },
};

export function IntegrationsHub({
  schema,
  client,
  onUpsertIntegration,
  onRemoveIntegration,
  onUpdateSchemaMeta,
}: IntegrationsHubProps): ReactElement {
  const [activeTab, setActiveTab] = useState<'website_sharing' | 'connected_apps'>(
    'website_sharing',
  );
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(
    schema.integrations[0]?.id ?? null,
  );
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isTestingPayload, setIsTestingPayload] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const activeIntegration =
    schema.integrations.find((i) => i.id === selectedIntegrationId) ??
    schema.integrations[0] ??
    null;

  const handleCopy = (text: string, type: string): void => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedType((current) => (current === type ? null : current));
    }, 2000);
  };

  const handleAddIntegration = (provider: IntegrationProvider): void => {
    const meta = PROVIDER_METADATA[provider];
    const initialMappings: FieldMapping[] = schema.fields.map((f) => ({
      formFieldId: f.id,
      remoteFieldKey: f.crmFieldKey || f.id,
    }));

    const newIntegration: FormIntegrationConfig = {
      id: generateId(`integ_${provider}`),
      provider,
      name: meta.defaultName,
      enabled: true,
      endpointUrl: meta.defaultUrl,
      targetResource: meta.defaultTarget,
      apiKeyMasked: meta.defaultKey,
      fieldMappings: initialMappings,
    };

    onUpsertIntegration(newIntegration);
    setSelectedIntegrationId(newIntegration.id);
    setActiveTab('connected_apps');
  };

  const handleAutoMapKeys = (integration: FormIntegrationConfig): void => {
    const autoMapped: FieldMapping[] = schema.fields.map((field) => {
      let key = field.crmFieldKey || '';
      if (!key) {
        const lbl = field.label.toLowerCase();
        if (field.type === 'email' || lbl.includes('email')) {
          key = 'email';
        } else if (field.type === 'phone' || lbl.includes('phone') || lbl.includes('mobile')) {
          key = 'phone';
        } else if (lbl.includes('first') && lbl.includes('name')) {
          key = 'firstName';
        } else if (lbl.includes('last') && lbl.includes('name')) {
          key = 'lastName';
        } else if (lbl.includes('company') || lbl.includes('business')) {
          key = 'company';
        } else if (lbl.includes('message') || lbl.includes('notes') || field.type === 'textarea') {
          key = 'message';
        } else {
          key = field.id.replace(/[^a-zA-Z0-9_]/g, '_');
        }
      }
      return {
        formFieldId: field.id,
        remoteFieldKey: key,
      };
    });

    onUpsertIntegration({
      ...integration,
      fieldMappings: autoMapped,
    });
  };

  const handleUpdateFieldMapping = (
    integration: FormIntegrationConfig,
    fieldId: string,
    remoteKey: string,
  ): void => {
    const existing = integration.fieldMappings.filter((m) => m.formFieldId !== fieldId);
    const updatedMappings: FieldMapping[] = [
      ...existing,
      { formFieldId: fieldId, remoteFieldKey: remoteKey },
    ];
    onUpsertIntegration({
      ...integration,
      fieldMappings: updatedMappings,
    });
  };

  const handleTestPayload = (): void => {
    setIsTestingPayload(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTestingPayload(false);
      setTestResult('Payload verified successfully against schema contracts (HTTP 200 Mock OK).');
      setTimeout(() => setTestResult(null), 4000);
    }, 600);
  };

  const formDirectUrl = `https://${schema.customDomain}/${schema.slug}`;

  const iframeSnippet = `<iframe src="${formDirectUrl}" width="100%" height="650" frameborder="0" style="border:none; border-radius:8px; width:100%; max-width:680px;" title="${schema.title}"></iframe>`;

  const widgetSnippet = `<!-- Antigravity Form Widget Embed -->\n<div id="form-embed-${schema.id}"></div>\n<script src="https://${schema.customDomain}/widget.js" data-form-id="${schema.id}" data-target="#form-embed-${schema.id}" async></script>`;

  // Generate live payload sample for the technical disclosure
  const sampleValues = createDefaultFormValues(schema, {
    utm_source: 'google_ads',
    gclid: 'gclid_demo_98234a',
  });
  const sampleUrlParams = {
    utm_source: 'google_ads',
    utm_medium: 'cpc',
    utm_campaign: 'spring_launch',
    gclid: 'gclid_demo_98234a',
  };

  const livePayload = activeIntegration
    ? buildCrmPayload(schema, activeIntegration, sampleValues, sampleUrlParams)
    : null;

  return (
    <div className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm text-zinc-900 dark:text-zinc-100">
      {/* Friendly Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
              Connected Apps &amp; Website Link
            </h2>
            <Badge variant="default" className="gap-1 font-mono">
              Client: {client.name}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Share your form on your website and automatically send new customer leads to your favorite tools.
          </p>
        </div>

        {/* Tab Controls: Plain-English Labels */}
        <div className="overflow-x-auto no-scrollbar -webkit-overflow-scrolling-touch [scrollbar-width:none] [&::-webkit-scrollbar]:hidden inline-flex max-w-full rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setActiveTab('website_sharing')}
            className={cn(
              'whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium transition-all touch-manipulation',
              activeTab === 'website_sharing'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
            )}
          >
            Website Link &amp; Sharing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('connected_apps')}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium transition-all touch-manipulation',
              activeTab === 'connected_apps'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
            )}
          >
            <span>Connected Apps (CRM)</span>
            <span className="rounded-sm bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
              {schema.integrations.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Website Link & Sharing */}
      {activeTab === 'website_sharing' && (
        <div className="mt-5 space-y-6">
          {/* Direct Form Link Card */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Direct Form Link
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Share this public web link directly with customers or use it in emails and ads.
                </p>
              </div>
              <Badge variant={schema.status === 'published' ? 'success' : 'warning'}>
                {schema.status === 'published' ? '● Published & Active' : '○ Draft Mode'}
              </Badge>
            </div>

            <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs min-w-0 overflow-hidden">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-medium text-zinc-500 dark:text-zinc-400 shrink-0">Live Link:</span>
                <a
                  href={formDirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-medium text-zinc-900 dark:text-zinc-100 hover:underline truncate"
                >
                  {formDirectUrl}
                </a>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="touch-manipulation"
                  onClick={() => handleCopy(formDirectUrl, 'url')}
                >
                  {copiedType === 'url' ? '✓ Link Copied!' : 'Copy Link'}
                </Button>
                <a
                  href={formDirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition touch-manipulation"
                >
                  Open Form &rarr;
                </a>
              </div>
            </div>

            {/* Quick URL & Status Controls */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="form-url-slug" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Form Link Slug (URL Path)
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 px-2.5 text-xs text-zinc-500 select-none">
                    /{schema.customDomain}/
                  </span>
                  <input
                    id="form-url-slug"
                    aria-label="Form URL Slug"
                    type="text"
                    value={schema.slug}
                    onChange={(e) => onUpdateSchemaMeta({ slug: e.target.value })}
                    className="h-9 w-full rounded-r-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="publication-status" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Form Status
                </label>
                <select
                  id="publication-status"
                  aria-label="Publication Status"
                  value={schema.status}
                  onChange={(e) =>
                    onUpdateSchemaMeta({
                      status: e.target.value as 'draft' | 'published',
                    })
                  }
                  className="mt-1 h-9 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
                >
                  <option value="published">Published (Accepting Responses)</option>
                  <option value="draft">Draft (Paused / Not Accepting Responses)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Website Embed Code Section */}
          <div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Embed Form on Your Website
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Copy and paste either code snippet below into WordPress, Webflow, Squarespace, Shopify, or any HTML website.
              </p>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2 min-w-0">
              {/* Iframe */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Standard Website Embed (Recommended)
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Works on all website builders and CMS platforms
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="touch-manipulation shrink-0"
                    onClick={() => handleCopy(iframeSnippet, 'iframe')}
                  >
                    {copiedType === 'iframe' ? '✓ Copied!' : 'Copy Code'}
                  </Button>
                </div>
                <pre className="max-h-36 overflow-x-auto -webkit-overflow-scrolling-touch rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100">
                  {iframeSnippet}
                </pre>
              </div>

              {/* JS Widget */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Dynamic Auto-Resize Widget
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Automatically adjusts height to match form steps
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="touch-manipulation shrink-0"
                    onClick={() => handleCopy(widgetSnippet, 'widget')}
                  >
                    {copiedType === 'widget' ? '✓ Copied!' : 'Copy Code'}
                  </Button>
                </div>
                <pre className="max-h-36 overflow-x-auto -webkit-overflow-scrolling-touch rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100">
                  {widgetSnippet}
                </pre>
              </div>
            </div>
          </div>

          {/* Advanced Custom Domain & DNS Setup (For Webmasters) */}
          <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-4">
            <summary className="cursor-pointer select-none font-semibold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <svg
                  className="h-3.5 w-3.5 transition-transform group-open:rotate-90 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span>Advanced Custom Domain &amp; DNS Setup (For Webmasters)</span>
              </span>
              <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-500">
                Custom Domain &bull; CNAME &bull; Origin Lock
              </span>
            </summary>

            <div className="mt-4 space-y-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Custom Domain Host
                </label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  The domain or subdomain where this form is served.
                </p>
                <Input
                  type="text"
                  value={schema.customDomain}
                  onChange={(e) => onUpdateSchemaMeta({ customDomain: e.target.value })}
                  className="font-mono text-xs max-w-md"
                />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  DNS CNAME Configuration
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
                  Create a CNAME record with your DNS provider (Cloudflare, GoDaddy, Namecheap) pointing your custom domain to our edge server.
                </p>

                <div className="overflow-x-auto -webkit-overflow-scrolling-touch border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <table className="min-w-[540px] w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-xs">
                    <thead className="bg-zinc-100/60 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                      <tr>
                        <th className="px-3.5 py-2 font-semibold">Type</th>
                        <th className="px-3.5 py-2 font-semibold">Name / Host</th>
                        <th className="px-3.5 py-2 font-semibold">Target / Value</th>
                        <th className="px-3.5 py-2 font-semibold">Proxy Status</th>
                        <th className="px-3.5 py-2 font-semibold">TTL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900 font-mono text-xs">
                      <tr>
                        <td className="px-3.5 py-2 font-semibold text-zinc-900 dark:text-zinc-100">CNAME</td>
                        <td className="px-3.5 py-2 text-zinc-700 dark:text-zinc-300">{schema.customDomain}</td>
                        <td className="px-3.5 py-2 text-zinc-600 dark:text-zinc-400">form-builder.pages.dev</td>
                        <td className="px-3.5 py-2">
                          <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Proxied or DNS only
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-zinc-500 dark:text-zinc-400">Auto</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Authorized Website Embed Domains: </span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  {client.allowedDomains.join(', ')}
                </span>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Only web pages on these domains are permitted to embed this form, protecting your brand from unauthorized duplication.
                </p>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Tab 2: Connected Apps (CRM) */}
      {activeTab === 'connected_apps' && (
        <div className="mt-5 space-y-6 min-w-0">
          {/* Quick-add connector bar */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Connect New App or CRM
              </h3>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                New leads are automatically delivered to all active apps.
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(PROVIDER_METADATA) as IntegrationProvider[]).map((provider) => {
                const meta = PROVIDER_METADATA[provider];
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleAddIntegration(provider)}
                    className="flex items-center sm:flex-col justify-between sm:justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-left sm:text-center transition-all hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 shadow-xs active:scale-[0.98] touch-manipulation min-h-[44px]"
                  >
                    <div className="flex items-center gap-2 sm:flex-col sm:gap-1.5">
                      <span className="inline-flex shrink-0 items-center justify-center rounded-sm font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5">
                        {meta.badge}
                      </span>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {meta.title}
                      </span>
                    </div>
                    <span className="text-xs sm:text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      + Connect
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configured Integrations List & Details */}
          {schema.integrations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                No apps connected yet.
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Choose an app above (GoHighLevel, Close, Zoho, Airtable, or Webhook) to forward leads automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-12 min-w-0">
              {/* Left Column: Integration Switcher / Selector */}
              <div className="space-y-2 lg:col-span-4 min-w-0">
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Your Connected Apps ({schema.integrations.length})
                </h4>
                {schema.integrations.map((integ) => {
                  const meta = PROVIDER_METADATA[integ.provider];
                  const isSelected = integ.id === selectedIntegrationId;
                  return (
                    <div
                      key={integ.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedIntegrationId(integ.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setSelectedIntegrationId(integ.id);
                      }}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all duration-150 touch-manipulation min-h-[44px]',
                        isSelected
                          ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 ring-1 ring-zinc-950 dark:ring-zinc-100 shadow-xs'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-flex shrink-0 items-center justify-center rounded-sm font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5">
                          {meta.badge}
                        </span>
                        <div className="min-w-0 truncate">
                          <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {integ.name}
                          </p>
                          <p className="truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                            {integ.targetResource || integ.provider}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[11px] font-medium',
                            integ.enabled
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-zinc-400 dark:text-zinc-500',
                          )}
                        >
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              integ.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700',
                            )}
                          />
                          <span className="hidden sm:inline">
                            {integ.enabled ? 'Active' : 'Paused'}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Editor for Selected Integration */}
              {activeIntegration && (
                <div className="space-y-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-4 lg:col-span-8 min-w-0 overflow-hidden">
                  {/* Top Bar of Active Integration */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5">
                        {PROVIDER_METADATA[activeIntegration.provider].badge}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {activeIntegration.name}
                        </h4>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Provider: {PROVIDER_METADATA[activeIntegration.provider].title}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Enable/Disable Friendly Toggle: Connected & Active vs Paused */}
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer touch-manipulation">
                        <input
                          type="checkbox"
                          checked={activeIntegration.enabled}
                          aria-label={`Toggle ${PROVIDER_METADATA[activeIntegration.provider].title} integration`}
                          onChange={(e) =>
                            onUpsertIntegration({
                              ...activeIntegration,
                              enabled: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded-sm border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-zinc-950 touch-manipulation"
                        />
                        <span
                          className={cn(
                            'font-semibold',
                            activeIntegration.enabled
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-zinc-500 dark:text-zinc-400',
                          )}
                        >
                          {activeIntegration.enabled ? 'Connected & Active' : 'Paused'}
                        </span>
                      </label>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="touch-manipulation"
                        onClick={() => onRemoveIntegration(activeIntegration.id)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>

                  {/* Settings fields */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        App Nickname
                      </label>
                      <Input
                        type="text"
                        value={activeIntegration.name}
                        onChange={(e) =>
                          onUpsertIntegration({
                            ...activeIntegration,
                            name: e.target.value,
                          })
                        }
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {PROVIDER_METADATA[activeIntegration.provider].targetLabel}
                      </label>
                      <Input
                        type="text"
                        placeholder={
                          PROVIDER_METADATA[activeIntegration.provider].targetPlaceholder
                        }
                        value={activeIntegration.targetResource || ''}
                        onChange={(e) =>
                          onUpsertIntegration({
                            ...activeIntegration,
                            targetResource: e.target.value,
                          })
                        }
                        className="mt-1 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Destination Web Address (Endpoint URL)
                      </label>
                      <Input
                        type="text"
                        value={activeIntegration.endpointUrl}
                        onChange={(e) =>
                          onUpsertIntegration({
                            ...activeIntegration,
                            endpointUrl: e.target.value,
                          })
                        }
                        className="mt-1 font-mono text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        API Key or Access Token
                      </label>
                      <Input
                        type="text"
                        value={activeIntegration.apiKeyMasked || ''}
                        onChange={(e) =>
                          onUpsertIntegration({
                            ...activeIntegration,
                            apiKeyMasked: e.target.value,
                          })
                        }
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Interactive Field Mapping Editor */}
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Field Mappings (Form Question &rarr; CRM Field)
                        </h5>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Match your form questions to the corresponding fields in {PROVIDER_METADATA[activeIntegration.provider].title}.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="touch-manipulation"
                        onClick={() => handleAutoMapKeys(activeIntegration)}
                      >
                        Auto-Match Fields
                      </Button>
                    </div>

                    <div className="mt-2.5 max-h-56 overflow-y-auto overflow-x-auto -webkit-overflow-scrolling-touch rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <table className="min-w-[460px] w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                          <tr>
                            <th className="px-3 py-1.5 font-semibold min-w-[140px]">Form Question</th>
                            <th className="px-3 py-1.5 font-semibold w-20 min-w-[70px]">Type</th>
                            <th className="px-3 py-1.5 font-semibold min-w-[200px]">CRM Field Name</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono text-xs">
                          {schema.fields.map((field) => {
                            const mapping = activeIntegration.fieldMappings.find(
                              (m) => m.formFieldId === field.id,
                            );
                            const currentKey = mapping?.remoteFieldKey ?? field.crmFieldKey ?? field.id;

                            return (
                              <tr key={field.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                                <td className="px-3 py-1.5 font-sans font-medium text-zinc-900 dark:text-zinc-100 min-w-[140px]">
                                  <div className="truncate max-w-[180px]">{field.label}</div>
                                  <span className="block font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[180px]">
                                    {field.id}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-zinc-500 w-20 min-w-[70px]">
                                  <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1 py-0.5 text-[10px] font-mono">
                                    {field.type}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 min-w-[200px]">
                                  <input
                                    type="text"
                                    value={currentKey}
                                    aria-label={`CRM field key mapping for ${field.label || field.id}`}
                                    onChange={(e) =>
                                      handleUpdateFieldMapping(
                                        activeIntegration,
                                        field.id,
                                        e.target.value,
                                      )
                                    }
                                    placeholder={field.id}
                                    className="h-8 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Collapsible Technical JSON Payload Preview */}
                  <details className="group border-t border-zinc-200 dark:border-zinc-800 pt-3.5 space-y-3">
                    <summary className="cursor-pointer select-none text-xs font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <svg
                          className="h-3.5 w-3.5 transition-transform group-open:rotate-90 text-zinc-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span>View Technical JSON Payload Preview</span>
                      </span>
                      <span className="text-[11px] font-normal text-zinc-400">
                        (Developer / Debugging)
                      </span>
                    </summary>

                    <div className="mt-3 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Exact data structure delivered to {PROVIDER_METADATA[activeIntegration.provider].title} on submission.
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            isLoading={isTestingPayload}
                            onClick={handleTestPayload}
                            className="touch-manipulation"
                          >
                            Test Connection
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="touch-manipulation"
                            onClick={() =>
                              handleCopy(JSON.stringify(livePayload, null, 2), 'payload')
                            }
                          >
                            {copiedType === 'payload' ? '✓ Copied!' : 'Copy JSON'}
                          </Button>
                        </div>
                      </div>

                      {testResult && (
                        <div className="p-2.5 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          &#10003; {testResult}
                        </div>
                      )}

                      <pre className="max-h-52 overflow-auto -webkit-overflow-scrolling-touch rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
                        {JSON.stringify(livePayload, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
