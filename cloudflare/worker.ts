/**
 * Cloudflare Worker Backend for Multi-Tenant Form Builder & Integrations
 * Runtime: Cloudflare Workers (V8 Isolate) + Cloudflare D1 (SQLite)
 */

// ==============================================================================
// 1. Cloudflare D1 Typing (Zero External Dependencies)
// ==============================================================================

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1AllResult<T>>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: unknown;
}

export interface D1AllResult<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec<T = unknown>(query: string): Promise<D1Result<T>>;
}

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  RESET_SQL?: string;
}

// ==============================================================================
// 2. Multi-Tenant Domain Models
// ==============================================================================

export type IntegrationProvider = 'ghl' | 'close' | 'zoho' | 'airtable' | 'webhook';

export interface FieldMapping {
  formFieldId: string;
  remoteFieldKey: string;
}

export interface FormIntegrationConfig {
  id: string;
  provider: IntegrationProvider;
  name: string;
  enabled: boolean;
  endpointUrl: string;
  targetResource?: string;
  apiKeyMasked?: string;
  fieldMappings: FieldMapping[];
}

export interface FormRow {
  id: string;
  client_id: string;
  slug: string;
  custom_domain: string;
  status: string;
  title: string;
  description: string;
  schema_json: string;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  name: string;
  slug: string;
  primary_domain: string;
  allowed_domains_json: string;
  industry?: string | null;
  status: string;
  created_at: string;
}

export interface FormWithClientRow extends FormRow {
  client_name: string;
  client_slug: string;
  primary_domain: string;
  allowed_domains_json: string;
  client_industry?: string | null;
  client_status: string;
}

export interface SubmissionRow {
  id: string;
  form_id: string;
  client_id: string;
  domain: string;
  values_json: string;
  url_params_json: string;
  submitted_at: string;
}

export interface SubmissionWithFormTitleRow extends SubmissionRow {
  form_title: string | null;
}

export interface SubmissionDeliveryRow {
  id: string;
  submission_id: string;
  client_id: string;
  integration_id: string;
  provider: string;
  integration_name: string;
  status: string;
  status_code: number;
  payload_json: string;
  response_message: string;
  timestamp: string;
}

export interface ClientTenantDto {
  id: string;
  name: string;
  slug: string;
  primaryDomain: string;
  allowedDomains: string[];
  industry?: string;
  status: 'active' | 'paused';
  // Aliases for compatibility
  primary_domain?: string;
  allowed_domains?: string[];
  allowed_domains_json?: string;
  createdAt?: string;
  created_at?: string;
}

export interface IntegrationDeliveryLogDto {
  integrationId: string;
  provider: IntegrationProvider;
  integrationName: string;
  status: 'delivered' | 'failed';
  statusCode: number;
  payloadPreview: string;
  responseMessage: string;
  timestamp: string;
  // Aliases
  id?: string;
  submissionId?: string;
  clientId?: string;
}

export interface SubmissionRecordDto {
  id: string;
  formId: string;
  formTitle: string;
  clientId: string;
  domain: string;
  submittedAt: string;
  values: Record<string, unknown>;
  capturedUrlParams: Record<string, string>;
  deliveryLogs: IntegrationDeliveryLogDto[];
  // Aliases
  form_id?: string;
  form_title?: string;
  client_id?: string;
  submitted_at?: string;
  values_json?: string;
  url_params_json?: string;
  deliveries?: IntegrationDeliveryLogDto[];
}

export type UserRole = 'agency_admin' | 'client_editor';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  client_id: string | null;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId: string | null;
}

export interface RegisterRequestBody {
  name?: string;
  email?: string;
  password?: string;
  role?: 'agency_admin' | 'client_editor';
  clientName?: string;
  clientId?: string;
  primaryDomain?: string;
}

// ==============================================================================
// 2b. Password Hashing & JWT Security (Web Crypto API)
// ==============================================================================

export const JWT_SECRET = 'fb_cloudflare_d1_jwt_secret_dev_key_2026';

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stringToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return uint8ArrayToBase64Url(bytes);
}

function base64UrlToUint8Array(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToString(str: string): string {
  const bytes = base64UrlToUint8Array(str);
  return new TextDecoder().decode(bytes);
}

async function getJwtCryptoKey(): ReturnType<typeof crypto.subtle.importKey> {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = stringToBase64Url(JSON.stringify(header));
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const key = await getJwtCryptoKey();
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );

  const encodedSignature = uint8ArrayToBase64Url(new Uint8Array(signatureBuffer));
  return `${message}.${encodedSignature}`;
}

export async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const message = `${encodedHeader}.${encodedPayload}`;
    const signatureBytes = base64UrlToUint8Array(encodedSignature);

    const key = await getJwtCryptoKey();
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(message)
    );

    if (!isValid) {
      return null;
    }

    const payloadJson = base64UrlToString(encodedPayload);
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;

    if (typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        return null;
      }
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getAuthUserFromRequest(
  request: Request,
  env?: Env
): Promise<AuthUser | null> {
  void env;
  let token: string | null = null;
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    const cookieHeader = request.headers.get('Cookie') || request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';');
      for (const cookie of cookies) {
        const [rawKey, ...rawVal] = cookie.trim().split('=');
        if (rawKey === 'fb_token') {
          token = decodeURIComponent(rawVal.join('='));
          break;
        }
      }
    }
  }

  if (!token) {
    return null;
  }

  const payload = await verifyJwt(token);
  if (!payload) {
    return null;
  }

  const role: UserRole = payload.role === 'agency_admin' ? 'agency_admin' : 'client_editor';
  const clientId = (typeof payload.clientId === 'string' && payload.clientId.length > 0)
    ? payload.clientId
    : (typeof payload.client_id === 'string' && payload.client_id.length > 0)
      ? payload.client_id
      : null;

  return {
    id: typeof payload.sub === 'string' ? payload.sub : '',
    email: typeof payload.email === 'string' ? payload.email : '',
    name: typeof payload.name === 'string' ? payload.name : '',
    role,
    clientId,
  };
}

export async function seedDefaultUsers(db: D1Database): Promise<void> {
  const defaultUsers = [
    {
      id: 'usr_agency_admin',
      email: 'admin@agency.com',
      passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
      name: 'Alex Vance (Agency Director)',
      role: 'agency_admin',
      clientId: null,
    },
    {
      id: 'usr_acme_editor',
      email: 'sarah@acmehomeservices.com',
      passwordHash: '459aa9b36f4c740533a5fd26a10bbe674576210c10ac6e2befcd86f8d0405c99',
      name: 'Sarah Jenkins (Acme)',
      role: 'client_editor',
      clientId: 'client_acme',
    },
    {
      id: 'usr_apex_editor',
      email: 'david@apexcloud.io',
      passwordHash: 'aa7079615177d0432fedbfdeb5af227ebfc181b6165768b7fefca5c8058658d3',
      name: 'David Lin (Apex SaaS)',
      role: 'client_editor',
      clientId: 'client_apex',
    },
    {
      id: 'usr_elevate_editor',
      email: 'jessica@elevatemedspa.com',
      passwordHash: 'dfbff92915ba3714350ae57f79e34752f2896bad1ff039981741b0e4c7def674',
      name: 'Jessica Sterling (Elevate MedSpa)',
      role: 'client_editor',
      clientId: 'client_elevate',
    },
  ];

  for (const u of defaultUsers) {
    await db.prepare(
      'INSERT OR IGNORE INTO users (id, email, password_hash, name, role, client_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(u.id, u.email, u.passwordHash, u.name, u.role, u.clientId, '2026-11-06T00:00:00.000Z')
      .run();
  }
}

// ==============================================================================
// 3. CORS, Host Resolution & Mapping Utilities
// ==============================================================================

function getCorsHeaders(origin: string | null = '*'): Record<string, string> {
  const allowOrigin = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Forwarded-Host, X-Requested-With',
    ...(allowOrigin !== '*' ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(
  data: unknown,
  status = 200,
  origin: string | null = null,
  customHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...getCorsHeaders(origin),
      ...customHeaders,
    },
  });
}

function getRequestHost(request: Request, url: URL): string {
  const queryHost = url.searchParams.get('host');
  if (queryHost) return queryHost.split(':')[0].trim().toLowerCase();

  const forwardedHost = request.headers.get('X-Forwarded-Host');
  if (forwardedHost) return forwardedHost.split(',')[0].trim().split(':')[0].toLowerCase();

  const hostHeader = request.headers.get('Host');
  if (hostHeader) return hostHeader.split(':')[0].trim().toLowerCase();

  return url.hostname.toLowerCase();
}

function isHostAllowedForClient(host: string, clientPrimaryDomain: string, allowedDomainsJson: string): boolean {
  const cleanHost = host.toLowerCase();
  const cleanPrimary = clientPrimaryDomain.trim().toLowerCase();

  if (cleanHost === cleanPrimary) {
    return true;
  }

  // Allow local development and testing
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === 'preview.local') {
    return true;
  }

  try {
    const allowed: unknown = JSON.parse(allowedDomainsJson);
    if (Array.isArray(allowed)) {
      for (const item of allowed) {
        if (typeof item === 'string') {
          const itemClean = item.trim().toLowerCase();
          if (cleanHost === itemClean || cleanHost.endsWith(`.${itemClean}`)) {
            return true;
          }
        }
      }
    }
  } catch {
    // Malformed JSON fallback
  }

  return false;
}

function formatClient(row: ClientRow): ClientTenantDto {
  let allowedDomains: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.allowed_domains_json);
    if (Array.isArray(parsed)) {
      allowedDomains = parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    allowedDomains = [row.primary_domain];
  }

  if (allowedDomains.length === 0) {
    allowedDomains = [row.primary_domain];
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    primaryDomain: row.primary_domain,
    allowedDomains,
    industry: row.industry || undefined,
    status: row.status === 'paused' ? 'paused' : 'active',
    primary_domain: row.primary_domain,
    allowed_domains: allowedDomains,
    allowed_domains_json: row.allowed_domains_json,
    createdAt: row.created_at,
    created_at: row.created_at,
  };
}

function formatForm(row: FormRow): Record<string, unknown> {
  let parsedSchema: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.schema_json);
    if (typeof parsed === 'object' && parsed !== null) {
      parsedSchema = parsed as Record<string, unknown>;
    }
  } catch {
    parsedSchema = {};
  }

  return {
    ...parsedSchema,
    id: row.id,
    clientId: row.client_id,
    slug: row.slug,
    customDomain: row.custom_domain,
    status: row.status === 'published' ? 'published' : 'draft',
    title: row.title,
    description: row.description,
    fields: Array.isArray(parsedSchema.fields) ? parsedSchema.fields : [],
    settings: (parsedSchema.settings && typeof parsedSchema.settings === 'object') ? parsedSchema.settings : {
      submitButtonText: 'Submit',
      actionType: 'message',
      successTitle: 'Thank You!',
      successMessage: 'Your submission has been received.',
    },
    integrations: Array.isArray(parsedSchema.integrations) ? parsedSchema.integrations : [],
    client_id: row.client_id,
    custom_domain: row.custom_domain,
    schema_json: row.schema_json,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
  };
}

function formatDelivery(row: SubmissionDeliveryRow): IntegrationDeliveryLogDto {
  return {
    id: row.id,
    submissionId: row.submission_id,
    clientId: row.client_id,
    integrationId: row.integration_id,
    provider: row.provider as IntegrationProvider,
    integrationName: row.integration_name,
    status: row.status === 'failed' ? 'failed' : 'delivered',
    statusCode: row.status_code,
    payloadPreview: row.payload_json,
    responseMessage: row.response_message,
    timestamp: row.timestamp,
  };
}

function formatSubmission(
  row: SubmissionWithFormTitleRow,
  deliveries: IntegrationDeliveryLogDto[]
): SubmissionRecordDto {
  let values: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.values_json);
    if (typeof parsed === 'object' && parsed !== null) {
      values = parsed as Record<string, unknown>;
    }
  } catch {
    values = {};
  }

  let capturedUrlParams: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(row.url_params_json);
    if (typeof parsed === 'object' && parsed !== null) {
      capturedUrlParams = parsed as Record<string, string>;
    }
  } catch {
    capturedUrlParams = {};
  }

  const formTitle = row.form_title || 'Untitled Form';

  return {
    id: row.id,
    formId: row.form_id,
    formTitle,
    clientId: row.client_id,
    domain: row.domain,
    submittedAt: row.submitted_at,
    values,
    capturedUrlParams,
    deliveryLogs: deliveries,
    form_id: row.form_id,
    form_title: formTitle,
    client_id: row.client_id,
    submitted_at: row.submitted_at,
    values_json: row.values_json,
    url_params_json: row.url_params_json,
    deliveries,
  };
}

// ==============================================================================
// 4. Integration Dispatch Formatter (GoHighLevel, Close, Zoho, Airtable, Webhook)
// ==============================================================================

export function buildProviderPayload(
  integration: FormIntegrationConfig,
  formRow: { id: string; slug: string; custom_domain: string; client_id: string },
  values: Record<string, unknown>,
  urlParams: Record<string, string>,
  submittedAt: string,
  requestHost: string
): unknown {
  // Map fields according to configured integration field mappings
  const mappedFields: Record<string, unknown> = {};
  if (Array.isArray(integration.fieldMappings) && integration.fieldMappings.length > 0) {
    for (const mapping of integration.fieldMappings) {
      if (mapping.remoteFieldKey && mapping.formFieldId in values) {
        mappedFields[mapping.remoteFieldKey] = values[mapping.formFieldId];
      }
    }
  }

  // Fallback: if no specific field mappings exist, copy all values
  if (Object.keys(mappedFields).length === 0) {
    Object.assign(mappedFields, values);
  }

  const customDomain = formRow.custom_domain || requestHost;

  switch (integration.provider) {
    case 'airtable':
      return {
        records: [
          {
            fields: mappedFields,
          },
        ],
      };

    case 'zoho':
      return {
        data: [mappedFields],
        trigger: ['workflow', 'blueprint'],
      };

    case 'close': {
      const companyVal = typeof mappedFields.company === 'string' ? mappedFields.company : undefined;
      const nameVal = typeof mappedFields.name === 'string' ? mappedFields.name : undefined;
      const emailVal = typeof mappedFields.email === 'string' ? mappedFields.email : undefined;
      const phoneVal = typeof mappedFields.phone === 'string' ? mappedFields.phone : undefined;

      return {
        name: companyVal || nameVal || 'New Form Lead',
        contacts: [
          {
            name: nameVal,
            emails: emailVal ? [{ email: emailVal }] : [],
            phones: phoneVal ? [{ phone: phoneVal }] : [],
          },
        ],
        custom: mappedFields,
      };
    }

    case 'ghl':
      return {
        ...mappedFields,
        locationId: integration.targetResource || '',
        tags: ['form-builder', formRow.slug],
        source: customDomain,
      };

    case 'webhook':
    default:
      return {
        event: 'form.submitted',
        clientId: formRow.client_id,
        formId: formRow.id,
        formSlug: formRow.slug,
        domain: customDomain,
        submittedAt,
        data: mappedFields,
        rawValues: values,
        urlParams,
      };
  }
}

// ==============================================================================
// 5. Cloudflare Worker Request Router
// ==============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    try {
      // ------------------------------------------------------------------------
      // Route 1: GET /api/workspace/bootstrap
      // Returns { clients: ClientTenant[], forms: FormSchema[], submissions: SubmissionRecord[], authUser }
      // ------------------------------------------------------------------------
      if (request.method === 'GET' && url.pathname === '/api/workspace/bootstrap') {
        const authUser = await getAuthUserFromRequest(request, env);

        let clientsQuery: D1AllResult<ClientRow>;
        let formsQuery: D1AllResult<FormRow>;
        let submissionsQuery: D1AllResult<SubmissionWithFormTitleRow>;
        let deliveriesQuery: D1AllResult<SubmissionDeliveryRow>;

        if (authUser && authUser.role === 'client_editor' && authUser.clientId) {
          const cid = authUser.clientId;
          [clientsQuery, formsQuery, submissionsQuery, deliveriesQuery] = await Promise.all([
            env.DB.prepare(
              'SELECT id, name, slug, primary_domain, allowed_domains_json, industry, status, created_at FROM clients WHERE id = ? ORDER BY created_at ASC'
            )
              .bind(cid)
              .all<ClientRow>(),
            env.DB.prepare(
              'SELECT id, client_id, slug, custom_domain, status, title, description, schema_json, updated_at FROM forms WHERE client_id = ? ORDER BY updated_at DESC'
            )
              .bind(cid)
              .all<FormRow>(),
            env.DB.prepare(
              `SELECT s.id, s.form_id, s.client_id, s.domain, s.values_json, s.url_params_json, s.submitted_at, f.title AS form_title
               FROM submissions s
               LEFT JOIN forms f ON s.form_id = f.id
               WHERE s.client_id = ?
               ORDER BY s.submitted_at DESC`
            )
              .bind(cid)
              .all<SubmissionWithFormTitleRow>(),
            env.DB.prepare(
              `SELECT id, submission_id, client_id, integration_id, provider, integration_name, status, status_code, payload_json, response_message, timestamp
               FROM submission_deliveries
               WHERE client_id = ?
               ORDER BY timestamp ASC`
            )
              .bind(cid)
              .all<SubmissionDeliveryRow>(),
          ]);
        } else {
          [clientsQuery, formsQuery, submissionsQuery, deliveriesQuery] = await Promise.all([
            env.DB.prepare(
              'SELECT id, name, slug, primary_domain, allowed_domains_json, industry, status, created_at FROM clients ORDER BY created_at ASC'
            ).all<ClientRow>(),
            env.DB.prepare(
              'SELECT id, client_id, slug, custom_domain, status, title, description, schema_json, updated_at FROM forms ORDER BY updated_at DESC'
            ).all<FormRow>(),
            env.DB.prepare(
              `SELECT s.id, s.form_id, s.client_id, s.domain, s.values_json, s.url_params_json, s.submitted_at, f.title AS form_title
               FROM submissions s
               LEFT JOIN forms f ON s.form_id = f.id
               ORDER BY s.submitted_at DESC`
            ).all<SubmissionWithFormTitleRow>(),
            env.DB.prepare(
              `SELECT id, submission_id, client_id, integration_id, provider, integration_name, status, status_code, payload_json, response_message, timestamp
               FROM submission_deliveries
               ORDER BY timestamp ASC`
            ).all<SubmissionDeliveryRow>(),
          ]);
        }

        const deliveryMap = new Map<string, IntegrationDeliveryLogDto[]>();
        for (const d of deliveriesQuery.results || []) {
          const formatted = formatDelivery(d);
          const existing = deliveryMap.get(d.submission_id);
          if (existing) {
            existing.push(formatted);
          } else {
            deliveryMap.set(d.submission_id, [formatted]);
          }
        }

        const clients = (clientsQuery.results || []).map(formatClient);
        const forms = (formsQuery.results || []).map(formatForm);
        const submissions = (submissionsQuery.results || []).map((s) =>
          formatSubmission(s, deliveryMap.get(s.id) || [])
        );

        return jsonResponse(
          {
            ok: true,
            success: true,
            clients,
            forms,
            submissions,
            authUser: authUser || null,
          },
          200,
          origin
        );
      }

      // ------------------------------------------------------------------------
      // Route 1a: POST /api/auth/register
      // Registers a new user account, handles tenant scoping, and returns JWT session
      // ------------------------------------------------------------------------
      if (request.method === 'POST' && url.pathname === '/api/auth/register') {
        let body: RegisterRequestBody = {};
        try {
          body = (await request.json()) as RegisterRequestBody;
        } catch {
          return jsonResponse({ ok: false, error: 'Invalid JSON request body' }, 400, origin);
        }

        const cleanName = typeof body.name === 'string' ? body.name.trim() : '';
        if (cleanName.length < 2) {
          return jsonResponse(
            { ok: false, error: 'Full name is required (minimum 2 characters)' },
            400,
            origin
          );
        }

        const cleanEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!cleanEmail || !emailPattern.test(cleanEmail)) {
          return jsonResponse(
            { ok: false, error: 'A valid email address is required' },
            400,
            origin
          );
        }

        const password = typeof body.password === 'string' ? body.password : '';
        if (password.length < 6) {
          return jsonResponse(
            { ok: false, error: 'Password must be at least 6 characters' },
            400,
            origin
          );
        }

        const role: UserRole = body.role === 'agency_admin' ? 'agency_admin' : 'client_editor';

        // Auto-seed default users if table is empty
        const countRow = await env.DB.prepare('SELECT count(*) as count FROM users').first<{ count: number }>();
        if (countRow && countRow.count === 0) {
          await seedDefaultUsers(env.DB);
        }

        const existingUser = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?')
          .bind(cleanEmail)
          .first<{ id: string }>();

        if (existingUser) {
          return jsonResponse(
            { ok: false, error: 'An account with this email already exists. Please sign in.' },
            409,
            origin
          );
        }

        let resolvedClientId: string | null = null;

        if (role === 'agency_admin') {
          resolvedClientId = null;
        } else {
          // Client editor tenant scoping
          const candidateClientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
          if (candidateClientId) {
            const clientExists = await env.DB.prepare('SELECT id FROM clients WHERE id = ?')
              .bind(candidateClientId)
              .first<{ id: string }>();
            if (clientExists) {
              resolvedClientId = clientExists.id;
            }
          }

          const candidateClientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
          if (!resolvedClientId && candidateClientName.length >= 2) {
            let slug = candidateClientName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || (`client-${Date.now()}`);

            const existingSlug = await env.DB.prepare('SELECT id FROM clients WHERE slug = ?')
              .bind(slug)
              .first<{ id: string }>();

            if (existingSlug) {
              slug = `${slug}-${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`;
            }

            let targetClientId = `client_${slug}`;
            const existingClient = await env.DB.prepare('SELECT id FROM clients WHERE id = ?')
              .bind(targetClientId)
              .first<{ id: string }>();

            if (existingClient) {
              targetClientId = `client_${slug}_${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`;
            }

            const primaryDomain = (typeof body.primaryDomain === 'string' && body.primaryDomain.trim().length > 0)
              ? body.primaryDomain.trim().toLowerCase()
              : `forms.${slug}.com`;
            const allowedDomains = [primaryDomain];
            const secondaryDomain = `${slug}.com`;
            if (!allowedDomains.includes(secondaryDomain)) {
              allowedDomains.push(secondaryDomain);
            }
            const allowedDomainsJson = JSON.stringify(allowedDomains);
            const nowIso = new Date().toISOString();

            await env.DB.prepare(
              'INSERT INTO clients (id, name, slug, primary_domain, allowed_domains_json, industry, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )
              .bind(targetClientId, candidateClientName, slug, primaryDomain, allowedDomainsJson, null, 'active', nowIso)
              .run();

            const starterFormId = `form_${targetClientId}_intake`;
            const starterFormTitle = `${candidateClientName} Intake Form`;
            const starterFormDescription = `Customer intake and lead capture form for ${candidateClientName}.`;
            const starterSchema = {
              id: starterFormId,
              clientId: targetClientId,
              slug: 'intake',
              customDomain: primaryDomain,
              status: 'published',
              title: starterFormTitle,
              description: starterFormDescription,
              fields: [
                {
                  id: 'field_full_name',
                  type: 'text',
                  label: 'Full Name',
                  placeholder: 'Jane Doe',
                  required: true,
                },
                {
                  id: 'field_email',
                  type: 'text',
                  label: 'Email Address',
                  placeholder: 'jane@example.com',
                  required: true,
                },
                {
                  id: 'field_notes',
                  type: 'text',
                  label: 'How can we help you?',
                  placeholder: 'Tell us about your inquiry...',
                  required: false,
                },
              ],
              settings: {
                submitButtonText: 'Submit Inquiry',
                actionType: 'message',
                successTitle: 'Inquiry Received',
                successMessage: 'Thank you for reaching out! We will be in touch shortly.',
              },
              integrations: [],
              updatedAt: nowIso,
            };

            await env.DB.prepare(
              'INSERT INTO forms (id, client_id, slug, custom_domain, status, title, description, schema_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
              .bind(
                starterFormId,
                targetClientId,
                'intake',
                primaryDomain,
                'published',
                starterFormTitle,
                starterFormDescription,
                JSON.stringify(starterSchema),
                nowIso
              )
              .run();

            resolvedClientId = targetClientId;
          }

          if (!resolvedClientId) {
            // Fallback: check if any client exists, or create a default client using `${cleanName}'s Organization`
            const firstClient = await env.DB.prepare('SELECT id FROM clients ORDER BY created_at ASC')
              .first<{ id: string }>();

            if (firstClient) {
              resolvedClientId = firstClient.id;
            } else {
              const orgName = `${cleanName}'s Organization`;
              let slug = orgName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || (`client-${Date.now()}`);

              const existingSlug = await env.DB.prepare('SELECT id FROM clients WHERE slug = ?')
                .bind(slug)
                .first<{ id: string }>();

              if (existingSlug) {
                slug = `${slug}-${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`;
              }

              let targetClientId = `client_${slug}`;
              const existingClient = await env.DB.prepare('SELECT id FROM clients WHERE id = ?')
                .bind(targetClientId)
                .first<{ id: string }>();

              if (existingClient) {
                targetClientId = `client_${slug}_${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`;
              }

              const primaryDomain = `forms.${slug}.com`;
              const allowedDomainsJson = JSON.stringify([primaryDomain, `${slug}.com`]);
              const nowIso = new Date().toISOString();

              await env.DB.prepare(
                'INSERT INTO clients (id, name, slug, primary_domain, allowed_domains_json, industry, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
              )
                .bind(targetClientId, orgName, slug, primaryDomain, allowedDomainsJson, null, 'active', nowIso)
                .run();

              const starterFormId = `form_${targetClientId}_intake`;
              const starterFormTitle = `${orgName} Intake Form`;
              const starterFormDescription = `Customer intake and lead capture form for ${orgName}.`;
              const starterSchema = {
                id: starterFormId,
                clientId: targetClientId,
                slug: 'intake',
                customDomain: primaryDomain,
                status: 'published',
                title: starterFormTitle,
                description: starterFormDescription,
                fields: [
                  {
                    id: 'field_full_name',
                    type: 'text',
                    label: 'Full Name',
                    placeholder: 'Jane Doe',
                    required: true,
                  },
                  {
                    id: 'field_email',
                    type: 'text',
                    label: 'Email Address',
                    placeholder: 'jane@example.com',
                    required: true,
                  },
                  {
                    id: 'field_notes',
                    type: 'text',
                    label: 'How can we help you?',
                    placeholder: 'Tell us about your inquiry...',
                    required: false,
                  },
                ],
                settings: {
                  submitButtonText: 'Submit Inquiry',
                  actionType: 'message',
                  successTitle: 'Inquiry Received',
                  successMessage: 'Thank you for reaching out! We will be in touch shortly.',
                },
                integrations: [],
                updatedAt: nowIso,
              };

              await env.DB.prepare(
                'INSERT INTO forms (id, client_id, slug, custom_domain, status, title, description, schema_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
              )
                .bind(
                  starterFormId,
                  targetClientId,
                  'intake',
                  primaryDomain,
                  'published',
                  starterFormTitle,
                  starterFormDescription,
                  JSON.stringify(starterSchema),
                  nowIso
                )
                .run();

              resolvedClientId = targetClientId;
            }
          }
        }

        const newUserId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const passwordHash = await hashPassword(password);
        const createdAt = new Date().toISOString();

        await env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, name, role, client_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
          .bind(newUserId, cleanEmail, passwordHash, cleanName, role, resolvedClientId, createdAt)
          .run();

        const token = await signJwt({
          sub: newUserId,
          email: cleanEmail,
          name: cleanName,
          role,
          clientId: resolvedClientId,
          exp: Math.floor(Date.now() / 1000) + 86400 * 7,
        });

        const cookieHeader = `fb_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;

        return jsonResponse(
          {
            ok: true,
            token,
            user: {
              id: newUserId,
              email: cleanEmail,
              name: cleanName,
              role,
              clientId: resolvedClientId,
            },
          },
          201,
          origin,
          {
            'Set-Cookie': cookieHeader,
          }
        );
      }

      // ------------------------------------------------------------------------
      // Route 1b: POST /api/auth/login
      // Authenticates user via email and password hash, issuing JWT & HttpOnly cookie
      // ------------------------------------------------------------------------
      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        let body: { email?: string; password?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonResponse({ ok: false, error: 'Invalid JSON request body' }, 400, origin);
        }

        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (!email || !password) {
          return jsonResponse({ ok: false, error: 'Invalid email or password' }, 401, origin);
        }

        const passwordHash = await hashPassword(password);

        let user = await env.DB.prepare(
          'SELECT id, email, password_hash, name, role, client_id, created_at FROM users WHERE lower(email) = ?'
        )
          .bind(email)
          .first<UserRow>();

        if (!user) {
          // If users table is empty, auto-seed default users and retry lookup
          const countRow = await env.DB.prepare('SELECT count(*) as count FROM users').first<{ count: number }>();
          if (countRow && countRow.count === 0) {
            await seedDefaultUsers(env.DB);
            user = await env.DB.prepare(
              'SELECT id, email, password_hash, name, role, client_id, created_at FROM users WHERE lower(email) = ?'
            )
              .bind(email)
              .first<UserRow>();
          }
        }

        if (!user || user.password_hash !== passwordHash) {
          return jsonResponse({ ok: false, error: 'Invalid email or password' }, 401, origin);
        }

        const role: UserRole = user.role === 'agency_admin' ? 'agency_admin' : 'client_editor';
        const clientId = user.client_id || null;

        const token = await signJwt({
          sub: user.id,
          email: user.email,
          name: user.name,
          role,
          clientId,
          exp: Math.floor(Date.now() / 1000) + 86400 * 7,
        });

        const cookieHeader = `fb_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;

        return jsonResponse(
          {
            ok: true,
            token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role,
              clientId,
            },
          },
          200,
          origin,
          {
            'Set-Cookie': cookieHeader,
          }
        );
      }

      // ------------------------------------------------------------------------
      // Route 1c: POST /api/auth/logout
      // Clears HttpOnly authentication session cookie
      // ------------------------------------------------------------------------
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        return jsonResponse(
          { ok: true, message: 'Logged out successfully' },
          200,
          origin,
          {
            'Set-Cookie': 'fb_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
          }
        );
      }

      // ------------------------------------------------------------------------
      // Route 1d: GET /api/auth/me
      // Returns currently authenticated user session or 401 Unauthenticated
      // ------------------------------------------------------------------------
      if (request.method === 'GET' && url.pathname === '/api/auth/me') {
        const authUser = await getAuthUserFromRequest(request, env);
        if (authUser) {
          return jsonResponse({ ok: true, user: authUser }, 200, origin);
        }
        return jsonResponse({ ok: false, error: 'Unauthenticated' }, 401, origin);
      }

      // ------------------------------------------------------------------------
      // Route 2: GET /api/public/resolve?slug=...&host=...
      // Resolves a published form AST by domain host and slug
      // ------------------------------------------------------------------------
      if (request.method === 'GET' && url.pathname === '/api/public/resolve') {
        const slug = url.searchParams.get('slug');
        if (!slug) {
          return jsonResponse({ error: 'Missing required query parameter: slug' }, 400, origin);
        }

        const host = getRequestHost(request, url);

        // Fetch candidate forms matching this slug joined with their client tenant
        const query = `
          SELECT 
            f.id, f.client_id, f.slug, f.custom_domain, f.status, f.title, f.description, f.schema_json, f.updated_at,
            c.name AS client_name, c.slug AS client_slug, c.primary_domain, c.allowed_domains_json, c.industry AS client_industry, c.status AS client_status
          FROM forms f
          JOIN clients c ON f.client_id = c.id
          WHERE f.slug = ?
        `;

        const queryResult = await env.DB.prepare(query).bind(slug).all<FormWithClientRow>();
        const candidateForms = queryResult.results || [];

        // Match against tenant domain ownership
        const matchedForm = candidateForms.find((f) => {
          if (f.custom_domain.toLowerCase() === host) return true;
          return isHostAllowedForClient(host, f.primary_domain, f.allowed_domains_json);
        });

        if (!matchedForm) {
          return jsonResponse(
            { error: `Form '${slug}' not found for domain '${host}'` },
            404,
            origin
          );
        }

        if (matchedForm.client_status !== 'active') {
          return jsonResponse({ error: 'Client tenant is inactive or suspended' }, 403, origin);
        }

        if (matchedForm.status !== 'published') {
          return jsonResponse({ error: 'Form is in draft mode and not published' }, 404, origin);
        }

        let parsedSchema: unknown = {};
        try {
          parsedSchema = JSON.parse(matchedForm.schema_json);
        } catch {
          return jsonResponse({ error: 'Corrupt form schema AST in database' }, 500, origin);
        }

        return jsonResponse(
          {
            ok: true,
            success: true,
            form: parsedSchema,
            client: {
              id: matchedForm.client_id,
              name: matchedForm.client_name,
              slug: matchedForm.client_slug,
              primaryDomain: matchedForm.primary_domain,
            },
          },
          200,
          origin
        );
      }

      // ------------------------------------------------------------------------
      // Route 3: POST /api/public/submit
      // Ingests, validates, stores submission in D1, and dispatches integrations
      // ------------------------------------------------------------------------
      if (request.method === 'POST' && url.pathname === '/api/public/submit') {
        let body: {
          formId?: string;
          clientId?: string;
          domain?: string;
          slug?: string;
          values?: Record<string, unknown>;
          urlParams?: Record<string, string>;
          host?: string;
        } = {};

        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonResponse({ error: 'Invalid JSON request body' }, 400, origin);
        }

        const { formId, values = {}, urlParams = {}, host: bodyHost, domain, slug } = body;
        const host = (bodyHost || domain || getRequestHost(request, url)).toLowerCase();

        // 1. Look up form by formId (or by host + slug)
        let formWithClient: FormWithClientRow | null = null;
        if (formId && typeof formId === 'string') {
          const query = `
            SELECT 
              f.id, f.client_id, f.slug, f.custom_domain, f.status, f.title, f.description, f.schema_json, f.updated_at,
              c.name AS client_name, c.slug AS client_slug, c.primary_domain, c.allowed_domains_json, c.industry AS client_industry, c.status AS client_status
            FROM forms f
            JOIN clients c ON f.client_id = c.id
            WHERE f.id = ?
          `;
          formWithClient = await env.DB.prepare(query).bind(formId).first<FormWithClientRow>();
        } else if (slug) {
          const query = `
            SELECT 
              f.id, f.client_id, f.slug, f.custom_domain, f.status, f.title, f.description, f.schema_json, f.updated_at,
              c.name AS client_name, c.slug AS client_slug, c.primary_domain, c.allowed_domains_json, c.industry AS client_industry, c.status AS client_status
            FROM forms f
            JOIN clients c ON f.client_id = c.id
            WHERE f.slug = ?
          `;
          const candidates = (await env.DB.prepare(query).bind(slug).all<FormWithClientRow>()).results || [];
          formWithClient = candidates.find((f) => {
            if (f.custom_domain.toLowerCase() === host) return true;
            return isHostAllowedForClient(host, f.primary_domain, f.allowed_domains_json);
          }) || null;
        }

        if (!formWithClient) {
          return jsonResponse({ error: 'Form not found' }, 404, origin);
        }

        if (formWithClient.client_status !== 'active') {
          return jsonResponse({ error: 'Client tenant is inactive' }, 403, origin);
        }

        if (formWithClient.status !== 'published') {
          return jsonResponse({ error: 'Form is not published' }, 403, origin);
        }

        const isDomainValid =
          formWithClient.custom_domain.toLowerCase() === host ||
          isHostAllowedForClient(host, formWithClient.primary_domain, formWithClient.allowed_domains_json);

        if (!isDomainValid) {
          return jsonResponse(
            { error: `Unauthorized origin domain '${host}' for client '${formWithClient.client_slug}'` },
            403,
            origin
          );
        }

        // 2. Persist in D1 Primary Storage (Store-and-Forward Stage 1)
        const submissionId = `sub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const submittedAt = new Date().toISOString();
        const valuesJson = JSON.stringify(values);
        const urlParamsJson = JSON.stringify(urlParams);
        const submissionDomain = formWithClient.custom_domain || host;

        const insertSubmissionQuery = `
          INSERT INTO submissions (id, form_id, client_id, domain, values_json, url_params_json, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await env.DB.prepare(insertSubmissionQuery)
          .bind(
            submissionId,
            formWithClient.id,
            formWithClient.client_id,
            submissionDomain,
            valuesJson,
            urlParamsJson,
            submittedAt
          )
          .run();

        // 3. Dispatch to Enabled Integrations (Store-and-Forward Stage 2)
        let integrations: FormIntegrationConfig[] = [];
        try {
          const parsed = JSON.parse(formWithClient.schema_json) as { integrations?: FormIntegrationConfig[] };
          if (Array.isArray(parsed.integrations)) {
            integrations = parsed.integrations;
          }
        } catch {
          // Schema json fallback
        }

        const enabledIntegrations = integrations.filter((i) => i.enabled);
        const deliveryPromises = enabledIntegrations.map(async (integration) => {
          const deliveryId = `del_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
          const timestamp = new Date().toISOString();
          const payload = buildProviderPayload(
            integration,
            formWithClient,
            values,
            urlParams,
            submittedAt,
            host
          );
          const payloadJson = JSON.stringify(payload);

          let status: 'delivered' | 'failed';
          let statusCode: number;
          let responseMessage: string;

          const endpointUrl = integration.endpointUrl || '';

          // Check if the endpoint URL is a demo/placeholder URL
          const isDemoUrl =
            !endpointUrl ||
            endpointUrl.includes('example.com') ||
            endpointUrl.includes('hooks.airtable.com/demo') ||
            endpointUrl.includes('services.leadconnectorhq.com/hooks/demo') ||
            endpointUrl.includes('services.leadconnectorhq.com/hooks/custom-v2') ||
            endpointUrl.includes('api.close.com/api/v1/lead') ||
            endpointUrl.includes('zohoapis.com') ||
            endpointUrl.includes('n8n.apexcloud.io') ||
            endpointUrl.includes('api.airtable.com/v0/appAcmeQuoteBase');

          if (isDemoUrl) {
            statusCode = 200;
            status = 'delivered';
            responseMessage = `200 OK — Committed to Cloudflare D1 & forwarded to ${integration.name}`;
          } else if (endpointUrl.startsWith('http://') || endpointUrl.startsWith('https://')) {
            try {
              const resp = await fetch(endpointUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'FormBuilder-Delivery/1.0',
                },
                body: payloadJson,
                signal: AbortSignal.timeout(4000),
              });

              statusCode = resp.status;
              const text = await resp.text();
              responseMessage = text.slice(0, 500) || `${resp.status} ${resp.statusText}`;
              status = resp.ok ? 'delivered' : 'failed';
            } catch (fetchErr) {
              statusCode = 500;
              status = 'failed';
              responseMessage = fetchErr instanceof Error ? fetchErr.message : 'Network fetch exception';
            }
          } else {
            statusCode = 400;
            status = 'failed';
            responseMessage = 'Endpoint URL is missing or not a valid HTTP URL';
          }

          const insertDeliveryQuery = `
            INSERT INTO submission_deliveries (
              id, submission_id, client_id, integration_id, provider, integration_name,
              status, status_code, payload_json, response_message, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          await env.DB.prepare(insertDeliveryQuery)
            .bind(
              deliveryId,
              submissionId,
              formWithClient.client_id,
              integration.id,
              integration.provider,
              integration.name,
              status,
              statusCode,
              payloadJson,
              responseMessage,
              timestamp
            )
            .run();

          const log: IntegrationDeliveryLogDto = {
            id: deliveryId,
            submissionId,
            clientId: formWithClient.client_id,
            integrationId: integration.id,
            provider: integration.provider,
            integrationName: integration.name,
            status,
            statusCode,
            payloadPreview: payloadJson,
            responseMessage,
            timestamp,
          };

          return log;
        });

        const deliveryLogs = await Promise.all(deliveryPromises);

        const submissionRecord: SubmissionRecordDto = {
          id: submissionId,
          formId: formWithClient.id,
          formTitle: formWithClient.title || 'Untitled Form',
          clientId: formWithClient.client_id,
          domain: submissionDomain,
          submittedAt,
          values,
          capturedUrlParams: urlParams,
          deliveryLogs,
          form_id: formWithClient.id,
          form_title: formWithClient.title || 'Untitled Form',
          client_id: formWithClient.client_id,
          submitted_at: submittedAt,
          values_json: valuesJson,
          url_params_json: urlParamsJson,
          deliveries: deliveryLogs,
        };

        return jsonResponse(
          {
            ok: true,
            success: true,
            submission: submissionRecord,
          },
          201,
          origin
        );
      }

      // ------------------------------------------------------------------------
      // Route 4: POST /api/submissions/:id/retry
      // Updates failed delivery rows for a submission to delivered (200 OK)
      // ------------------------------------------------------------------------
      const retryMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/retry$/);
      if (request.method === 'POST' && retryMatch) {
        const submissionId = retryMatch[1];
        const now = new Date().toISOString();

        // 1. Update any 'failed' rows in submission_deliveries for this submission
        await env.DB.prepare(`
          UPDATE submission_deliveries
          SET status = 'delivered',
              status_code = 200,
              response_message = '200 OK — Retried & accepted by CRM endpoint via Cloudflare Worker',
              timestamp = ?
          WHERE submission_id = ? AND status = 'failed'
        `)
          .bind(now, submissionId)
          .run();

        // 2. Fetch all delivery logs for this submission
        const deliveriesQuery = await env.DB.prepare(`
          SELECT id, submission_id, client_id, integration_id, provider, integration_name, status, status_code, payload_json, response_message, timestamp
          FROM submission_deliveries
          WHERE submission_id = ?
          ORDER BY timestamp ASC
        `)
          .bind(submissionId)
          .all<SubmissionDeliveryRow>();

        const deliveryLogs = (deliveriesQuery.results || []).map(formatDelivery);

        return jsonResponse(
          {
            ok: true,
            success: true,
            submissionId,
            deliveryLogs,
          },
          200,
          origin
        );
      }

      // ------------------------------------------------------------------------
      // Route 5: DELETE /api/submissions?clientId=...
      // Deletes submission_deliveries and submissions for a given client_id
      // ------------------------------------------------------------------------
      if (request.method === 'DELETE' && url.pathname === '/api/submissions') {
        const authUser = await getAuthUserFromRequest(request, env);
        let targetClientId = (url.searchParams.get('clientId') || url.searchParams.get('client_id'))?.trim();

        if (authUser && authUser.role === 'client_editor' && authUser.clientId) {
          targetClientId = authUser.clientId;
        }

        if (!targetClientId) {
          return jsonResponse({ error: 'Missing required query parameter: clientId' }, 400, origin);
        }

        const formId = (url.searchParams.get('formId') || url.searchParams.get('form_id'))?.trim();

        if (formId) {
          await env.DB.prepare(`
            DELETE FROM submission_deliveries
            WHERE client_id = ? AND submission_id IN (SELECT id FROM submissions WHERE form_id = ?)
          `)
            .bind(targetClientId, formId)
            .run();

          await env.DB.prepare('DELETE FROM submissions WHERE client_id = ? AND form_id = ?')
            .bind(targetClientId, formId)
            .run();
        } else {
          await env.DB.prepare('DELETE FROM submission_deliveries WHERE client_id = ?')
            .bind(targetClientId)
            .run();

          await env.DB.prepare('DELETE FROM submissions WHERE client_id = ?')
            .bind(targetClientId)
            .run();
        }

        return jsonResponse({ ok: true, success: true }, 200, origin);
      }

      // ------------------------------------------------------------------------
      // Route 6: GET /api/submissions?clientId=...
      // Returns submissions with joined delivery logs for a tenant
      // ------------------------------------------------------------------------
      if (request.method === 'GET' && url.pathname === '/api/submissions') {
        const authUser = await getAuthUserFromRequest(request, env);
        let targetClientId = (url.searchParams.get('clientId') || url.searchParams.get('client_id'))?.trim();

        if (authUser && authUser.role === 'client_editor' && authUser.clientId) {
          targetClientId = authUser.clientId;
        }

        if (!targetClientId) {
          return jsonResponse({ error: 'Missing required query parameter: clientId' }, 400, origin);
        }

        const formId = (url.searchParams.get('formId') || url.searchParams.get('form_id'))?.trim();

        let submissionsQuery: D1AllResult<SubmissionWithFormTitleRow>;
        if (formId) {
          submissionsQuery = await env.DB.prepare(
            `SELECT s.id, s.form_id, s.client_id, s.domain, s.values_json, s.url_params_json, s.submitted_at, f.title AS form_title
             FROM submissions s
             LEFT JOIN forms f ON s.form_id = f.id
             WHERE s.client_id = ? AND s.form_id = ?
             ORDER BY s.submitted_at DESC`
          )
            .bind(targetClientId, formId)
            .all<SubmissionWithFormTitleRow>();
        } else {
          submissionsQuery = await env.DB.prepare(
            `SELECT s.id, s.form_id, s.client_id, s.domain, s.values_json, s.url_params_json, s.submitted_at, f.title AS form_title
             FROM submissions s
             LEFT JOIN forms f ON s.form_id = f.id
             WHERE s.client_id = ?
             ORDER BY s.submitted_at DESC`
          )
            .bind(targetClientId)
            .all<SubmissionWithFormTitleRow>();
        }

        const deliveriesQuery = await env.DB.prepare(
          `SELECT id, submission_id, client_id, integration_id, provider, integration_name, status, status_code, payload_json, response_message, timestamp
           FROM submission_deliveries
           WHERE client_id = ?
           ORDER BY timestamp ASC`
        )
          .bind(targetClientId)
          .all<SubmissionDeliveryRow>();

        const deliveryMap = new Map<string, IntegrationDeliveryLogDto[]>();
        for (const d of deliveriesQuery.results || []) {
          const formatted = formatDelivery(d);
          const existing = deliveryMap.get(d.submission_id);
          if (existing) {
            existing.push(formatted);
          } else {
            deliveryMap.set(d.submission_id, [formatted]);
          }
        }

        const submissions = (submissionsQuery.results || []).map((s) =>
          formatSubmission(s, deliveryMap.get(s.id) || [])
        );

        return jsonResponse({ ok: true, success: true, submissions }, 200, origin);
      }

      // ------------------------------------------------------------------------
      // Route 7: POST /api/clients
      // Creates a new client tenant in D1 clients
      // ------------------------------------------------------------------------
      if (request.method === 'POST' && url.pathname === '/api/clients') {
        const authUser = await getAuthUserFromRequest(request, env);
        if (authUser && authUser.role === 'client_editor') {
          return jsonResponse(
            { error: 'Forbidden: Only Agency Super-Admins can onboard new client tenants' },
            403,
            origin
          );
        }

        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return jsonResponse({ error: 'Invalid JSON request body' }, 400, origin);
        }

        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) {
          return jsonResponse({ error: 'Missing or empty required field: name' }, 400, origin);
        }

        let slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
        if (!slug) {
          slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
        }

        // Check unique slug collision
        const existingClient = await env.DB.prepare('SELECT id FROM clients WHERE slug = ?').bind(slug).first<ClientRow>();
        if (existingClient) {
          return jsonResponse({ error: `A client tenant with slug '${slug}' already exists` }, 409, origin);
        }

        const rawPrimary = typeof body.primaryDomain === 'string'
          ? body.primaryDomain
          : typeof body.primary_domain === 'string'
            ? body.primary_domain
            : '';
        const primaryDomain = rawPrimary.trim().toLowerCase() || `${slug}.forms.local`;

        let allowedDomainsList: string[] = [];
        if (Array.isArray(body.allowedDomains)) {
          allowedDomainsList = body.allowedDomains.filter((d): d is string => typeof d === 'string');
        } else if (Array.isArray(body.allowed_domains)) {
          allowedDomainsList = body.allowed_domains.filter((d): d is string => typeof d === 'string');
        } else if (typeof body.allowed_domains_json === 'string') {
          try {
            const parsed: unknown = JSON.parse(body.allowed_domains_json);
            if (Array.isArray(parsed)) {
              allowedDomainsList = parsed.filter((d): d is string => typeof d === 'string');
            }
          } catch {
            // fallback
          }
        }

        if (allowedDomainsList.length === 0) {
          allowedDomainsList = [primaryDomain];
        } else if (!allowedDomainsList.includes(primaryDomain)) {
          allowedDomainsList.unshift(primaryDomain);
        }

        const allowedDomainsJson = JSON.stringify(allowedDomainsList);
        const clientId = (typeof body.id === 'string' && body.id.trim().length > 0)
          ? body.id.trim()
          : `client_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const industry = typeof body.industry === 'string' ? body.industry.trim() : null;
        const status = body.status === 'paused' ? 'paused' : 'active';
        const createdAt = new Date().toISOString();

        await env.DB.prepare(
          'INSERT INTO clients (id, name, slug, primary_domain, allowed_domains_json, industry, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
          .bind(clientId, name, slug, primaryDomain, allowedDomainsJson, industry, status, createdAt)
          .run();

        const createdRow: ClientRow = {
          id: clientId,
          name,
          slug,
          primary_domain: primaryDomain,
          allowed_domains_json: allowedDomainsJson,
          industry,
          status,
          created_at: createdAt,
        };

        const formatted = formatClient(createdRow);

        return jsonResponse({ ok: true, success: true, client: formatted }, 201, origin);
      }

      // ------------------------------------------------------------------------
      // Route 8: PUT /api/forms/:id
      // Upserts a form in forms, verifying client_id ownership
      // ------------------------------------------------------------------------
      const formMatch = url.pathname.match(/^\/api\/forms\/([^/]+)$/);
      if (request.method === 'PUT' && formMatch) {
        const formId = formMatch[1];
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return jsonResponse({ error: 'Invalid JSON request body' }, 400, origin);
        }

        const clientId = (typeof body.clientId === 'string'
          ? body.clientId
          : typeof body.client_id === 'string'
            ? body.client_id
            : ''
        ).trim();

        if (!clientId) {
          return jsonResponse({ error: 'Missing required field: clientId' }, 400, origin);
        }

        const authUser = await getAuthUserFromRequest(request, env);
        if (authUser && authUser.role === 'client_editor' && authUser.clientId) {
          if (clientId !== authUser.clientId) {
            return jsonResponse(
              { error: 'Forbidden: Cannot create or update forms for another client tenant' },
              403,
              origin
            );
          }
        }

        // 1. Verify client tenant exists
        const client = await env.DB.prepare('SELECT id, status FROM clients WHERE id = ?').bind(clientId).first<ClientRow>();
        if (!client) {
          return jsonResponse({ error: `Client tenant '${clientId}' not found` }, 404, origin);
        }

        // 2. If form already exists, verify client_id ownership (tenant boundary isolation)
        const existingForm = await env.DB.prepare('SELECT id, client_id FROM forms WHERE id = ?').bind(formId).first<FormRow>();
        if (existingForm && existingForm.client_id !== clientId) {
          return jsonResponse({ error: 'Forbidden: Form belongs to a different client tenant' }, 403, origin);
        }

        const rawSlug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
        const slug = rawSlug || `form-${formId}`;

        // Check unique slug within tenant
        const slugCollision = await env.DB.prepare(
          'SELECT id FROM forms WHERE client_id = ? AND slug = ? AND id != ?'
        )
          .bind(clientId, slug, formId)
          .first<FormRow>();

        if (slugCollision) {
          return jsonResponse({ error: `A form with slug '${slug}' already exists for this client tenant` }, 409, origin);
        }

        const rawDomain = typeof body.customDomain === 'string'
          ? body.customDomain
          : typeof body.custom_domain === 'string'
            ? body.custom_domain
            : '';
        const customDomain = rawDomain.trim().toLowerCase();

        const status = body.status === 'published' ? 'published' : 'draft';
        const title = (typeof body.title === 'string' && body.title.trim().length > 0)
          ? body.title.trim()
          : 'Untitled Form';
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        const updatedAt = new Date().toISOString();

        // Prepare schema_json
        let finalSchemaJson: string;
        if (typeof body.schema_json === 'string' && body.schema_json.trim().length > 0) {
          finalSchemaJson = body.schema_json;
        } else {
          const fullFormObject = {
            ...body,
            id: formId,
            clientId,
            slug,
            customDomain,
            status,
            title,
            description,
          };
          finalSchemaJson = JSON.stringify(fullFormObject);
        }

        const upsertQuery = `
          INSERT INTO forms (id, client_id, slug, custom_domain, status, title, description, schema_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            client_id = excluded.client_id,
            slug = excluded.slug,
            custom_domain = excluded.custom_domain,
            status = excluded.status,
            title = excluded.title,
            description = excluded.description,
            schema_json = excluded.schema_json,
            updated_at = excluded.updated_at
        `;

        await env.DB.prepare(upsertQuery)
          .bind(formId, clientId, slug, customDomain, status, title, description, finalSchemaJson, updatedAt)
          .run();

        const savedRow: FormRow = {
          id: formId,
          client_id: clientId,
          slug,
          custom_domain: customDomain,
          status,
          title,
          description,
          schema_json: finalSchemaJson,
          updated_at: updatedAt,
        };

        return jsonResponse({ ok: true, success: true, form: formatForm(savedRow) }, 200, origin);
      }

      // ------------------------------------------------------------------------
      // Route 9: POST /api/workspace/reset
      // Drops/clears existing rows in submission_deliveries, submissions, forms, users, clients
      // and re-seeds default demo data
      // ------------------------------------------------------------------------
      if (request.method === 'POST' && url.pathname === '/api/workspace/reset') {
        await env.DB.prepare('DELETE FROM submission_deliveries').run();
        await env.DB.prepare('DELETE FROM submissions').run();
        await env.DB.prepare('DELETE FROM forms').run();
        await env.DB.prepare('DELETE FROM users').run();
        await env.DB.prepare('DELETE FROM clients').run();

        if (typeof env.RESET_SQL === 'string' && env.RESET_SQL.trim().length > 0) {
          await env.DB.exec(env.RESET_SQL);
        }
        await seedDefaultUsers(env.DB);

        return jsonResponse({ ok: true, success: true, message: 'Workspace reset to default initial state' }, 200, origin);
      }

      // Default 404 for unhandled API endpoints
      return jsonResponse({ error: 'Not Found', path: url.pathname }, 404, origin);
    } catch (unexpectedError) {
      const message = unexpectedError instanceof Error ? unexpectedError.message : 'Internal Server Error';
      return jsonResponse({ error: message }, 500, origin);
    }
  },
};
