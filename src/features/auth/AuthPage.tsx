import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { AuthUser, ClientTenant, UserRole } from '../../domain/form-schema/index.ts';
import { setStoredAuth } from '../../shared/lib/auth-storage.ts';
import { cn } from '../../shared/lib/cn.ts';
import { Badge } from '../../shared/ui/badge.tsx';
import { Button } from '../../shared/ui/button.tsx';
import { Input } from '../../shared/ui/input.tsx';

export interface AuthPageProps {
  onAuthSuccess: (user: AuthUser, token: string) => void;
  clients?: ClientTenant[];
}

interface DemoCredential {
  badge: string;
  label: string;
  email: string;
  password: string;
  description: string;
  roleBadge: string;
}

const DEMO_CREDENTIALS: readonly DemoCredential[] = [
  {
    badge: '★',
    label: 'Agency Admin',
    email: 'admin@agency.com',
    password: 'admin123',
    description: 'Manage All Client Businesses',
    roleBadge: 'All Accounts',
  },
  {
    badge: '⌂',
    label: 'Acme Home Services',
    email: 'sarah@acmehomeservices.com',
    password: 'acme123',
    description: 'Plumbing & HVAC Account',
    roleBadge: 'Business Owner',
  },
  {
    badge: '☁',
    label: 'Apex B2B SaaS',
    email: 'david@apexcloud.io',
    password: 'apex123',
    description: 'Software Demo Account',
    roleBadge: 'Business Owner',
  },
  {
    badge: '◈',
    label: 'Elevate MedSpa',
    email: 'jessica@elevatemedspa.com',
    password: 'elevate123',
    description: 'Clinic & Booking Account',
    roleBadge: 'Business Owner',
  },
];

interface AuthSuccessResponse {
  user: AuthUser;
  token: string;
}

function isAuthSuccessResponse(payload: unknown): payload is AuthSuccessResponse {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.token !== 'string' || !candidate.token) {
    return false;
  }
  if (typeof candidate.user !== 'object' || candidate.user === null) {
    return false;
  }
  const user = candidate.user as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    (user.role === 'agency_admin' || user.role === 'client_editor')
  );
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim().length > 0) {
      return record.error;
    }
    if (typeof record.message === 'string' && record.message.trim().length > 0) {
      return record.message;
    }
  }
  return fallback;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function AuthPage({ onAuthSuccess, clients = [] }: AuthPageProps): ReactElement {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRole, setRegRole] = useState<UserRole>('client_editor');
  const [regClientName, setRegClientName] = useState('');
  const [regPrimaryDomain, setRegPrimaryDomain] = useState('');
  const [isDomainManuallyEdited, setIsDomainManuallyEdited] = useState(false);

  // Common submission & error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectPreset = (credential: DemoCredential): void => {
    setLoginEmail(credential.email);
    setLoginPassword(credential.password);
    setErrorMessage(null);
  };

  const handleClientNameChange = (nameVal: string): void => {
    setRegClientName(nameVal);
    if (!isDomainManuallyEdited) {
      const slug = slugify(nameVal);
      setRegPrimaryDomain(slug ? `forms.${slug}.com` : '');
    }
  };

  const handlePrimaryDomainChange = (domainVal: string): void => {
    setRegPrimaryDomain(domainVal);
    setIsDomainManuallyEdited(true);
  };

  const handleSelectExistingClient = (client: ClientTenant): void => {
    setRegClientName(client.name);
    setRegPrimaryDomain(client.primaryDomain);
    setIsDomainManuallyEdited(true);
  };

  const handleLoginSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errorText = getErrorMessage(
          data,
          'Invalid email or password.',
        );
        setErrorMessage(errorText);
        return;
      }

      if (isAuthSuccessResponse(data)) {
        setStoredAuth(data.token, data.user);
        onAuthSuccess(data.user, data.token);
      } else {
        setErrorMessage('Invalid authentication response structure from server.');
      }
    } catch {
      setErrorMessage('Network error communicating with authentication service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    if (!regName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!regEmail.trim()) {
      setErrorMessage('Please enter your work email address.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (regRole === 'client_editor') {
      if (!regClientName.trim()) {
        setErrorMessage('Please provide your company or organization name.');
        return;
      }
      if (!regPrimaryDomain.trim()) {
        setErrorMessage('Please specify a primary domain for your organization.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          role: regRole,
          ...(regRole === 'client_editor'
            ? {
                clientName: regClientName.trim(),
                primaryDomain: regPrimaryDomain.trim().toLowerCase(),
              }
            : {}),
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errorText = getErrorMessage(
          data,
          `Registration failed with status ${response.status}`,
        );
        setErrorMessage(errorText);
        return;
      }

      if (isAuthSuccessResponse(data)) {
        setStoredAuth(data.token, data.user);
        onAuthSuccess(data.user, data.token);
      } else {
        setErrorMessage('Invalid registration response structure from server.');
      }
    } catch {
      setErrorMessage('Network error communicating with registration service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 select-none">
      {/* App Header / Branding */}
      <div className="mb-6 sm:mb-8 flex flex-col items-center text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold text-sm shadow-sm border border-zinc-200 dark:border-zinc-800">
          FB
        </div>
        <h1 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
          Enterprise Form Studio
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
          Create customer forms, collect inquiries, and connect your business tools
        </p>
      </div>

      {/* Central Card Container */}
      <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 sm:p-8">
        {/* Top Tab Switcher */}
        <div className="flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={cn(
              'flex-1 rounded-sm py-1.5 text-xs font-medium transition-all',
              mode === 'login'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={cn(
              'flex-1 rounded-sm py-1.5 text-xs font-medium transition-all',
              mode === 'register'
                ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
            )}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-400"
          >
            <svg
              className="h-4 w-4 shrink-0 text-rose-500 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Mode: Login */}
        {mode === 'login' && (
          <div>
            {/* Quick-Fill Demo Presets Bar */}
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3.5 mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Try a Demo Account (1-Click Sign In)
                </span>
                <span className="text-[10px] text-zinc-400">1-Click Auto-Fill</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_CREDENTIALS.map((cred) => (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => handleSelectPreset(cred)}
                    className="flex flex-col items-start rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition shadow-2xs"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="flex items-center gap-1 font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                        <span className="text-zinc-400">{cred.badge}</span>
                        <span>{cred.label}</span>
                      </span>
                      <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1 py-0.2 font-mono text-[9px] font-medium text-zinc-600 dark:text-zinc-400">
                        {cred.roleBadge}
                      </span>
                    </div>
                    <span className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 truncate w-full">
                      {cred.description}
                    </span>
                    <span className="mt-0.5 font-mono text-[9px] text-zinc-400 dark:text-zinc-500 truncate w-full">
                      {cred.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400">
                  Or sign in with credentials
                </span>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Work Email Address <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@agency.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                  >
                    {showLoginPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="w-full"
                >
                  Sign In to Workspace
                </Button>
              </div>
            </form>

            {/* Switcher Footer Link */}
            <div className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                Create one
              </button>
            </div>
          </div>
        )}

        {/* Mode: Register */}
        {mode === 'register' && (
          <div>
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="reg-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Doe"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Work Email Address <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="jane@company.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Password <span className="text-rose-500">*</span>{' '}
                  <span className="text-zinc-400 font-normal">(min. 6 characters)</span>
                </label>
                <div className="relative mt-1">
                  <Input
                    id="reg-password"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                  >
                    {showRegPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Account Scope / Role Selector */}
              <div>
                <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Account Type <span className="text-rose-500">*</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRegRole('client_editor')}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-lg border text-left transition-all',
                      regRole === 'client_editor'
                        ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 ring-1 ring-zinc-950 dark:ring-zinc-100 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700',
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      <span>Business Account (Single Company)</span>
                    </div>
                    <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                      Dedicated workspace for your company &amp; forms
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegRole('agency_admin')}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-lg border text-left transition-all',
                      regRole === 'agency_admin'
                        ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 ring-1 ring-zinc-950 dark:ring-zinc-100 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700',
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      <span>Agency Account (Manage Multiple Clients)</span>
                    </div>
                    <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                      Manage all client businesses, custom web domains &amp; forms
                    </span>
                  </button>
                </div>
              </div>

              {/* If Client Organization is selected */}
              {regRole === 'client_editor' && (
                <div className="space-y-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3.5">
                  {/* Quick-fill from existing clients if available */}
                  {clients.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Optional: Select Existing Business
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {clients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectExistingClient(c)}
                            className="rounded-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="reg-client-name"
                      className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Company / Business Name <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="reg-client-name"
                      type="text"
                      required
                      placeholder="Starlight Logistics"
                      value={regClientName}
                      onChange={(e) => handleClientNameChange(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-primary-domain"
                      className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Your Website Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="mt-1 flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 shadow-sm focus-within:border-zinc-950 dark:focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-950 dark:focus-within:ring-zinc-300">
                      <span className="text-zinc-400 select-none mr-1.5 font-mono text-xs">https://</span>
                      <input
                        id="reg-primary-domain"
                        type="text"
                        required
                        placeholder="forms.yourbusiness.com"
                        value={regPrimaryDomain}
                        onChange={(e) => handlePrimaryDomainChange(e.target.value)}
                        className="h-9 w-full bg-transparent font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Where your forms will be hosted (e.g. forms.yourbusiness.com)
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="w-full"
                >
                  Create Account &amp; Launch
                </Button>
              </div>
            </form>

            {/* Switcher Footer Link */}
            <div className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
              >
                Sign in
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Security Notice */}
      <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <Badge variant="default" className="font-mono text-[11px] gap-1.5">
          <svg
            className="h-3.5 w-3.5 text-emerald-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>Secure Cloud Storage &bull; Private Account Protection</span>
        </Badge>
      </div>
    </div>
  );
}
