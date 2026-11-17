export interface TenantWelcomeEmailPayload {
  to: string;
  tenantName: string;
  tenantSlug: string;
  username: string;
  password: string;
  loginUrl: string;
}

export interface EmailDeliveryResult {
  status: 'sent' | 'logged';
  provider: 'resend' | 'dev-console';
  messageId?: string;
}

export interface EmailService {
  sendTenantWelcomeEmail(
    payload: TenantWelcomeEmailPayload,
  ): Promise<EmailDeliveryResult>;
}

export interface ResendEmailServiceConfig {
  apiKey: string;
  from: string;
  isProduction: boolean;
  fetchImpl?: typeof fetch;
}

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildWelcomeEmailContent(payload: TenantWelcomeEmailPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Your ${payload.tenantName} FormBuilder workspace is ready`;

  const text = [
    `Welcome to ${payload.tenantName} on FormBuilder.`,
    '',
    'Your tenant administrator account has been created with the following credentials:',
    `Workspace: ${payload.tenantName} (${payload.tenantSlug})`,
    `Login URL: ${payload.loginUrl}`,
    `Username:  ${payload.username}`,
    `Password:  ${payload.password}`,
    '',
    'Please sign in and keep these credentials secure.',
  ].join('\n');

  const safeTenantName = escapeHtml(payload.tenantName);
  const safeTenantSlug = escapeHtml(payload.tenantSlug);
  const safeLoginUrl = escapeHtml(payload.loginUrl);
  const safeUsername = escapeHtml(payload.username);
  const safePassword = escapeHtml(payload.password);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #18181b; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 8px;">
      <p style="font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; margin: 0 0 8px;">
        FormBuilder Workspace Provisioned
      </p>
      <h1 style="font-size: 18px; font-weight: 600; margin: 0 0 12px;">
        Welcome to ${safeTenantName}
      </h1>
      <p style="font-size: 14px; line-height: 1.5; color: #3f3f46; margin: 0 0 16px;">
        Your tenant administrator account has been created for workspace <code>${safeTenantSlug}</code>. Use the credentials below to sign in:
      </p>
      <div style="background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
        <div><strong>Username:</strong> ${safeUsername}</div>
        <div><strong>Password:</strong> ${safePassword}</div>
      </div>
      <p style="margin: 0 0 16px;">
        <a href="${safeLoginUrl}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 500; padding: 9px 14px; border-radius: 6px;">
          Sign in to ${safeTenantName}
        </a>
      </p>
      <p style="font-size: 12px; color: #71717a; margin: 0;">
        Login URL: <a href="${safeLoginUrl}" style="color: #3f3f46;">${safeLoginUrl}</a>
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}

/**
 * Creates a Resend REST API email sender.
 * When `apiKey` is omitted in non-production environments, logs delivery metadata
 * to the console instead of making an external HTTP call.
 */
export function createResendEmailService(
  config: ResendEmailServiceConfig,
): EmailService {
  const fetchFn = config.fetchImpl ?? fetch;

  return {
    async sendTenantWelcomeEmail(
      payload: TenantWelcomeEmailPayload,
    ): Promise<EmailDeliveryResult> {
      const apiKey = config.apiKey.trim();
      const from = config.from.trim();

      if (!apiKey) {
        if (config.isProduction) {
          throw new Error(
            'RESEND_API_KEY is not configured; cannot send tenant onboarding email.',
          );
        }
        console.info(
          `[dev-email] Tenant "${payload.tenantName}" (${payload.tenantSlug}) credentials for ${payload.to} -> username: ${payload.username}, password: ${payload.password}, loginUrl: ${payload.loginUrl}`,
        );
        return { status: 'logged', provider: 'dev-console' };
      }

      if (!from) {
        throw new Error(
          'EMAIL_FROM is not configured; cannot send tenant onboarding email.',
        );
      }

      const { subject, text, html } = buildWelcomeEmailContent(payload);
      const response = await fetchFn(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [payload.to],
          subject,
          text,
          html,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Resend API request failed with HTTP ${response.status}.`;
        try {
          const body = (await response.json()) as {
            message?: string;
            error?: string;
          };
          if (typeof body.message === 'string' && body.message.trim()) {
            errorMessage = `Resend API error (${response.status}): ${body.message}`;
          } else if (typeof body.error === 'string' && body.error.trim()) {
            errorMessage = `Resend API error (${response.status}): ${body.error}`;
          }
        } catch {
          // Keep status-based fallback message
        }
        throw new Error(errorMessage);
      }

      let messageId: string | undefined;
      try {
        const data = (await response.json()) as { id?: unknown };
        if (typeof data.id === 'string') {
          messageId = data.id;
        }
      } catch {
        // Response already succeeded; ignore optional body parse failure
      }

      return {
        status: 'sent',
        provider: 'resend',
        ...(messageId ? { messageId } : {}),
      };
    },
  };
}
