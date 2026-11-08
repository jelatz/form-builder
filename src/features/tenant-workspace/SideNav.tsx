import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { AuthUser, ClientTenant, FormSchema } from '../../domain/form-schema/index.ts';
import { cn } from '../../shared/lib/cn.ts';
import { Badge } from '../../shared/ui/badge.tsx';
import { Button } from '../../shared/ui/button.tsx';
import { Input } from '../../shared/ui/input.tsx';

export interface SideNavProps {
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // Workspace Tabs
  activeTab: 'build' | 'preview' | 'integrations' | 'submissions' | 'schema';
  onSelectTab: (tab: 'build' | 'preview' | 'integrations' | 'submissions' | 'schema') => void;
  fieldsCount: number;
  integrationsCount: number;
  submissionsCount: number;
  hasFailedDeliveries: boolean;
  // Multi-Tenant & Form State
  clients: ClientTenant[];
  activeClientId: string;
  userRole: 'agency_admin' | 'client_editor';
  clientForms: FormSchema[];
  activeFormId: string;
  activeSchema: FormSchema;
  currentUser: AuthUser | null;
  onSelectClient: (clientId: string) => void;
  onToggleUserRole: (role: 'agency_admin' | 'client_editor') => void;
  onSelectForm: (formId: string) => void;
  onCreateForm: () => void;
  onCreateClient: (client: Omit<ClientTenant, 'id'>) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  // Actions & Backend Status
  onOpenShare: () => void;
  onOpenPreview: () => void;
  onResetDemo: () => void;
  backendStatus: 'connected' | 'connecting' | 'local_fallback';
  syncState: 'idle' | 'saving' | 'saved';
}

export function SideNav({
  className,
  isCollapsed = false,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  fieldsCount,
  integrationsCount,
  submissionsCount,
  hasFailedDeliveries,
  clients,
  activeClientId,
  userRole,
  clientForms,
  activeFormId,
  activeSchema,
  currentUser,
  onSelectClient,
  onToggleUserRole,
  onSelectForm,
  onCreateForm,
  onCreateClient,
  onOpenLogin,
  onLogout,
  onOpenShare,
  onOpenPreview,
  onResetDemo,
  backendStatus,
  syncState,
}: SideNavProps): ReactElement {
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientSlug, setNewClientSlug] = useState('');
  const [newClientDomain, setNewClientDomain] = useState('');
  const [newClientAllowedDomains, setNewClientAllowedDomains] = useState('');
  const [newClientIndustry, setNewClientIndustry] = useState('');
  const [newClientStatus, setNewClientStatus] = useState<'active' | 'paused'>('active');

  const activeClient = clients.find((c) => c.id === activeClientId) ?? clients[0];

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

    setNewClientName('');
    setNewClientSlug('');
    setNewClientDomain('');
    setNewClientAllowedDomains('');
    setNewClientIndustry('');
    setNewClientStatus('active');
    setIsClientModalOpen(false);
  };

  return (
    <aside
      className={cn(
        'shrink-0 flex flex-col h-screen border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 select-none z-30 transition-all duration-200 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64 xl:w-72',
        className,
      )}
      aria-label="Studio Sidebar Navigation"
    >
      {/* 1. Header / Brand & Role Switcher */}
      <div
        className={cn(
          'border-b border-zinc-200 dark:border-zinc-800 shrink-0',
          isCollapsed ? 'p-3 flex items-center justify-center' : 'p-3.5 space-y-3',
        )}
      >
        {isCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="h-8 w-8 text-xs font-mono font-bold rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 flex items-center justify-center mx-auto shadow-xs cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all"
            title="Enterprise Studio • Form & Lead Studio"
            aria-label="Expand sidebar navigation"
          >
            FB
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-mono font-bold text-xs shadow-xs shrink-0">
                FB
              </span>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="font-semibold text-xs tracking-tight text-zinc-950 dark:text-zinc-100 uppercase">
                  Enterprise Studio
                </span>
                <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                  Form &amp; Lead Studio
                </span>
              </div>
            </div>

            {/* Agency Admin vs Client Portal Role Toggle / Badge */}
            {currentUser?.role === 'client_editor' ? (
              <div className="flex items-center justify-between rounded-md bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 border border-zinc-200 dark:border-zinc-700 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {activeClient?.name ?? 'Client Account'}
                  </span>
                </div>
                <Badge variant="success" className="text-[9px] py-0 px-1.5 shrink-0">
                  Business View
                </Badge>
              </div>
            ) : (
              <div className="flex w-full rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => onToggleUserRole('agency_admin')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 rounded-sm py-1 text-xs font-medium transition-all touch-manipulation cursor-pointer',
                    userRole === 'agency_admin'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                  )}
                  title="Agency View can manage all client businesses and forms"
                >
                  <span>Agency View (All Accounts)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleUserRole('client_editor')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 rounded-sm py-1 text-xs font-medium transition-all touch-manipulation cursor-pointer',
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
          </>
        )}
      </div>

      {/* 2. Tenant & Form Context Switcher */}
      <div
        className={cn(
          'border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-950/30',
          isCollapsed ? 'px-2 py-3 flex flex-col items-center gap-2' : 'px-3 py-3 space-y-2.5',
        )}
      >
        {isCollapsed ? (
          <>
            {userRole === 'agency_admin' && currentUser?.role !== 'client_editor' && (
              <button
                type="button"
                onClick={() => setIsClientModalOpen(true)}
                title={`Active Tenant: ${activeClient.name} (${activeClient.primaryDomain})`}
                aria-label="Manage Tenant"
                className="h-9 w-9 mx-auto flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] shadow-xs transition-all cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onCreateForm}
              title={`Active Form: ${activeSchema.title} (${activeSchema.status === 'published' ? 'Published' : 'Draft'})`}
              aria-label="Active Form"
              className="h-9 w-9 mx-auto flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] shadow-xs transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </button>
          </>
        ) : (
          <>
            {/* Tenant Selector: Rendered for Agency Admin only */}
            {userRole === 'agency_admin' && currentUser?.role !== 'client_editor' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="sidenav-client-select"
                    className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold"
                  >
                    Business / Client
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(true)}
                    className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 cursor-pointer flex items-center gap-0.5"
                    title="Add new Business Client"
                  >
                    <span className="font-bold text-xs">+</span>
                    <span>New Client</span>
                  </button>
                </div>
                <select
                  id="sidenav-client-select"
                  value={activeClientId}
                  onChange={(e) => onSelectClient(e.target.value)}
                  className="h-8 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 truncate"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.primaryDomain})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Form Selector */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="sidenav-form-select"
                  className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold"
                >
                  Active Form
                </label>
                <button
                  type="button"
                  onClick={onCreateForm}
                  className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 cursor-pointer flex items-center gap-0.5"
                  title="Create a new form for this client tenant"
                >
                  <span className="font-bold text-xs">+</span>
                  <span>New Form</span>
                </button>
              </div>
              <select
                id="sidenav-form-select"
                value={activeFormId}
                onChange={(e) => onSelectForm(e.target.value)}
                className="h-8 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 truncate"
              >
                {clientForms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title} ({form.status === 'published' ? '● Published' : '○ Draft'})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* 3. Middle Scrollable Section: Navigation Tabs, Active Summary, Quick Actions */}
      <div className={cn('flex-1 overflow-y-auto space-y-4', isCollapsed ? 'px-2 py-3' : 'px-3 py-3')}>
        {/* Workspace Views Navigation */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="font-mono text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider px-2 py-1 mb-1">
              Workspace
            </div>
          )}
          <nav className="space-y-1" aria-label="Desktop workspace views">
            {isCollapsed ? (
              <>
                {/* 1. Form Builder */}
                <button
                  type="button"
                  onClick={() => onSelectTab('build')}
                  title="Form Builder (Add & edit questions)"
                  aria-label="Form Builder (Add & edit questions)"
                  className={cn(
                    'w-10 h-10 mx-auto flex items-center justify-center rounded-md relative text-xs transition cursor-pointer touch-manipulation',
                    activeTab === 'build'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                  {fieldsCount > 0 && (
                    <span
                      className={cn(
                        'absolute top-1.5 right-1.5 h-2 w-2 rounded-full',
                        activeTab === 'build' ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-zinc-500 dark:bg-zinc-400',
                      )}
                    />
                  )}
                </button>

                {/* 2. Test & Preview */}
                <button
                  type="button"
                  onClick={() => onSelectTab('preview')}
                  title="Test & Preview (Try out your form)"
                  aria-label="Test & Preview (Try out your form)"
                  className={cn(
                    'w-10 h-10 mx-auto flex items-center justify-center rounded-md relative text-xs transition cursor-pointer touch-manipulation',
                    activeTab === 'preview'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* 3. Connected Apps */}
                <button
                  type="button"
                  onClick={() => onSelectTab('integrations')}
                  title="Connected Apps (CRM & website link)"
                  aria-label="Connected Apps (CRM & website link)"
                  className={cn(
                    'w-10 h-10 mx-auto flex items-center justify-center rounded-md relative text-xs transition cursor-pointer touch-manipulation',
                    activeTab === 'integrations'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  {integrationsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </button>

                {/* 4. Customer Responses */}
                <button
                  type="button"
                  onClick={() => onSelectTab('submissions')}
                  title="Customer Responses (View collected leads)"
                  aria-label="Customer Responses (View collected leads)"
                  className={cn(
                    'w-10 h-10 mx-auto flex items-center justify-center rounded-md relative text-xs transition cursor-pointer touch-manipulation',
                    activeTab === 'submissions'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                  {hasFailedDeliveries ? (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500" />
                  ) : submissionsCount > 0 ? (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                  ) : null}
                </button>

                {/* 5. Backup & Data */}
                <button
                  type="button"
                  onClick={() => onSelectTab('schema')}
                  title="Backup & Data (Export & import form)"
                  aria-label="Backup & Data (Export & import form)"
                  className={cn(
                    'w-10 h-10 mx-auto flex items-center justify-center rounded-md relative text-xs transition cursor-pointer touch-manipulation',
                    activeTab === 'schema'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                {/* 1. Form Builder */}
                <button
                  type="button"
                  onClick={() => onSelectTab('build')}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer touch-manipulation',
                    activeTab === 'build'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                    <div className="flex flex-col text-left leading-tight min-w-0">
                      <span className="truncate">Form Builder</span>
                      <span className={cn('text-[10px] font-normal truncate', activeTab === 'build' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500')}>Add &amp; edit questions</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-[10px] rounded px-1.5 py-0.5 shrink-0 ml-1.5',
                      activeTab === 'build'
                        ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-950'
                        : 'bg-zinc-200/80 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300',
                    )}
                  >
                    {fieldsCount}
                  </span>
                </button>

                {/* 2. Test & Preview */}
                <button
                  type="button"
                  onClick={() => onSelectTab('preview')}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer touch-manipulation',
                    activeTab === 'preview'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div className="flex flex-col text-left leading-tight min-w-0">
                      <span className="truncate">Test &amp; Preview</span>
                      <span className={cn('text-[10px] font-normal truncate', activeTab === 'preview' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500')}>Try out your form</span>
                    </div>
                  </div>
                </button>

                {/* 3. Connected Apps */}
                <button
                  type="button"
                  onClick={() => onSelectTab('integrations')}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer touch-manipulation',
                    activeTab === 'integrations'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <div className="flex flex-col text-left leading-tight min-w-0">
                      <span className="truncate">Connected Apps</span>
                      <span className={cn('text-[10px] font-normal truncate', activeTab === 'integrations' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500')}>CRM &amp; website link</span>
                    </div>
                  </div>
                  {integrationsCount > 0 && (
                    <span
                      className={cn(
                        'font-mono text-[10px] rounded px-1.5 py-0.5 shrink-0 ml-1.5',
                        activeTab === 'integrations'
                          ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-950'
                          : 'bg-zinc-200/80 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300',
                      )}
                    >
                      {integrationsCount}
                    </span>
                  )}
                </button>

                {/* 4. Customer Responses */}
                <button
                  type="button"
                  onClick={() => onSelectTab('submissions')}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer touch-manipulation',
                    activeTab === 'submissions'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                    </svg>
                    <div className="flex flex-col text-left leading-tight min-w-0">
                      <span className="truncate">Customer Responses</span>
                      <span className={cn('text-[10px] font-normal truncate', activeTab === 'submissions' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500')}>View collected leads</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-[10px] rounded px-1.5 py-0.5 shrink-0 ml-1.5',
                      activeTab === 'submissions'
                        ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-950'
                        : hasFailedDeliveries
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          : 'bg-zinc-200/80 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300',
                    )}
                  >
                    {submissionsCount}
                  </span>
                </button>

                {/* 5. Backup & Data */}
                <button
                  type="button"
                  onClick={() => onSelectTab('schema')}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer touch-manipulation',
                    activeTab === 'schema'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-100',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                    <div className="flex flex-col text-left leading-tight min-w-0">
                      <span className="truncate">Backup &amp; Data</span>
                      <span className={cn('text-[10px] font-normal truncate', activeTab === 'schema' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500')}>Export &amp; import form</span>
                    </div>
                  </div>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* 4. Active Form Quick Summary Card */}
        {isCollapsed ? (
          <div
            className="flex items-center justify-center py-1 cursor-default"
            title={`Active Target: ${activeSchema.title} (${activeSchema.status})`}
          >
            <span
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-md border shadow-xs',
                activeSchema.status === 'published'
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                  : 'border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  activeSchema.status === 'published' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400',
                )}
              />
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold">
                Active Target
              </span>
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
                    activeSchema.status === 'published' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400',
                  )}
                />
                {activeSchema.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate" title={activeSchema.title}>
              {activeSchema.title}
            </div>
            <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 truncate" title={`https://${activeSchema.customDomain}/${activeSchema.slug}`}>
              https://{activeSchema.customDomain}/{activeSchema.slug}
            </div>
          </div>
        )}

        {/* 5. Quick Actions */}
        {isCollapsed ? (
          <div className="space-y-1.5 flex flex-col items-center">
            <button
              type="button"
              onClick={onOpenShare}
              title="Share public link and embed snippet"
              aria-label="Share and embed"
              className="h-9 w-9 mx-auto flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] shadow-xs transition-all cursor-pointer"
            >
              <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onOpenPreview}
              title={`Preview authentic end-user form on https://${activeSchema.customDomain}/${activeSchema.slug}`}
              aria-label="Public Preview"
              className="h-9 w-9 mx-auto flex items-center justify-center rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 active:scale-[0.98] shadow-xs transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onResetDemo}
              title="Reset all demo tenants, schemas, and submission records to default seed state"
              aria-label="Reset Demo"
              className="h-9 w-9 mx-auto flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] shadow-xs transition-all cursor-pointer"
            >
              <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider px-2 py-0.5">
              Quick Actions
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={onOpenShare}
                title="Share public link and embed snippet"
                aria-label="Share and embed"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.99] shadow-xs transition-all cursor-pointer"
              >
                <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                <span>Share & Embed</span>
              </button>

              <button
                type="button"
                onClick={onOpenPreview}
                title={`Preview authentic end-user form on https://${activeSchema.customDomain}/${activeSchema.slug}`}
                aria-label="Public Preview"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 active:scale-[0.99] shadow-xs transition-all cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                <span>Public Preview</span>
              </button>

              <button
                type="button"
                onClick={onResetDemo}
                title="Reset all demo tenants, schemas, and submission records to default seed state"
                aria-label="Reset Demo"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.99] shadow-xs transition-all cursor-pointer"
              >
                <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span>Reset Demo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Footer: D1 Connection Status & User Profile Card */}
      <div
        className={cn(
          'border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-950/30',
          isCollapsed ? 'p-2 space-y-2' : 'p-3 space-y-2.5',
        )}
      >
        {isCollapsed ? (
          <>
            <div
              className="flex items-center justify-center py-1 cursor-default"
              title={
                backendStatus === 'connected'
                  ? 'All changes saved to cloud'
                  : backendStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Saved to browser backup'
              }
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  backendStatus === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : backendStatus === 'connecting'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-zinc-400 dark:bg-zinc-500',
                )}
              />
            </div>

            {currentUser ? (
              <button
                type="button"
                onClick={onLogout}
                className="h-8 w-8 mx-auto flex items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold text-xs shadow-xs cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all"
                title={`${currentUser.name ?? 'Guest'} - Click to Sign Out / Account`}
                aria-label="Sign Out"
              >
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="h-8 w-8 mx-auto flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold text-xs shadow-xs cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-600 active:scale-[0.98] transition-all"
                title="Guest - Click to Sign Out / Account"
                aria-label="Sign In"
              >
                ?
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold">
                Cloud Sync
              </span>
              {backendStatus === 'connected' ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  title={
                    syncState === 'saving'
                      ? 'Saving changes...'
                      : 'All changes saved to cloud'
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-[9px]">
                    {syncState === 'saving'
                      ? 'Saving...'
                      : 'All changes saved to cloud'}
                  </span>
                </span>
              ) : backendStatus === 'connecting' ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                  title="Connecting to cloud..."
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                  <span className="font-mono text-[9px]">Connecting...</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                  title="Saved to browser backup"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  <span className="font-mono text-[9px]">Saved to browser backup</span>
                </span>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 shadow-xs">
              {currentUser ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold text-xs uppercase shadow-xs"
                      title={`${currentUser.name} (${currentUser.role === 'agency_admin' ? 'Agency View' : 'Business View'})`}
                    >
                      {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                    </div>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {currentUser.name}
                      </span>
                      <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 truncate">
                        {currentUser.email}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    title="Sign Out of account"
                    className="h-7 w-7 p-0 text-xs touch-manipulation text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 shrink-0"
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
                    <span className="sr-only">Sign Out</span>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">Guest Session</span>
                    <span className="font-mono text-[10px] text-zinc-400 truncate">Sign in to save</span>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={onOpenLogin}
                    title="Sign in to your client or agency account"
                    className="h-7 px-2.5 text-xs touch-manipulation shrink-0"
                  >
                    <span>Sign In</span>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* New Client Tenant Onboarding Modal */}
      {isClientModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sidenav-new-client-modal-title"
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
                  id="sidenav-new-client-modal-title"
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
    </aside>
  );
}
