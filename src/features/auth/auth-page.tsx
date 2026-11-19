import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, Input, Label } from '../../shared/ui';
import {
  authenticateUserAction,
  fetchPublicTenantInfoAction,
} from './actions';
import type { AuthSession, PublicTenantInfo } from './model';

export interface AuthPageProps {
  tenantSlug?: string;
  onAuthenticated: (session: AuthSession) => void;
  onNavigateGlobalLogin?: () => void;
}

/**
 * Workspace authentication screen supporting both global/superadmin sign-in (`/login`)
 * and tenant-branded sign-in (`/t/:tenantSlug/login`).
 */
export function AuthPage({
  tenantSlug,
  onAuthenticated,
  onNavigateGlobalLogin,
}: AuthPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tenantInfo, setTenantInfo] = useState<PublicTenantInfo | null>(null);
  const [tenantLookupStatus, setTenantLookupStatus] = useState<
    'idle' | 'loading' | 'found' | 'not_found'
  >(tenantSlug ? 'loading' : 'idle');

  useEffect(() => {
    if (!tenantSlug) {
      return;
    }

    let cancelled = false;
    fetchPublicTenantInfoAction(tenantSlug)
      .then((info) => {
        if (cancelled) return;
        if (info) {
          setTenantInfo(info);
          setTenantLookupStatus('found');
        } else {
          setTenantInfo(null);
          setTenantLookupStatus('not_found');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTenantInfo(null);
          setTenantLookupStatus('not_found');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const clearFieldError = (field: string) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleFillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
    setFieldErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (tenantSlug && tenantLookupStatus === 'not_found') return;

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const result = await authenticateUserAction({
        username,
        password,
        tenantSlug,
      });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      onAuthenticated(result.session);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTenantLogin = Boolean(tenantSlug);

  return (
    <div className="min-h-screen w-screen bg-[#f4f5f7] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-emerald-100">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/60 dark:border-emerald-800/70 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                FormBuilder
              </h1>
              <p className="text-xs text-zinc-500">
                {isTenantLogin
                  ? tenantInfo
                    ? `${tenantInfo.name} Portal`
                    : 'Tenant Workspace Login'
                  : 'Workspace Access Control'}
              </p>
            </div>
          </div>
          <Badge variant={isTenantLogin ? 'success' : 'neutral'}>
            {isTenantLogin
              ? (tenantInfo?.name ?? 'Workspace Sign-In')
              : 'Workspace Portal'}
          </Badge>
        </div>

        {/* Auth Card */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
          {tenantSlug && tenantLookupStatus === 'not_found' ? (
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <Badge variant="danger">WORKSPACE NOT FOUND</Badge>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 pt-1">
                  Workspace &ldquo;{tenantSlug}&rdquo; is unavailable
                </h2>
                <p className="text-xs text-zinc-500">
                  Check the workspace URL with your administrator or sign in
                  from the main portal.
                </p>
              </div>
              {onNavigateGlobalLogin && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={onNavigateGlobalLogin}
                >
                  Go to Main Sign In
                </Button>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="p-5 space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {isTenantLogin && tenantInfo
                    ? `Sign in to ${tenantInfo.name}`
                    : 'Sign in to your workspace'}
                </h2>
                <p className="text-xs text-zinc-500">
                  {isTenantLogin
                    ? 'Enter your tenant account credentials to build forms and review submissions.'
                    : 'Enter your superadmin or tenant credentials. Tenant accounts are provisioned by your administrator.'}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {/* Username */}
                <div className="space-y-1.5">
                  <Label htmlFor="auth-username" requiredIndicator>
                    Username
                  </Label>
                  <Input
                    id="auth-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder={
                      isTenantLogin ? 'e.g. tenant_admin' : 'superadmin or tenant user'
                    }
                    value={username}
                    hasError={Boolean(fieldErrors.username)}
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby={
                      fieldErrors.username ? 'auth-username-error' : undefined
                    }
                    onChange={(e) => {
                      setUsername(e.target.value);
                      clearFieldError('username');
                    }}
                  />
                  {fieldErrors.username && (
                    <p id="auth-username-error" className="text-xs text-rose-600">
                      {fieldErrors.username}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="auth-password" requiredIndicator>
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="auth-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      hasError={Boolean(fieldErrors.password)}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={
                        fieldErrors.password ? 'auth-password-error' : undefined
                      }
                      className="pr-14"
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 px-2 rounded-sm text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="auth-password-error" className="text-xs text-rose-600">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={
                  isSubmitting || (isTenantLogin && tenantLookupStatus === 'loading')
                }
              >
                {isSubmitting ? 'Signing In...' : 'Sign In to Workspace'}
              </Button>

              {isTenantLogin && onNavigateGlobalLogin && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={onNavigateGlobalLogin}
                    className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2 cursor-pointer"
                  >
                    Switch to Superadmin / Main Sign In
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Dev Demo Account Helper */}
          {import.meta.env.DEV &&
            !isTenantLogin &&
            !(tenantSlug && tenantLookupStatus === 'not_found') && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    Seeded Superadmin
                  </div>
                  <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">
                    superadmin / admin123
                  </div>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    handleFillCredentials('superadmin', 'admin123');
                  }}
                >
                  Fill Credentials
                </Button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
