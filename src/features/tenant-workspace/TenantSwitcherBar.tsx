import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { AuthUser, ClientTenant, FormSchema } from '../../domain/form-schema/index.ts';
import { cn } from '../../shared/lib/cn.ts';
import { Badge } from '../../shared/ui/badge.tsx';
import { Button } from '../../shared/ui/button.tsx';
import { Input } from '../../shared/ui/input.tsx';

export interface TenantSwitcherBarProps {
  clients: ClientTenant[];
  activeClientId: string;
  userRole: 'agency_admin' | 'client_editor';
  clientForms: FormSchema[];
  activeFormId: string;
  currentUser: AuthUser | null;
  onSelectClient: (clientId: string) => void;
  onToggleUserRole: (role: 'agency_admin' | 'client_editor') => void;
  onSelectForm: (formId: string) => void;
  onCreateForm: () => void;
  onCreateClient: (client: Omit<ClientTenant, 'id'>) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export function TenantSwitcherBar({
  clients,
  activeClientId,
  userRole,
  clientForms,
  activeFormId,
  currentUser,
  onSelectClient,
  onToggleUserRole,
  onSelectForm,
  onCreateForm,
  onCreateClient,
  onOpenLogin,
  onLogout,
}: TenantSwitcherBarProps): ReactElement {
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientSlug, setNewClientSlug] = useState('');
  const [newClientDomain, setNewClientDomain] = useState('');
  const [newClientAllowedDomains, setNewClientAllowedDomains] = useState('');
  const [newClientIndustry, setNewClientIndustry] = useState('');
  const [newClientStatus, setNewClientStatus] = useState<'active' | 'paused'>('active');

  useEffect(() => {
    if (!isClientModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsClientModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isClientModalOpen]);

  const activeClient = clients.find((c) => c.id === activeClientId) ?? clients[0];

  const handleNameChange = (name: string): void => {
    setNewClientName(name);
    if (!newClientSlug) {
      setNewClientSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      );
    }
  };

  const handleCreateClientSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientSlug.trim()) {
      return;
    }

    const domain = newClientDomain.trim() || `forms.${newClientSlug.trim()}.com`;
    const allowed = newClientAllowedDomains
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    onCreateClient({
      name: newClientName.trim(),
      slug: newClientSlug.trim(),
      primaryDomain: domain,
      allowedDomains: allowed.length > 0 ? allowed : [domain],
      industry: newClientIndustry.trim() || undefined,
      status: newClientStatus,
    });

    // Reset and close
    setNewClientName('');
    setNewClientSlug('');
    setNewClientDomain('');
    setNewClientAllowedDomains('');
    setNewClientIndustry('');
    setNewClientStatus('active');
    setIsClientModalOpen(false);
  };

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 px-3 py-2 sm:px-6 min-w-0 w-full">
        {/* Top/Left Row: Branding & Client Badge / Role Switcher + Mobile Auth (< md) */}
        <div className="flex items-center justify-between gap-2 w-full md:w-auto min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-mono font-bold text-xs shadow-xs">
                FB
              </span>
              <div className="hidden sm:block">
                <span className="block font-semibold text-xs tracking-tight text-zinc-950 dark:text-zinc-100 uppercase">
                  Enterprise Studio
                </span>
                <span className="block font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                  Form &amp; Lead Studio
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

            {/* Client Portal Tenant Badge OR Agency Admin Role Switcher */}
            {currentUser?.role === 'client_editor' ? (
              <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-md bg-zinc-100 dark:bg-zinc-800/80 px-2 sm:px-2.5 py-1 border border-zinc-200 dark:border-zinc-700 shrink-0 min-w-0">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[110px] xs:max-w-[150px] sm:max-w-[200px]">
                  {activeClient?.name ?? 'Client Account'}
                </span>
                <Badge variant="success" className="text-[9px] py-0 px-1.5 shrink-0 hidden sm:inline-flex">
                  Business View
                </Badge>
              </div>
            ) : (
              <div className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleUserRole('agency_admin')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-sm px-2 sm:px-2.5 py-1 text-xs font-medium transition-all touch-manipulation',
                    userRole === 'agency_admin'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                  )}
                  title="Agency View can manage all client accounts and forms"
                >
                  <span>Agency View (All Accounts)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleUserRole('client_editor')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-sm px-2 sm:px-2.5 py-1 text-xs font-medium transition-all touch-manipulation',
                    userRole === 'client_editor'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                  )}
                  title="Business View locked to active business account"
                >
                  <span>Business View</span>
                </button>
              </div>
            )}
          </div>

          {/* User Account Profile & Auth Section (< md: Mobile compact) */}
          <div className="md:hidden shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-1.5 py-1 shadow-xs shrink-0">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold text-[11px] uppercase shadow-xs"
                  title={`${currentUser.name} (${currentUser.role === 'agency_admin' ? 'Agency View' : 'Business View'})`}
                >
                  {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <div className="hidden xs:flex flex-col text-left leading-tight max-w-[70px] sm:max-w-[100px]">
                  <span className="font-medium text-[11px] text-zinc-900 dark:text-zinc-100 truncate">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 truncate">
                    {currentUser.role === 'agency_admin' ? 'Agency View' : 'Business View'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  title="Sign Out of account"
                  className="h-6 w-6 p-0 text-xs touch-manipulation shrink-0"
                >
                  <svg
                    className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span className="sr-only">Sign Out</span>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenLogin}
                title="Sign in to your client or agency account"
                className="h-7 px-2 text-xs touch-manipulation shrink-0"
              >
                <span>Sign In</span>
              </Button>
            )}
          </div>
        </div>

        {/* Controls Row: Form Switcher & (if Agency Admin) Client Selector */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 min-w-0 w-full md:w-auto">
          {/* Tenant Selector: Rendered strictly for Agency Admin only */}
          {userRole === 'agency_admin' && currentUser?.role !== 'client_editor' && (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-initial">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0">Business:</span>
              <select
                value={activeClientId}
                onChange={(e) => onSelectClient(e.target.value)}
                className="h-8 min-w-0 flex-1 sm:w-44 md:w-48 lg:w-52 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 sm:px-2.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 truncate touch-manipulation"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.primaryDomain}) [{c.status}]
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsClientModalOpen(true)}
                title="Add new Business Client"
                className="shrink-0 h-8 px-2 sm:px-2.5 text-xs touch-manipulation"
              >
                <span className="font-semibold">+</span>
                <span className="hidden sm:inline">New Client</span>
                <span className="sm:hidden">Client</span>
              </Button>
            </div>
          )}

          {userRole === 'agency_admin' && currentUser?.role !== 'client_editor' && (
            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block shrink-0" />
          )}

          {/* Form Switcher Section */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-initial">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0">Form:</span>
            <select
              value={activeFormId}
              onChange={(e) => onSelectForm(e.target.value)}
              className={cn(
                'h-8 min-w-0 flex-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 sm:px-2.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 truncate touch-manipulation',
                currentUser?.role === 'client_editor'
                  ? 'sm:w-56 md:w-64 lg:w-72'
                  : 'sm:w-40 md:w-44 lg:w-48',
              )}
            >
              {clientForms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title} ({form.status === 'published' ? '● Published' : '○ Draft'})
                </option>
              ))}
            </select>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCreateForm}
              title="Create a new form for this client tenant"
              className="shrink-0 h-8 px-2 sm:px-3 text-xs touch-manipulation"
            >
              <span className="font-semibold">+</span>
              <span className="hidden sm:inline">New Form</span>
              <span className="sm:hidden">Form</span>
            </Button>
          </div>
        </div>

        {/* User Account Profile & Auth Section (md+: Desktop & Tablet inline at far right) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 sm:px-2.5 py-1 shadow-xs shrink-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold text-[11px] uppercase shadow-xs">
                {currentUser.name ? currentUser.name.charAt(0) : 'U'}
              </div>
              <div className="flex flex-col text-left leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 max-w-[110px] truncate">
                    {currentUser.name}
                  </span>
                  <Badge variant="default" className="text-[9px] py-0">
                    {currentUser.role === 'agency_admin' ? 'Agency View' : 'Business View'}
                  </Badge>
                </div>
                <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 max-w-[130px] truncate">
                  {currentUser.email}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLogout}
                title="Sign Out of account"
                className="h-7 px-2 text-xs touch-manipulation"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="hidden lg:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onOpenLogin}
              title="Sign in to your client or agency account"
              className="h-8 px-2.5 sm:px-3 text-xs touch-manipulation shrink-0"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              <span>Sign In</span>
            </Button>
          )}
        </div>
      </div>

      {/* New Client Tenant Onboarding Modal */}
      {isClientModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-client-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          onClick={() => setIsClientModalOpen(false)}
        >
          <div
            className="w-full max-w-md mx-4 sm:mx-0 max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 text-zinc-900 dark:text-zinc-100 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3
                  id="new-client-modal-title"
                  className="font-semibold text-sm text-zinc-950 dark:text-zinc-100 tracking-tight"
                >
                  Add New Business Client
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Create a dedicated workspace and connect your website
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                aria-label="Close dialog"
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 text-lg leading-none cursor-pointer touch-manipulation"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateClientSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Business / Client Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Apex Solar Solutions"
                  value={newClientName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="mt-1 touch-manipulation"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Short Web ID <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="apex-solar"
                  value={newClientSlug}
                  onChange={(e) => setNewClientSlug(e.target.value)}
                  className="mt-1 font-mono touch-manipulation"
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Used in form links (e.g. apex-solar)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Primary Website Address
                </label>
                <Input
                  type="text"
                  placeholder="forms.apexsolar.com"
                  value={newClientDomain}
                  onChange={(e) => setNewClientDomain(e.target.value)}
                  className="mt-1 font-mono touch-manipulation"
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Where your forms will be hosted (e.g. forms.apexsolar.com)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Allowed Websites (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="apexsolar.com, www.apexsolar.com"
                  value={newClientAllowedDomains}
                  onChange={(e) => setNewClientAllowedDomains(e.target.value)}
                  className="mt-1 font-mono touch-manipulation"
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Websites allowed to embed this form (comma-separated)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Industry / Business Type
                  </label>
                  <Input
                    type="text"
                    placeholder="Solar / Home Services"
                    value={newClientIndustry}
                    onChange={(e) => setNewClientIndustry(e.target.value)}
                    className="mt-1 touch-manipulation"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Account Status
                  </label>
                  <select
                    value={newClientStatus}
                    onChange={(e) =>
                      setNewClientStatus(e.target.value as 'active' | 'paused')
                    }
                    className="mt-1 h-9 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 touch-manipulation"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsClientModalOpen(false)}
                  className="touch-manipulation"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="touch-manipulation"
                >
                  Add Business Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
