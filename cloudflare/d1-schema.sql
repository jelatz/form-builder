-- ==============================================================================
-- Cloudflare D1 Production SQLite Schema: Multi-Tenant Form Builder & Integrations
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- 1. Clients (Tenants)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  primary_domain TEXT NOT NULL,
  allowed_domains_json TEXT NOT NULL,
  industry TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. Forms (Tenant-Scoped Form Schemas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  custom_domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  UNIQUE(client_id, slug)
);

-- ------------------------------------------------------------------------------
-- 3. Submissions (Store-and-Forward Primary Storage)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  values_json TEXT NOT NULL,
  url_params_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  FOREIGN KEY (form_id) REFERENCES forms(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- ------------------------------------------------------------------------------
-- 4. Submission Deliveries (Integration Delivery & Audit Logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submission_deliveries (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  integration_name TEXT NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  response_message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

-- ------------------------------------------------------------------------------
-- 5. Users (Authentication & Tenant Scoping)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client_editor', -- 'agency_admin' or 'client_editor'
  client_id TEXT,                          -- NULL for agency_admin, or valid client_id for client_editor
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- ------------------------------------------------------------------------------
-- 6. Performance & Tenant Isolation Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_forms_domain_slug ON forms(custom_domain, slug);
CREATE INDEX IF NOT EXISTS idx_forms_client ON forms(client_id);
CREATE INDEX IF NOT EXISTS idx_submissions_client_form ON submissions(client_id, form_id);
CREATE INDEX IF NOT EXISTS idx_submission_deliveries_submission ON submission_deliveries(submission_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_client ON users(client_id);

-- ------------------------------------------------------------------------------
-- 7. Initial Seed Data (Default Tenants & Production Forms)
-- ------------------------------------------------------------------------------

INSERT OR IGNORE INTO clients (id, name, slug, primary_domain, allowed_domains_json, industry, status, created_at)
VALUES (
  'client_acme',
  'Acme Home Services',
  'acme',
  'forms.acmehomeservices.com',
  '["forms.acmehomeservices.com","acmehomeservices.com"]',
  'Home Services & HVAC',
  'active',
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO clients (id, name, slug, primary_domain, allowed_domains_json, industry, status, created_at)
VALUES (
  'client_apex',
  'Apex B2B SaaS',
  'apex',
  'intake.apexcloud.io',
  '["intake.apexcloud.io","app.apexcloud.io"]',
  'Enterprise B2B Software',
  'active',
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO clients (id, name, slug, primary_domain, allowed_domains_json, industry, status, created_at)
VALUES (
  'client_elevate',
  'Elevate MedSpa',
  'elevate',
  'book.elevatemedspa.com',
  '["book.elevatemedspa.com","elevatemedspa.com"]',
  'Medical Aesthetics & Healthcare',
  'active',
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO users (id, email, password_hash, name, role, client_id, created_at)
VALUES (
  'usr_agency_admin',
  'admin@agency.com',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'Alex Vance (Agency Director)',
  'agency_admin',
  NULL,
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO users (id, email, password_hash, name, role, client_id, created_at)
VALUES (
  'usr_acme_editor',
  'sarah@acmehomeservices.com',
  '459aa9b36f4c740533a5fd26a10bbe674576210c10ac6e2befcd86f8d0405c99',
  'Sarah Jenkins (Acme)',
  'client_editor',
  'client_acme',
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO users (id, email, password_hash, name, role, client_id, created_at)
VALUES (
  'usr_apex_editor',
  'david@apexcloud.io',
  'aa7079615177d0432fedbfdeb5af227ebfc181b6165768b7fefca5c8058658d3',
  'David Lin (Apex SaaS)',
  'client_editor',
  'client_apex',
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO users (id, email, password_hash, name, role, client_id, created_at)
VALUES (
  'usr_elevate_editor',
  'jessica@elevatemedspa.com',
  'dfbff92915ba3714350ae57f79e34752f2896bad1ff039981741b0e4c7def674',
  'Jessica Sterling (Elevate MedSpa)',
  'client_editor',
  'client_elevate',
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO forms (id, client_id, slug, custom_domain, status, title, description, schema_json, updated_at)
VALUES (
  'form_acme_quote',
  'client_acme',
  'service-quote',
  'forms.acmehomeservices.com',
  'published',
  'Service Quote & Dispatch Intake',
  'Fast, upfront dispatch quotes for residential heating, cooling, and plumbing emergency service.',
  '{"id":"form_acme_quote","clientId":"client_acme","title":"Service Quote & Dispatch Intake","slug":"service-quote","customDomain":"forms.acmehomeservices.com","status":"published","description":"Fast, upfront dispatch quotes for residential heating, cooling, and plumbing emergency service.","settings":{"submitButtonText":"Request Instant Dispatch Quote","actionType":"message","successTitle":"Quote Request Received!","successMessage":"A certified dispatch technician is reviewing your service request and will call you within 15 minutes."},"fields":[{"id":"acme_name","type":"text","label":"Full Name","required":true,"placeholder":"e.g. Sarah Jenkins","crmFieldKey":"full_name"},{"id":"acme_email","type":"email","label":"Email Address","required":true,"placeholder":"sarah.jenkins@example.com","crmFieldKey":"email"},{"id":"acme_phone","type":"phone","label":"Mobile Phone","required":true,"placeholder":"(555) 234-5678","crmFieldKey":"phone","helperText":"We will text dispatch ETA and technician details to this number"},{"id":"acme_service","type":"select","label":"Service Needed","required":true,"placeholder":"Select required home service...","crmFieldKey":"service_type","options":[{"label":"HVAC Repair","value":"HVAC Repair"},{"label":"Plumbing Emergency","value":"Plumbing Emergency"},{"label":"Full Installation","value":"Full Installation"}]},{"id":"acme_budget","type":"number","label":"Estimated Budget ($)","required":false,"placeholder":"e.g. 8500","min":500,"max":50000,"step":100,"crmFieldKey":"deal_value","helperText":"Provide an estimated target budget for full system replacement","condition":{"sourceFieldId":"acme_service","operator":"equals","value":"Full Installation"}},{"id":"acme_utm","type":"hidden","label":"UTM Source","required":false,"urlParamKey":"utm_source","crmFieldKey":"utm_source","defaultValue":"direct"}],"integrations":[{"id":"int_ghl_acme","provider":"ghl","name":"GoHighLevel Lead Connector","enabled":true,"endpointUrl":"https://services.leadconnectorhq.com/hooks/custom-v2","targetResource":"loc_acme_home_01","apiKeyMasked":"ghl_live_••••••••••••8f2a","fieldMappings":[{"formFieldId":"acme_name","remoteFieldKey":"full_name"},{"formFieldId":"acme_email","remoteFieldKey":"email"},{"formFieldId":"acme_phone","remoteFieldKey":"phone"},{"formFieldId":"acme_service","remoteFieldKey":"service_type"},{"formFieldId":"acme_budget","remoteFieldKey":"deal_value"},{"formFieldId":"acme_utm","remoteFieldKey":"utm_source"}]},{"id":"int_zoho_acme","provider":"zoho","name":"Zoho CRM Leads Module","enabled":true,"endpointUrl":"https://www.zohoapis.com/crm/v2/Leads","targetResource":"Leads","apiKeyMasked":"1000.••••••••••••••••34a1","fieldMappings":[{"formFieldId":"acme_name","remoteFieldKey":"Last_Name"},{"formFieldId":"acme_email","remoteFieldKey":"Email"},{"formFieldId":"acme_phone","remoteFieldKey":"Phone"},{"formFieldId":"acme_service","remoteFieldKey":"Lead_Source_Detail"}]},{"id":"int_airtable_acme","provider":"airtable","name":"Airtable Dispatch Base","enabled":true,"endpointUrl":"https://api.airtable.com/v0/appAcmeQuoteBase/tblDispatch","targetResource":"tblDispatch","apiKeyMasked":"pat_••••••••••••••••c8d9","fieldMappings":[{"formFieldId":"acme_name","remoteFieldKey":"Client Name"},{"formFieldId":"acme_email","remoteFieldKey":"Contact Email"},{"formFieldId":"acme_phone","remoteFieldKey":"Direct Phone"},{"formFieldId":"acme_service","remoteFieldKey":"Requested Service"},{"formFieldId":"acme_budget","remoteFieldKey":"Estimated Budget"}]}]}',
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO forms (id, client_id, slug, custom_domain, status, title, description, schema_json, updated_at)
VALUES (
  'form_apex_demo',
  'client_apex',
  'enterprise-demo',
  'intake.apexcloud.io',
  'published',
  'Enterprise Demo & Qualification',
  'Schedule a tailored architecture walkthrough and technical evaluation of Apex Cloud Platform.',
  '{"id":"form_apex_demo","clientId":"client_apex","title":"Enterprise Demo & Qualification","slug":"enterprise-demo","customDomain":"intake.apexcloud.io","status":"published","description":"Schedule a tailored architecture walkthrough and technical evaluation of Apex Cloud Platform.","settings":{"submitButtonText":"Schedule Engineering Walkthrough","actionType":"message","successTitle":"Demo Request Scheduled","successMessage":"Our solutions architecture team has received your technical brief and will reach out with a calendar link."},"fields":[{"id":"apex_name","type":"text","label":"Full Name","required":true,"placeholder":"e.g. David Lin","crmFieldKey":"name"},{"id":"apex_email","type":"email","label":"Work Email","required":true,"placeholder":"david@enterprise.com","crmFieldKey":"email"},{"id":"apex_company_size","type":"radio","label":"Company Size","required":true,"crmFieldKey":"company_size","options":[{"label":"1 - 50 employees","value":"1-50"},{"label":"51 - 250 employees","value":"51-250"},{"label":"251 - 1000 employees","value":"251-1000"},{"label":"1000+ employees","value":"1000+"}]},{"id":"apex_notes","type":"textarea","label":"Project Notes & Architecture Needs","required":false,"rows":4,"placeholder":"Tell us about your current stack, database scale, and high-availability requirements...","crmFieldKey":"notes"},{"id":"apex_utm","type":"hidden","label":"UTM Campaign","required":false,"urlParamKey":"utm_source","crmFieldKey":"utm_source","defaultValue":"organic"}],"integrations":[{"id":"int_close_apex","provider":"close","name":"Close CRM Leads & Opportunities","enabled":true,"endpointUrl":"https://api.close.com/api/v1/lead/","targetResource":"leads","apiKeyMasked":"api_••••••••••••••••e3c1","fieldMappings":[{"formFieldId":"apex_name","remoteFieldKey":"name"},{"formFieldId":"apex_email","remoteFieldKey":"email"},{"formFieldId":"apex_company_size","remoteFieldKey":"custom.cf_company_size"},{"formFieldId":"apex_notes","remoteFieldKey":"description"}]},{"id":"int_webhook_apex","provider":"webhook","name":"n8n Enterprise Router Webhook","enabled":true,"endpointUrl":"https://n8n.apexcloud.io/webhook/intake-leads","targetResource":"POST /intake-leads","apiKeyMasked":"whsec_••••••••••••••••49a2","fieldMappings":[{"formFieldId":"apex_name","remoteFieldKey":"contact_name"},{"formFieldId":"apex_email","remoteFieldKey":"work_email"},{"formFieldId":"apex_company_size","remoteFieldKey":"org_size"},{"formFieldId":"apex_notes","remoteFieldKey":"project_brief"},{"formFieldId":"apex_utm","remoteFieldKey":"lead_source"}]}]}',
  '2026-11-06T00:00:00.000Z'
);

INSERT OR IGNORE INTO forms (id, client_id, slug, custom_domain, status, title, description, schema_json, updated_at)
VALUES (
  'form_elevate_consult',
  'client_elevate',
  'consultation',
  'book.elevatemedspa.com',
  'published',
  'New Patient Consultation',
  'Schedule a personalized skincare & medical aesthetics consultation with Dr. Miller.',
  '{"id":"form_elevate_consult","clientId":"client_elevate","title":"New Patient Consultation","slug":"consultation","customDomain":"book.elevatemedspa.com","status":"published","description":"Schedule a personalized skincare & medical aesthetics consultation with Dr. Miller.","settings":{"submitButtonText":"Confirm Consultation Request","actionType":"message","successTitle":"Consultation Requested!","successMessage":"We have received your appointment request. Our clinical coordinator will call you to confirm your time slot."},"fields":[{"id":"elevate_name","type":"text","label":"Patient Full Name","required":true,"placeholder":"e.g. Jessica Sterling","crmFieldKey":"patient_name"},{"id":"elevate_phone","type":"phone","label":"Cell Phone","required":true,"placeholder":"(555) 890-1234","crmFieldKey":"phone"},{"id":"elevate_date","type":"date","label":"Preferred Consultation Date","required":true,"crmFieldKey":"booking_date"},{"id":"elevate_consent","type":"checkbox","label":"HIPAA & Communications Consent","checkboxLabel":"I consent to receive SMS appointment notifications and agree to clinical policies.","required":true,"defaultChecked":false,"crmFieldKey":"consent_confirmed"}],"integrations":[{"id":"int_ghl_elevate","provider":"ghl","name":"GoHighLevel MedSpa Pipeline","enabled":true,"endpointUrl":"https://services.leadconnectorhq.com/hooks/custom-v2","targetResource":"loc_elevate_spa_99","apiKeyMasked":"ghl_live_••••••••••••55b7","fieldMappings":[{"formFieldId":"elevate_name","remoteFieldKey":"name"},{"formFieldId":"elevate_phone","remoteFieldKey":"phone"},{"formFieldId":"elevate_date","remoteFieldKey":"appointment_date"},{"formFieldId":"elevate_consent","remoteFieldKey":"consent_confirmed"}]}]}',
  '2026-11-06T00:00:00.000Z'
);

-- ------------------------------------------------------------------------------
-- 8. Seed Submissions & Delivery Audit Logs
-- ------------------------------------------------------------------------------

INSERT OR IGNORE INTO submissions (id, form_id, client_id, domain, values_json, url_params_json, submitted_at)
VALUES (
  'sub_acme_sample_1',
  'form_acme_quote',
  'client_acme',
  'forms.acmehomeservices.com',
  '{"acme_name":"Marcus Vance","acme_email":"marcus@vanceproperties.com","acme_phone":"(555) 349-8821","acme_service":"Full Installation","acme_budget":"12500","acme_utm":"google-cpc"}',
  '{"utm_source":"google-cpc","utm_campaign":"spring_hvac_promo","gclid":"CjwKCAiA2SampleGclidToken"}',
  '2026-11-06T10:15:30.000Z'
);

INSERT OR IGNORE INTO submission_deliveries (
  id, submission_id, client_id, integration_id, provider, integration_name,
  status, status_code, payload_json, response_message, timestamp
)
VALUES (
  'del_sub_acme_sample_1_1',
  'sub_acme_sample_1',
  'client_acme',
  'int_ghl_acme',
  'ghl',
  'GoHighLevel Lead Connector',
  'delivered',
  200,
  '{
  "full_name": "Marcus Vance",
  "email": "marcus@vanceproperties.com",
  "phone": "(555) 349-8821",
  "service_type": "Full Installation",
  "deal_value": "12500",
  "utm_source": "google-cpc",
  "_meta": {
    "clientId": "client_acme",
    "formSlug": "service-quote",
    "domain": "forms.acmehomeservices.com"
  }
}',
  '200 OK — Lead synced to Location loc_acme_home_01 (Contact ID: ghl_cnt_78912)',
  '2026-11-06T10:15:31.200Z'
);

INSERT OR IGNORE INTO submission_deliveries (
  id, submission_id, client_id, integration_id, provider, integration_name,
  status, status_code, payload_json, response_message, timestamp
)
VALUES (
  'del_sub_acme_sample_1_2',
  'sub_acme_sample_1',
  'client_acme',
  'int_zoho_acme',
  'zoho',
  'Zoho CRM Leads Module',
  'delivered',
  201,
  '{
  "Last_Name": "Marcus Vance",
  "Email": "marcus@vanceproperties.com",
  "Phone": "(555) 349-8821",
  "Lead_Source_Detail": "Full Installation",
  "_meta": {
    "clientId": "client_acme",
    "formSlug": "service-quote",
    "domain": "forms.acmehomeservices.com"
  }
}',
  '201 Created — Record created in Leads module (ID: 55490200001892019)',
  '2026-11-06T10:15:31.850Z'
);

INSERT OR IGNORE INTO submission_deliveries (
  id, submission_id, client_id, integration_id, provider, integration_name,
  status, status_code, payload_json, response_message, timestamp
)
VALUES (
  'del_sub_acme_sample_1_3',
  'sub_acme_sample_1',
  'client_acme',
  'int_airtable_acme',
  'airtable',
  'Airtable Dispatch Base',
  'failed',
  429,
  '{
  "fields": {
    "Client Name": "Marcus Vance",
    "Contact Email": "marcus@vanceproperties.com",
    "Direct Phone": "(555) 349-8821",
    "Requested Service": "Full Installation",
    "Estimated Budget": "12500"
  },
  "_meta": {
    "clientId": "client_acme",
    "formSlug": "service-quote",
    "domain": "forms.acmehomeservices.com"
  }
}',
  '429 Too Many Requests — Airtable rate limit exceeded (5 requests/sec). Stored in D1 ledger for retry.',
  '2026-11-06T10:15:32.400Z'
);

INSERT OR IGNORE INTO submissions (id, form_id, client_id, domain, values_json, url_params_json, submitted_at)
VALUES (
  'sub_apex_sample_1',
  'form_apex_demo',
  'client_apex',
  'intake.apexcloud.io',
  '{"apex_name":"Elena Rostova","apex_email":"elena.rostova@cloudscale.net","apex_company_size":"251-1000","apex_notes":"Evaluating multi-tenant database routing and automated failover for Q1 migration.","apex_utm":"linkedin-sponsored"}',
  '{"utm_source":"linkedin-sponsored","utm_medium":"cpc","utm_campaign":"enterprise_q4"}',
  '2026-11-06T11:42:10.000Z'
);

INSERT OR IGNORE INTO submission_deliveries (
  id, submission_id, client_id, integration_id, provider, integration_name,
  status, status_code, payload_json, response_message, timestamp
)
VALUES (
  'del_sub_apex_sample_1_1',
  'sub_apex_sample_1',
  'client_apex',
  'int_close_apex',
  'close',
  'Close CRM Leads & Opportunities',
  'delivered',
  200,
  '{
  "name": "Elena Rostova",
  "email": "elena.rostova@cloudscale.net",
  "custom.cf_company_size": "251-1000",
  "description": "Evaluating multi-tenant database routing and automated failover for Q1 migration.",
  "_meta": {
    "clientId": "client_apex",
    "formSlug": "enterprise-demo",
    "domain": "intake.apexcloud.io"
  }
}',
  '200 OK — Lead created (Lead ID: lead_9a7x81f0b)',
  '2026-11-06T11:42:11.100Z'
);

INSERT OR IGNORE INTO submission_deliveries (
  id, submission_id, client_id, integration_id, provider, integration_name,
  status, status_code, payload_json, response_message, timestamp
)
VALUES (
  'del_sub_apex_sample_1_2',
  'sub_apex_sample_1',
  'client_apex',
  'int_webhook_apex',
  'webhook',
  'n8n Enterprise Router Webhook',
  'delivered',
  200,
  '{
  "contact_name": "Elena Rostova",
  "work_email": "elena.rostova@cloudscale.net",
  "org_size": "251-1000",
  "project_brief": "Evaluating multi-tenant database routing and automated failover for Q1 migration.",
  "lead_source": "linkedin-sponsored",
  "_meta": {
    "clientId": "client_apex",
    "formSlug": "enterprise-demo",
    "domain": "intake.apexcloud.io"
  }
}',
  '200 OK — Webhook accepted by n8n workflow wf_lead_dispatch_v2',
  '2026-11-06T11:42:11.750Z'
);

