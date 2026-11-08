import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { AuthUser } from '../../domain/form-schema/index.ts';
import { Button } from '../../shared/ui/button.tsx';
import { Input } from '../../shared/ui/input.tsx';

export interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: AuthUser, token: string) => void;
  currentClientName?: string;
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

interface LoginSuccessResponse {
  user: AuthUser;
  token: string;
}

function isLoginSuccessResponse(payload: unknown): payload is LoginSuccessResponse {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.token !== 'string') {
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
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const err = (payload as Record<string, unknown>).error;
    if (typeof err === 'string' && err.trim().length > 0) {
      return err;
    }
  }
  return fallback;
}

export function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  currentClientName,
}: LoginModalProps): ReactElement | null {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSelectPreset = (credential: DemoCredential): void => {
    setEmail(credential.email);
    setPassword(credential.password);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email.trim() || !password) {
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
          email: email.trim(),
          password,
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

      if (isLoginSuccessResponse(data)) {
        onLoginSuccess(data.user, data.token);
        if (onClose) {
          onClose();
        }
      } else {
        setErrorMessage('Invalid authentication response structure from server.');
      }
    } catch {
      setErrorMessage('Network error communicating with authentication service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-zinc-900 dark:text-zinc-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold text-xs shadow-sm">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <h2 id="login-modal-title" className="font-semibold text-base text-zinc-950 dark:text-zinc-100 tracking-tight">
                Sign In to Workspace
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {currentClientName
                  ? `Form Studio • ${currentClientName}`
                  : 'Create customer forms, collect inquiries, and connect your business tools'}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close login dialog"
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Quick-Fill Demo Credentials Bar */}
        <div className="mt-4 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Try a Demo Account (1-Click Sign In)
            </span>
            <span className="text-[10px] text-zinc-400">1-Click Auto-Fill</span>
          </div>

          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
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

        {/* Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-400"
          >
            <svg
              className="h-4 w-4 shrink-0 text-rose-500"
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
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Standard Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label
              htmlFor="auth-email-input"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Work Email Address <span className="text-rose-500">*</span>
            </label>
            <Input
              id="auth-email-input"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password-input"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1">
              <Input
                id="auth-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
              >
                {showPassword ? (
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
              Sign In
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
