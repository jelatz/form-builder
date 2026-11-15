import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  addField,
  duplicateField,
  moveField,
  moveFieldToGrid,
  removeField,
  updateField,
  updateFormMetadata,
  type ClientTenant,
  type FieldType,
  type FormField,
  type FormSchema,
  type FormValues,
  type SubmissionRecord,
} from './domain/form-schema';
import {
  AuthPage,
  canAccessWorkspace,
  fetchCurrentSessionAction,
  isSuperadmin as checkIsSuperadmin,
  logoutUserAction,
  type AuthSession,
} from './features/auth';
import {
  FormsDirectoryPanel,
  GlobalSubmissionsPanel,
  SubmissionsPanel,
  TenantDashboardPanel,
  TenantsDirectoryPanel,
  type ManagedTenantUser,
} from './features/tenant-submissions';
import {
  apiClearFormSubmissions,
  apiCreateForm,
  apiCreateSubmission,
  apiCreateTenant,
  apiCreateTenantUser,
  apiDeleteForm,
  apiDeleteSubmission,
  apiDeleteTenant,
  apiDeleteTenantUser,
  apiFetchPublicForm,
  apiSubmitPublicForm,
  apiUpdateForm,
  apiUpdateTenant,
  apiUpdateTenantUser,
  fetchSuperadminSnapshot,
  fetchTenantSnapshot,
  filterFormsByTenant,
  filterSubmissionsByTenantForm,
} from './features/tenant-submissions/storage';
import { ensureUniqueTenantSlug } from './features/tenant-submissions/tenant-utils';
import { createDefaultField } from './fields/registry';
import {
  applyResolvedTheme,
  loadThemeMode,
  persistThemeMode,
  resolveThemeMode,
  THEME_OPTIONS,
  type ResolvedTheme,
  type ThemeMode,
} from './shared/lib';
import { Badge, Button, Input, Label, Select, Skeleton } from './shared/ui';

const BuilderCanvas = lazy(() =>
  import('./features/builder-canvas').then((m) => ({
    default: m.BuilderCanvas,
  })),
);
const FieldPalette = lazy(() =>
  import('./features/field-palette').then((m) => ({
    default: m.FieldPalette,
  })),
);
const FormRenderer = lazy(() =>
  import('./features/form-renderer').then((m) => ({
    default: m.FormRenderer,
  })),
);
const PropertyInspector = lazy(() =>
  import('./features/property-inspector').then((m) => ({
    default: m.PropertyInspector,
  })),
);
const SchemaIoPanel = lazy(() =>
  import('./features/schema-io').then((m) => ({
    default: m.SchemaIoPanel,
  })),
);

export type WorkspaceMode =
  | 'dashboard'
  | 'tenants'
  | 'forms'
  | 'edit'
  | 'preview'
  | 'submissions'
  | 'submissions_explorer'
  | 'schema';

type AppRoute =
  | { kind: 'workspace' }
  | { kind: 'tenant_login'; tenantSlug: string }
  | { kind: 'public_form'; tenantSlug: string; formSlug: string };

function parseAppRoute(pathname: string): AppRoute {
  const tenantLoginMatch = pathname.match(/^\/t\/([^/]+)\/login\/?$/i);
  if (tenantLoginMatch?.[1]) {
    return {
      kind: 'tenant_login',
      tenantSlug: decodeURIComponent(tenantLoginMatch[1]).toLowerCase(),
    };
  }

  const publicFormMatch = pathname.match(/^\/f\/([^/]+)\/([^/]+)\/?$/i);
  if (publicFormMatch?.[1] && publicFormMatch[2]) {
    return {
      kind: 'public_form',
      tenantSlug: decodeURIComponent(publicFormMatch[1]).toLowerCase(),
      formSlug: decodeURIComponent(publicFormMatch[2]).toLowerCase(),
    };
  }

  return { kind: 'workspace' };
}

function PublicFormPage({
  tenantSlug,
  formSlug,
}: {
  tenantSlug: string;
  formSlug: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<{
    tenant: { id: string; name: string; slug: string };
    form: FormSchema;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    apiFetchPublicForm(tenantSlug, formSlug)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : 'Published form not found.',
        );
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, formSlug]);

  if (status === 'loading') {
    return <DirectoryModalSkeleton action="preview" />;
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-h-screen w-screen bg-[#f4f5f7] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-2xs space-y-3">
          <Badge variant="danger">UNAVAILABLE</Badge>
          <h1 className="text-base font-semibold text-zinc-900">
            Form not found
          </h1>
          <p className="text-xs text-zinc-500">
            {errorMsg ||
              'This form does not exist, is unpublished, or the workspace is inactive.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-[#f4f5f7] flex flex-col">
      <Suspense fallback={<DirectoryModalSkeleton action="preview" />}>
        <FormRenderer
          key={`${data.form.id}_${data.form.updatedAt}`}
          schema={data.form}
          publicMode={true}
          tenantName={data.tenant.name}
          onSubmitRecord={async (values) => {
            await apiSubmitPublicForm(tenantSlug, formSlug, values);
          }}
        />
      </Suspense>
    </div>
  );
}

type DirectoryModalAction =
  | 'edit'
  | 'preview'
  | 'submissions'
  | 'schema'
  | 'delete';

interface DirectoryModalState {
  action: DirectoryModalAction;
  formId: string;
}

interface FormHistoryEntry {
  past: FormSchema[];
  future: FormSchema[];
}

function DirectoryModalSkeleton({
  action,
}: {
  action: Exclude<DirectoryModalAction, 'delete'>;
}) {
  if (action === 'edit') {
    return (
      <div
        aria-label="Loading builder workspace"
        className="flex-1 flex min-h-0 min-w-0 bg-[#f4f5f7]"
      >
        <div className="w-60 shrink-0 border-r border-zinc-200 bg-white p-3 space-y-2.5">
          <Skeleton className="h-3.5 w-24" />
          <div className="space-y-2 pt-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 overflow-hidden">
          <div className="max-w-2xl mx-auto rounded-lg border border-zinc-200 bg-white p-6 space-y-4 shadow-2xs">
            <div className="space-y-2 border-b border-zinc-200 pb-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3.5 w-72" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md border border-zinc-200 p-4 space-y-2.5"
              >
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="w-80 shrink-0 border-l border-zinc-200 bg-white p-4 space-y-4">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (action === 'preview') {
    return (
      <div
        aria-label="Loading form preview"
        className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
      >
        <div className="max-w-xl mx-auto rounded-lg border border-zinc-200 bg-white p-6 space-y-5 shadow-2xs">
          <div className="space-y-2 border-b border-zinc-200 pb-4">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <div className="pt-2">
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
    );
  }

  if (action === 'submissions') {
    return (
      <div
        aria-label="Loading submissions"
        className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
      >
        <div className="w-full space-y-4">
          <div className="p-4 rounded-lg border border-zinc-200 bg-white flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3.5 w-44" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-20" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label="Loading schema JSON"
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="p-4 rounded-lg border border-zinc-200 bg-white flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-2.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton
              key={i}
              className={i % 3 === 0 ? 'h-4 w-3/4' : 'h-4 w-1/2'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined'
      ? parseAppRoute(window.location.pathname)
      : { kind: 'workspace' },
  );

  const navigatePath = useCallback((nextPath: string) => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(parseAppRoute(nextPath));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setRoute(parseAppRoute(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(
    route.kind !== 'public_form',
  );
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);

  const [tenants, setTenants] = useState<ClientTenant[]>([]);
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [tenantUsers, setTenantUsers] = useState<ManagedTenantUser[]>([]);

  const [activeTenantId, setActiveTenantId] = useState<string>('');
  const [activeFormId, setActiveFormId] = useState<string>('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? tenants[0];
  const tenantForms = activeTenant
    ? filterFormsByTenant(forms, activeTenant.id)
    : [];
  const activeForm =
    tenantForms.find((f) => f.id === activeFormId) ?? tenantForms[0];

  const [historyByForm, setHistoryByForm] = useState<
    Record<string, FormHistoryEntry>
  >({});

  const [inspectorSide, setInspectorSide] = useState<'right' | 'left'>('right');
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('dashboard');
  const [formsTenantFilter, setFormsTenantFilter] = useState<string>('ALL');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    resolveThemeMode('system'),
  );
  const resolvedTheme: ResolvedTheme =
    themeMode === 'system' ? systemTheme : themeMode;
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showHeaderNewFormModal, setShowHeaderNewFormModal] = useState(false);
  const [newHeaderFormTitle, setNewHeaderFormTitle] = useState('');
  const [directoryModal, setDirectoryModal] =
    useState<DirectoryModalState | null>(null);
  const [loadedModalKey, setLoadedModalKey] = useState<string | null>(null);
  const directoryModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHeaderNewFormModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowHeaderNewFormModal(false);
        setNewHeaderFormTitle('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showHeaderNewFormModal]);

  const isDirectoryModalOpen = activeMode === 'forms' && directoryModal !== null;
  const activeModalKey =
    isDirectoryModalOpen && directoryModal
      ? `${directoryModal.action}:${directoryModal.formId}`
      : null;
  const isModalContentReady =
    directoryModal?.action === 'delete' ||
    (activeModalKey !== null && loadedModalKey === activeModalKey);

  useEffect(() => {
    if (!isDirectoryModalOpen) return;

    directoryModalRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showHeaderNewFormModal) {
        event.preventDefault();
        setDirectoryModal(null);
        setLoadedModalKey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDirectoryModalOpen, showHeaderNewFormModal]);

  useEffect(() => {
    if (!activeModalKey || directoryModal?.action === 'delete') return;

    const timer = window.setTimeout(() => {
      setLoadedModalKey(activeModalKey);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeModalKey, directoryModal?.action]);

  useEffect(() => {
    // Clear any stale body inline styles that may have been injected or stuck
    document.body.style.pointerEvents = '';
    document.body.style.userSelect = '';
    document.body.style.overflow = '';

    const IGNORED_TAGS = new Set([
      'HEAD',
      'BODY',
      'SCRIPT',
      'STYLE',
      'LINK',
      'META',
      'TITLE',
    ]);

    const sanitizeExternalElements = () => {
      const candidates: Element[] = [
        ...Array.from(document.documentElement.children),
        ...Array.from(document.body.children),
      ];

      for (const el of candidates) {
        if (
          el instanceof HTMLElement &&
          el.id !== 'root' &&
          el.dataset.appPortal !== 'true' &&
          !IGNORED_TAGS.has(el.tagName)
        ) {
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    };

    // Initial pass
    sanitizeExternalElements();

    // Observe newly injected elements outside #root
    const observer = new MutationObserver(() => {
      sanitizeExternalElements();
    });

    observer.observe(document.documentElement, { childList: true });
    observer.observe(document.body, { childList: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    persistThemeMode(themeMode);
    applyResolvedTheme(resolvedTheme);

    if (
      themeMode !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const nextSystemTheme: ResolvedTheme = mediaQuery.matches
        ? 'dark'
        : 'light';
      setSystemTheme(nextSystemTheme);
      applyResolvedTheme(nextSystemTheme);
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [themeMode, resolvedTheme]);

  const loadWorkspaceData = useCallback(async (session: AuthSession) => {
    setIsWorkspaceLoading(true);
    setSyncError(null);
    try {
      const snapshot = checkIsSuperadmin(session.user)
        ? await fetchSuperadminSnapshot()
        : session.tenant
          ? await fetchTenantSnapshot(session.tenant)
          : { tenants: [], forms: [], submissions: [], users: [] };

      setTenants(snapshot.tenants);
      setForms(snapshot.forms);
      setSubmissions(snapshot.submissions);
      setTenantUsers(snapshot.users);

      const defaultTenantId = checkIsSuperadmin(session.user)
        ? (snapshot.tenants[0]?.id ?? '')
        : (session.user.clientId ?? snapshot.tenants[0]?.id ?? '');

      setActiveTenantId(defaultTenantId);
      setFormsTenantFilter(
        checkIsSuperadmin(session.user) ? 'ALL' : defaultTenantId,
      );

      const firstTenantForm = filterFormsByTenant(
        snapshot.forms,
        defaultTenantId,
      )[0];
      if (firstTenantForm) {
        setActiveFormId(firstTenantForm.id);
        setSelectedFieldId(firstTenantForm.fields[0]?.id ?? null);
      } else {
        setActiveFormId('');
        setSelectedFieldId(null);
      }
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : 'Failed to load workspace data from server.',
      );
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (route.kind === 'public_form') {
      return;
    }

    let cancelled = false;
    fetchCurrentSessionAction()
      .then((session) => {
        if (cancelled) return;
        setAuthSession(session);
        if (session && canAccessWorkspace(session.user)) {
          void loadWorkspaceData(session);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAuthChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [route.kind, loadWorkspaceData]);

  const userIsSuperadmin = checkIsSuperadmin(authSession?.user);

  const activeHistory = activeForm
    ? (historyByForm[activeForm.id] ?? { past: [], future: [] })
    : { past: [], future: [] };

  const canUndo = activeHistory.past.length > 0;
  const canRedo = activeHistory.future.length > 0;

  const selectedField =
    activeForm?.fields.find((f) => f.id === selectedFieldId) ?? null;

  const scopedSubmissions =
    activeTenant && activeForm
      ? filterSubmissionsByTenantForm(
          submissions,
          activeTenant.id,
          activeForm.id,
        )
      : [];

  /**
   * Optimistically updates the active FormSchema in `forms`, records Undo/Redo history,
   * and rolls back to the previous snapshot if API persistence fails.
   */
  const commitFormSchema = (
    nextSchema: FormSchema,
    recordHistory = true,
  ) => {
    if (!activeForm || nextSchema === activeForm) return;
    const prevFormsSnapshot = forms;
    const nextForms = forms.map((f) =>
      f.id === nextSchema.id ? nextSchema : f,
    );

    setForms(nextForms);
    if (recordHistory) {
      setHistoryByForm((prev) => {
        const entry = prev[activeForm.id] ?? { past: [], future: [] };
        return {
          ...prev,
          [activeForm.id]: {
            past: [...entry.past.slice(-29), activeForm],
            future: [],
          },
        };
      });
    }

    apiUpdateForm(nextSchema.clientId, nextSchema.id, {
      title: nextSchema.title,
      slug: nextSchema.slug,
      description: nextSchema.description,
      submitButtonText: nextSchema.submitButtonText,
      isPublished: nextSchema.isPublished,
      fields: nextSchema.fields,
    })
      .then((persisted) => {
        setForms((curr) =>
          curr.map((f) => (f.id === persisted.id ? persisted : f)),
        );
      })
      .catch(() => {
        setForms(prevFormsSnapshot);
        setSyncError('Failed to persist form schema; rolled back changes.');
      });
  };

  const handleUndo = () => {
    if (!activeForm) return;
    const previous = activeHistory.past[activeHistory.past.length - 1];
    if (!previous) return;

    setHistoryByForm((prev) => ({
      ...prev,
      [activeForm.id]: {
        past: activeHistory.past.slice(0, -1),
        future: [activeForm, ...activeHistory.future],
      },
    }));
    commitFormSchema(previous, false);
  };

  const handleRedo = () => {
    if (!activeForm) return;
    const next = activeHistory.future[0];
    if (!next) return;

    setHistoryByForm((prev) => ({
      ...prev,
      [activeForm.id]: {
        past: [...activeHistory.past, activeForm],
        future: activeHistory.future.slice(1),
      },
    }));
    commitFormSchema(next, false);
  };

  const handleSelectTenant = (tenantId: string, navigateToForms = false) => {
    if (!userIsSuperadmin && tenantId !== authSession?.user.clientId) {
      return;
    }
    setActiveTenantId(tenantId);
    const nextTenantForms = filterFormsByTenant(forms, tenantId);
    const firstForm = nextTenantForms[0];
    if (firstForm) {
      setActiveFormId(firstForm.id);
      setSelectedFieldId(firstForm.fields[0]?.id ?? null);
    }
    if (navigateToForms) {
      setFormsTenantFilter(tenantId);
      setActiveMode('forms');
    }
  };

  const handleSelectForm = (formId: string) => {
    const target = tenantForms.find((f) => f.id === formId);
    if (!target) return;
    setActiveFormId(target.id);
    setSelectedFieldId(target.fields[0]?.id ?? null);
  };

  const handleCreateTenant = (input: { name: string; slug: string }) => {
    if (!userIsSuperadmin) return;
    void apiCreateTenant(input)
      .then(({ tenant, starterForm }) => {
        setTenants((prev) => [...prev, tenant]);
        setForms((prev) => [starterForm, ...prev]);
        setActiveTenantId(tenant.id);
        setActiveFormId(starterForm.id);
        setSelectedFieldId(starterForm.fields[0]?.id ?? null);
      })
      .catch((err) => {
        setSyncError(
          err instanceof Error
            ? err.message
            : 'Failed to create tenant workspace.',
        );
      });
  };

  const handleUpdateTenant = (
    tenantId: string,
    input: {
      name: string;
      slug: string;
    },
  ) => {
    if (!userIsSuperadmin) return;
    const prevTenants = tenants;
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;

    const updatedTenant: ClientTenant = {
      ...target,
      name: input.name,
      slug: ensureUniqueTenantSlug(input.slug || input.name, tenants, tenantId),
    };

    const nextTenants = tenants.map((t) =>
      t.id === tenantId ? updatedTenant : t,
    );

    setTenants(nextTenants);
    apiUpdateTenant(tenantId, input)
      .then((persisted) => {
        setTenants((curr) =>
          curr.map((t) => (t.id === persisted.id ? persisted : t)),
        );
      })
      .catch(() => {
        setTenants(prevTenants);
        setSyncError('Failed to update tenant details; rolled back.');
      });
  };

  const handleInspectTenant = (tenantId: string) => {
    handleSelectTenant(tenantId, false);
    setActiveMode('dashboard');
  };

  const handleDeleteTenant = (tenantId: string) => {
    if (!userIsSuperadmin || tenants.length <= 1) return;

    const prevTenants = tenants;
    const prevForms = forms;
    const prevSubmissions = submissions;
    const prevUsers = tenantUsers;

    const nextTenants = tenants.filter((t) => t.id !== tenantId);
    const fallbackTenant = nextTenants[0];
    if (!fallbackTenant) return;

    const removedFormIds = new Set(
      forms.filter((f) => f.clientId === tenantId).map((f) => f.id),
    );
    const nextForms = forms.filter((f) => f.clientId !== tenantId);
    const nextSubmissions = submissions.filter((s) => s.clientId !== tenantId);
    const nextUsers = tenantUsers.filter((u) => u.clientId !== tenantId);

    const fallbackForm = filterFormsByTenant(nextForms, fallbackTenant.id)[0];

    setTenants(nextTenants);
    setForms(nextForms);
    setSubmissions(nextSubmissions);
    setTenantUsers(nextUsers);
    setHistoryByForm((prev) => {
      const nextHistory = { ...prev };
      for (const formId of removedFormIds) {
        delete nextHistory[formId];
      }
      return nextHistory;
    });

    if (activeTenantId === tenantId) {
      setActiveTenantId(fallbackTenant.id);
      if (fallbackForm) {
        setActiveFormId(fallbackForm.id);
        setSelectedFieldId(fallbackForm.fields[0]?.id ?? null);
      }
    }

    if (formsTenantFilter === tenantId) {
      setFormsTenantFilter('ALL');
    }

    apiDeleteTenant(tenantId).catch(() => {
      setTenants(prevTenants);
      setForms(prevForms);
      setSubmissions(prevSubmissions);
      setTenantUsers(prevUsers);
      setSyncError('Failed to delete tenant workspace; rolled back.');
    });
  };

  const handleCreateTenantUser = async (input: {
    clientId: string;
    username: string;
    displayName: string;
    password: string;
    role: 'tenant_admin' | 'tenant_member';
  }) => {
    const created = await apiCreateTenantUser(input);
    setTenantUsers((prev) => [...prev, created]);
  };

  const handleUpdateTenantUser = async (
    userId: string,
    input: {
      role?: 'tenant_admin' | 'tenant_member';
      isActive?: boolean;
      password?: string;
    },
  ) => {
    const updated = await apiUpdateTenantUser(userId, input);
    setTenantUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? updated : u)),
    );
  };

  const handleDeleteTenantUser = async (userId: string) => {
    await apiDeleteTenantUser(userId);
    setTenantUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreateFormForTenant = (targetTenantId: string, title: string) => {
    const effectiveTenantId = userIsSuperadmin
      ? targetTenantId
      : (authSession?.user.clientId ?? targetTenantId);
    const starterField = createDefaultField('text');

    void apiCreateForm(effectiveTenantId, {
      title,
      isPublished: true,
      fields: [starterField],
    })
      .then((newForm) => {
        setForms((prev) => [newForm, ...prev]);
        setActiveTenantId(effectiveTenantId);
        setActiveFormId(newForm.id);
        setSelectedFieldId(newForm.fields[0]?.id ?? null);
        setActiveMode('edit');
      })
      .catch((err) => {
        setSyncError(
          err instanceof Error ? err.message : 'Failed to create form.',
        );
      });
  };

  const handleCreateForm = (title: string) => {
    if (!activeTenant) return;
    handleCreateFormForTenant(activeTenant.id, title);
  };

  const handleCreateHeaderFormSubmit = () => {
    const trimmed = newHeaderFormTitle.trim();
    if (!trimmed) return;
    handleCreateForm(trimmed);
    setNewHeaderFormTitle('');
    setShowHeaderNewFormModal(false);
  };

  const openDirectoryModal = (
    action: DirectoryModalAction,
    form: FormSchema,
  ) => {
    if (action !== 'delete') {
      setActiveTenantId(form.clientId);
      setActiveFormId(form.id);
      setSelectedFieldId(form.fields[0]?.id ?? null);
    }
    setLoadedModalKey(null);
    setDirectoryModal({ action, formId: form.id });
  };

  const closeDirectoryModal = () => {
    setDirectoryModal(null);
    setLoadedModalKey(null);
  };

  const handleViewFormFromDirectory = (form: FormSchema) => {
    setActiveTenantId(form.clientId);
    setActiveFormId(form.id);
    setSelectedFieldId(form.fields[0]?.id ?? null);
    setActiveMode('preview');
  };

  const handleEditFormFromDirectory = (form: FormSchema) => {
    setActiveTenantId(form.clientId);
    setActiveFormId(form.id);
    setSelectedFieldId(form.fields[0]?.id ?? null);
    setActiveMode('edit');
  };

  const handleViewFormSubmissions = (form: FormSchema) => {
    setActiveTenantId(form.clientId);
    setActiveFormId(form.id);
    setSelectedFieldId(form.fields[0]?.id ?? null);
    setActiveMode('submissions');
  };

  const handleDeleteForm = (formId: string) => {
    const targetForm = forms.find((f) => f.id === formId);
    if (!targetForm) return;

    const prevForms = forms;
    const prevSubmissions = submissions;

    const remainingForms = forms.filter((f) => f.id !== formId);
    const nextSubmissions = submissions.filter((s) => s.formId !== formId);

    setForms(remainingForms);
    setSubmissions(nextSubmissions);
    setHistoryByForm((prev) => {
      const nextHistory = { ...prev };
      delete nextHistory[formId];
      return nextHistory;
    });

    apiDeleteForm(targetForm.clientId, formId)
      .then((res) => {
        let fallbackForm = filterFormsByTenant(
          remainingForms,
          targetForm.clientId,
        )[0];

        if (res.replacementForm) {
          fallbackForm = res.replacementForm;
          setForms([...remainingForms, res.replacementForm]);
        }

        if (activeForm?.id === formId && fallbackForm) {
          setActiveFormId(fallbackForm.id);
          setSelectedFieldId(fallbackForm.fields[0]?.id ?? null);
        }
      })
      .catch(() => {
        setForms(prevForms);
        setSubmissions(prevSubmissions);
        setSyncError('Failed to delete form; rolled back changes.');
      });
  };

  const handleAddFieldAt = (
    type: FieldType,
    index?: number,
    presetPatch?: Partial<FormField>,
  ) => {
    if (!activeForm) return;
    const newField = createDefaultField(type, undefined, presetPatch);
    const nextSchema = addField(activeForm, newField, index);
    commitFormSchema(nextSchema);
    setSelectedFieldId(newField.id);
  };

  const handleMoveField = (fromIndex: number, toIndex: number) => {
    if (!activeForm) return;
    commitFormSchema(moveField(activeForm, fromIndex, toIndex));
  };

  const handleMoveFieldToGrid = (
    fieldId: string,
    parentGridId: string | undefined,
    gridColumn?: 0 | 1 | 2,
  ) => {
    if (!activeForm) return;
    commitFormSchema(
      moveFieldToGrid(activeForm, fieldId, parentGridId, gridColumn),
    );
    setSelectedFieldId(fieldId);
  };

  const handleDuplicateField = (fieldId: string) => {
    if (!activeForm) return;
    const nextSchema = duplicateField(activeForm, fieldId);
    commitFormSchema(nextSchema);
    const sourceIdx = activeForm.fields.findIndex((f) => f.id === fieldId);
    const duplicated = nextSchema.fields[sourceIdx + 1];
    if (duplicated) {
      setSelectedFieldId(duplicated.id);
    }
  };

  const handleRemoveField = (fieldId: string) => {
    if (!activeForm) return;
    const nextSchema = removeField(activeForm, fieldId);
    commitFormSchema(nextSchema);
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(nextSchema.fields[0]?.id ?? null);
    }
  };

  const handleUpdateField = (updated: FormField) => {
    if (!activeForm) return;
    commitFormSchema(updateField(activeForm, updated.id, updated));
  };

  const handleUpdateMetadata = (
    patch: Partial<
      Pick<FormSchema, 'title' | 'description' | 'slug' | 'submitButtonText'>
    >,
  ) => {
    if (!activeForm) return;
    commitFormSchema(updateFormMetadata(activeForm, patch));
  };

  const handleImportSchema = (imported: FormSchema) => {
    if (!activeForm || !activeTenant) return;
    const scopedImport: FormSchema = {
      ...imported,
      id: activeForm.id,
      clientId: activeTenant.id,
    };
    commitFormSchema(scopedImport);
    setSelectedFieldId(scopedImport.fields[0]?.id ?? null);
    if (isDirectoryModalOpen) {
      setDirectoryModal((prev) =>
        prev ? { ...prev, action: 'edit' } : null,
      );
    } else {
      setActiveMode('edit');
    }
  };

  const handleRecordSubmission = async (
    values: FormValues,
    targetForm: FormSchema | undefined = activeForm,
  ) => {
    if (!targetForm) return;
    const created = await apiCreateSubmission(
      targetForm.clientId,
      targetForm.id,
      values,
    );
    setSubmissions((prev) => [created, ...prev]);
  };

  const handleDeleteSubmission = (submissionId: string) => {
    const target = submissions.find((s) => s.id === submissionId);
    const targetClientId = target?.clientId ?? activeTenant?.id;
    if (!targetClientId) return;

    const prevSubmissions = submissions;
    const nextSubmissions = submissions.filter((s) => s.id !== submissionId);
    setSubmissions(nextSubmissions);

    apiDeleteSubmission(targetClientId, submissionId).catch(() => {
      setSubmissions(prevSubmissions);
      setSyncError('Failed to delete submission; rolled back.');
    });
  };

  const handleDeleteSubmissionScoped = (
    clientId: string,
    submissionId: string,
  ) => {
    const prevSubmissions = submissions;
    setSubmissions((curr) => curr.filter((s) => s.id !== submissionId));

    apiDeleteSubmission(clientId, submissionId).catch(() => {
      setSubmissions(prevSubmissions);
      setSyncError('Failed to delete submission; rolled back.');
    });
  };

  const handleClearFormSubmissions = () => {
    if (!activeTenant || !activeForm) return;
    const prevSubmissions = submissions;
    const nextSubmissions = submissions.filter(
      (s) => !(s.clientId === activeTenant.id && s.formId === activeForm.id),
    );
    setSubmissions(nextSubmissions);

    apiClearFormSubmissions(activeTenant.id, activeForm.id).catch(() => {
      setSubmissions(prevSubmissions);
      setSyncError('Failed to clear submissions; rolled back.');
    });
  };

  const handleLogout = () => {
    void logoutUserAction().finally(() => {
      setAuthSession(null);
      setTenants([]);
      setForms([]);
      setSubmissions([]);
      setTenantUsers([]);
      setActiveMode('dashboard');
    });
  };

  const renderThemeSelect = (id?: string) => (
    <Select
      id={id}
      aria-label="Theme mode"
      menuHeading="Appearance"
      value={themeMode}
      options={THEME_OPTIONS}
      onValueChange={(val) => setThemeMode(val as ThemeMode)}
      align="right"
      icon={
        resolvedTheme === 'dark' ? (
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        )
      }
      className="h-8 w-28 sm:w-32 text-xs font-medium px-2.5"
    />
  );

  const renderBuilderWorkspace = (
    onNavigateMode: (
      mode: 'forms' | 'edit' | 'preview' | 'submissions' | 'schema',
    ) => void,
  ) => {
    if (!activeForm) return null;
    return (
      <div className="flex-1 flex min-h-0 min-w-0">
        <FieldPalette
          onAddField={(type, presetPatch) => {
            if (type !== 'grid' && type !== 'section' && selectedField) {
              if (selectedField.type === 'grid') {
                handleAddFieldAt(type, undefined, {
                  ...presetPatch,
                  parentGridId: selectedField.id,
                  gridColumn: 0,
                });
                return;
              }
              if (selectedField.parentGridId) {
                handleAddFieldAt(type, undefined, {
                  ...presetPatch,
                  parentGridId: selectedField.parentGridId,
                  gridColumn: selectedField.gridColumn ?? 0,
                });
                return;
              }
            }
            handleAddFieldAt(type, undefined, presetPatch);
          }}
        />

        {inspectorSide === 'left' && (
          <PropertyInspector
            schema={activeForm}
            selectedField={selectedField}
            onUpdateField={handleUpdateField}
            onDuplicateField={handleDuplicateField}
            onRemoveField={handleRemoveField}
            onUpdateMetadata={handleUpdateMetadata}
            onNavigateMode={onNavigateMode}
            onSelectField={setSelectedFieldId}
            inspectorSide={inspectorSide}
            onToggleInspectorSide={() =>
              setInspectorSide((prev) => (prev === 'right' ? 'left' : 'right'))
            }
            themeMode={themeMode}
            onThemeModeChange={(mode) => setThemeMode(mode)}
          />
        )}

        <BuilderCanvas
          schema={activeForm}
          selectedFieldId={selectedFieldId}
          onSelectField={setSelectedFieldId}
          onAddFieldAt={handleAddFieldAt}
          onMoveField={handleMoveField}
          onMoveFieldToGrid={handleMoveFieldToGrid}
          onDuplicateField={handleDuplicateField}
          onRemoveField={handleRemoveField}
          onUpdateMetadata={handleUpdateMetadata}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

        {inspectorSide === 'right' && (
          <PropertyInspector
            schema={activeForm}
            selectedField={selectedField}
            onUpdateField={handleUpdateField}
            onDuplicateField={handleDuplicateField}
            onRemoveField={handleRemoveField}
            onUpdateMetadata={handleUpdateMetadata}
            onNavigateMode={onNavigateMode}
            onSelectField={setSelectedFieldId}
            inspectorSide={inspectorSide}
            onToggleInspectorSide={() =>
              setInspectorSide((prev) => (prev === 'right' ? 'left' : 'right'))
            }
            themeMode={themeMode}
            onThemeModeChange={(mode) => setThemeMode(mode)}
          />
        )}
      </div>
    );
  };

  const modalForm =
    isDirectoryModalOpen && directoryModal
      ? forms.find((f) => f.id === directoryModal.formId) ?? null
      : null;
  const modalTenant = modalForm
    ? tenants.find((t) => t.id === modalForm.clientId) ?? activeTenant
    : activeTenant;
  const modalScopedSubmissions =
    modalForm && modalTenant
      ? filterSubmissionsByTenantForm(submissions, modalTenant.id, modalForm.id)
      : [];
  const modalTenantFormCount = modalForm
    ? filterFormsByTenant(forms, modalForm.clientId).length
    : 0;

  if (route.kind === 'public_form') {
    return (
      <PublicFormPage
        key={`${route.tenantSlug}_${route.formSlug}`}
        tenantSlug={route.tenantSlug}
        formSlug={route.formSlug}
      />
    );
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen w-screen bg-[#f4f5f7] dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-3 flex items-center gap-3 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
            Verifying session...
          </span>
        </div>
      </div>
    );
  }

  if (!authSession || !canAccessWorkspace(authSession.user)) {
    return (
      <AuthPage
        key={route.kind === 'tenant_login' ? route.tenantSlug : 'global'}
        tenantSlug={route.kind === 'tenant_login' ? route.tenantSlug : undefined}
        onAuthenticated={(session) => {
          setAuthSession(session);
          if (
            route.kind === 'tenant_login' ||
            window.location.pathname === '/login'
          ) {
            navigatePath('/');
          }
          void loadWorkspaceData(session);
        }}
        onNavigateGlobalLogin={() => navigatePath('/login')}
      />
    );
  }

  if (isWorkspaceLoading || !activeTenant || !activeForm) {
    return (
      <div className="min-h-screen w-screen bg-[#f4f5f7] dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
              {isWorkspaceLoading ? 'Loading Workspace' : 'Workspace Unavailable'}
            </span>
            <Badge variant={isWorkspaceLoading ? 'neutral' : 'danger'}>
              {isWorkspaceLoading ? 'SYNCING' : 'ERROR'}
            </Badge>
          </div>
          {isWorkspaceLoading ? (
            <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>
                Loading forms and submissions for {authSession.user.displayName}...
              </span>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {syncError ??
                'No workspace data could be loaded for this account.'}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            {!isWorkspaceLoading && (
              <Button
                size="xs"
                variant="primary"
                onClick={() => void loadWorkspaceData(authSession)}
              >
                Retry
              </Button>
            )}
            <Button size="xs" variant="secondary" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f4f5f7] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-row selection:bg-emerald-100 dark:selection:bg-emerald-950/60">
      {/* Left Side Navigation */}
      <aside
        aria-label="Workspace Navigation"
        className={`${
          isSidebarMinimized ? 'w-16' : 'w-60'
        } shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-between transition-[width] duration-200 z-20`}
      >
        {/* Top Section */}
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Header */}
          <div
            className={`h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center shrink-0 ${
              isSidebarMinimized
                ? 'justify-center px-2'
                : 'justify-between px-4'
            }`}
          >
            <div className="flex items-center min-w-0">
              <div
                className="h-7 w-7 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-950/60 dark:border-emerald-800/70 dark:text-emerald-400 flex items-center justify-center shrink-0"
                title="FormBuilder"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              {!isSidebarMinimized && (
                <span className="ml-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 truncate">
                  FormBuilder
                </span>
              )}
            </div>
            {!isSidebarMinimized && (
              <span
                className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
                title="Workspace Online"
              />
            )}
          </div>

          {/* Workspace Mode Navigation */}
          <nav
            aria-label="Workspace Mode"
            className="p-2 space-y-1 flex-1 overflow-y-auto"
          >
            {!isSidebarMinimized && (
              <div className="px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Workspace
              </div>
            )}

            {/* Mode 0: Dashboard */}
            <button
              type="button"
              onClick={() => setActiveMode('dashboard')}
              title={`Dashboard (${tenants.length} tenants)`}
              aria-label="Dashboard"
              className={
                isSidebarMinimized
                  ? `w-10 h-9 mx-auto rounded-md flex items-center justify-center relative transition-colors cursor-pointer ${
                      activeMode === 'dashboard'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                    }`
                  : `w-full h-9 px-2.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeMode === 'dashboard'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                    }`
              }
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
              {!isSidebarMinimized && (
                <>
                  <span className="truncate">Dashboard</span>
                  <span
                    className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                      activeMode === 'dashboard'
                        ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {tenants.length}
                  </span>
                </>
              )}
            </button>

            {/* Mode 1: All Tenants (Superadmin only) */}
            {userIsSuperadmin && (
              <button
                type="button"
                onClick={() => setActiveMode('tenants')}
                title={`All Tenants (${tenants.length})`}
                aria-label="All Tenants"
                className={
                  isSidebarMinimized
                    ? `w-10 h-9 mx-auto rounded-md flex items-center justify-center relative transition-colors cursor-pointer ${
                        activeMode === 'tenants'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                      }`
                    : `w-full h-9 px-2.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        activeMode === 'tenants'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                      }`
                }
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                  <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                  <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                  <path d="M10 6h4" />
                  <path d="M10 10h4" />
                  <path d="M10 14h4" />
                  <path d="M10 18h4" />
                </svg>
                {!isSidebarMinimized && (
                  <>
                    <span className="truncate">All Tenants</span>
                    <span
                      className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                        activeMode === 'tenants'
                          ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {tenants.length}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Mode 2: All Forms */}
            <button
              type="button"
              onClick={() => {
                setFormsTenantFilter(userIsSuperadmin ? 'ALL' : activeTenant.id);
                setActiveMode('forms');
              }}
              title={`${userIsSuperadmin ? 'All Forms' : 'Forms'} (${forms.length})`}
              aria-label={userIsSuperadmin ? 'All Forms' : 'Forms'}
              className={
                isSidebarMinimized
                  ? `w-10 h-9 mx-auto rounded-md flex items-center justify-center relative transition-colors cursor-pointer ${
                      activeMode === 'forms'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                    }`
                  : `w-full h-9 px-2.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeMode === 'forms'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                    }`
              }
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              {!isSidebarMinimized && (
                <>
                  <span className="truncate">
                    {userIsSuperadmin ? 'All Forms' : 'Forms'}
                  </span>
                  <span
                    className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                      activeMode === 'forms'
                        ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {forms.length}
                  </span>
                </>
              )}
            </button>

            {/* Mode 3: Submissions Explorer */}
            <button
              type="button"
              onClick={() => setActiveMode('submissions_explorer')}
              title={`Submissions (${submissions.length})`}
              aria-label="Submissions"
              className={
                isSidebarMinimized
                  ? `w-10 h-9 mx-auto rounded-md flex items-center justify-center relative transition-colors cursor-pointer ${
                      activeMode === 'submissions_explorer'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                    }`
                  : `w-full h-9 px-2.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeMode === 'submissions_explorer'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                    }`
              }
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
              {!isSidebarMinimized && (
                <>
                  <span className="truncate">Submissions</span>
                  <span
                    className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                      activeMode === 'submissions_explorer'
                        ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {submissions.length}
                  </span>
                </>
              )}
            </button>

            {/* Mode 4: Schema JSON */}
            <button
              type="button"
              onClick={() => setActiveMode('schema')}
              title="Schema JSON"
              aria-label="Schema JSON"
              className={
                isSidebarMinimized
                  ? `w-10 h-9 mx-auto rounded-md flex items-center justify-center relative transition-colors cursor-pointer ${
                      activeMode === 'schema'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                    }`
                  : `w-full h-9 px-2.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                      activeMode === 'schema'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                    }`
              }
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              {!isSidebarMinimized && (
                <span className="truncate">Schema JSON</span>
              )}
            </button>
          </nav>
        </div>

        {/* Bottom Scope Footer */}
        <div
          className={`border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 shrink-0 ${
            isSidebarMinimized ? 'p-2 flex justify-center' : 'p-3'
          }`}
        >
          {!isSidebarMinimized ? (
            <div className="space-y-0.5 truncate">
              <div
                className="font-mono text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate"
                title={`/${activeTenant.slug}`}
              >
                /{activeTenant.slug}
              </div>
              <div
                className="font-mono text-xs text-zinc-500 dark:text-zinc-400 truncate"
                title={`/${activeForm.slug}`}
              >
                /{activeForm.slug}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center"
              title={`/${activeTenant.slug}/${activeForm.slug}`}
            >
              <svg
                className="w-4 h-4 text-zinc-400 dark:text-zinc-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
          )}
        </div>
      </aside>

      {/* Right-Hand Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top Navigation Bar */}
        <header className="h-12 px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0 z-10">
          {/* Left Section */}
          <div className="flex items-center min-w-0 gap-2.5">
            {/* Side Navigation Minimize / Expand Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSidebarMinimized((prev) => !prev)}
              aria-label={
                isSidebarMinimized
                  ? 'Expand side navigation'
                  : 'Minimize side navigation'
              }
              aria-expanded={!isSidebarMinimized}
              title={
                isSidebarMinimized
                  ? 'Expand side navigation'
                  : 'Minimize side navigation (icons only)'
              }
              className="h-8 w-8 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                {isSidebarMinimized ? (
                  <path d="m13 15 3-3-3-3" />
                ) : (
                  <path d="m16 15-3-3 3-3" />
                )}
              </svg>
            </button>

            {/* Vertical divider */}
            <div className="h-4 w-px bg-zinc-200 shrink-0" />

            {activeMode === 'dashboard' ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 truncate">
                  Tenant Dashboard
                </span>
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono text-[11px] text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-200 truncate max-w-[220px] shrink-0"
                  title={`Selected Tenant: ${activeTenant.name} (/${activeTenant.slug})`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-[10px] uppercase text-emerald-700 dark:text-emerald-400">
                    Selected:
                  </span>
                  <span className="font-semibold truncate">
                    {activeTenant.name}
                  </span>
                </span>
              </div>
            ) : activeMode === 'tenants' ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 truncate">
                  All Tenants
                </span>
                <Badge variant="neutral">{tenants.length} total</Badge>
              </div>
            ) : activeMode === 'forms' ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 truncate">
                  {userIsSuperadmin ? 'All Forms' : 'Forms'}
                </span>
                <Badge variant="neutral">{forms.length} total</Badge>
              </div>
            ) : activeMode === 'submissions_explorer' ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 truncate">
                  {userIsSuperadmin ? 'Global Submissions' : 'Submissions'}
                </span>
                <Badge variant="neutral">{submissions.length} total</Badge>
              </div>
            ) : (
              <>
                {(activeMode === 'edit' ||
                  activeMode === 'preview' ||
                  activeMode === 'submissions') && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setActiveMode('forms')}
                      aria-label="Back to All Forms"
                      title="Back to All Forms"
                      className="shrink-0"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      <span>All Forms</span>
                    </Button>
                    <div className="h-4 w-px bg-zinc-200 shrink-0" />
                  </>
                )}

                {/* Active Tenant context pill */}
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 font-mono text-[11px] text-zinc-600 truncate max-w-[180px] shrink-0"
                  title={`Tenant: ${activeTenant.name} (/${activeTenant.slug})`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {activeTenant.name}
                </span>

                <div className="flex items-center gap-2 min-w-0">
                  {/* Blue form document icon */}
                  <div className="h-6 w-6 rounded-xs bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                  </div>

                  {/* Form Selector */}
                  <Select
                    aria-label="Active Tenant Form"
                    menuHeading="Active Tenant Forms"
                    value={activeForm.id}
                    onValueChange={handleSelectForm}
                    options={tenantForms.map((f) => ({
                      value: f.id,
                      label: f.title,
                      description: `/${f.slug}`,
                      meta: `${f.fields.length}f`,
                    }))}
                    className="h-8 w-48 sm:w-60 text-xs font-medium px-2.5"
                  />

                  {/* Compact + Form Button */}
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => setShowHeaderNewFormModal(true)}
                    title="Create New Form for Active Tenant"
                    className="shrink-0"
                  >
                    + Form
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Undo / Redo */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <span className="text-sm font-semibold select-none">↺</span>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <span className="text-sm font-semibold select-none">↻</span>
              </button>
            </div>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            {renderThemeSelect('header_theme_select')}
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div
              className="inline-flex items-center gap-2 px-2 h-8 rounded-md bg-zinc-100 border border-zinc-200 shrink-0"
              title={`Signed in as ${authSession.user.displayName} (${authSession.user.role})`}
            >
              <span className="font-mono text-xs text-zinc-700 font-medium">
                {authSession.user.username}
              </span>
              <Badge
                variant={
                  authSession.user.role === 'superadmin'
                    ? 'success'
                    : 'neutral'
                }
              >
                {authSession.user.role}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              Sign Out
            </Button>
          </div>
        </header>

        {/* Sync Error Notice */}
        {syncError && (
          <div
            role="alert"
            className="px-4 py-1.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center justify-between shrink-0"
          >
            <span>{syncError}</span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setSyncError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Main Workspace Viewport */}
        <main className="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
          {activeMode === 'dashboard' && (
            <TenantDashboardPanel
              tenants={tenants}
              forms={forms}
              submissions={submissions}
              activeTenantId={activeTenant.id}
              activeFormId={activeForm.id}
              isSuperadmin={userIsSuperadmin}
              onSelectTenant={handleSelectTenant}
              onCreateTenant={handleCreateTenant}
              onUpdateTenant={handleUpdateTenant}
              onEditForm={handleEditFormFromDirectory}
              onViewForm={handleViewFormFromDirectory}
              onViewFormSubmissions={handleViewFormSubmissions}
              onCreateFormForTenant={handleCreateFormForTenant}
            />
          )}

          {activeMode === 'tenants' && userIsSuperadmin && (
            <TenantsDirectoryPanel
              tenants={tenants}
              forms={forms}
              submissions={submissions}
              users={tenantUsers}
              activeTenantId={activeTenant.id}
              onSelectTenant={handleSelectTenant}
              onInspectTenant={handleInspectTenant}
              onCreateTenant={handleCreateTenant}
              onUpdateTenant={handleUpdateTenant}
              onDeleteTenant={handleDeleteTenant}
              onCreateTenantUser={handleCreateTenantUser}
              onUpdateTenantUser={handleUpdateTenantUser}
              onDeleteTenantUser={handleDeleteTenantUser}
            />
          )}

          {activeMode === 'forms' && (
            <FormsDirectoryPanel
              tenants={tenants}
              forms={forms}
              submissions={submissions}
              activeTenantId={activeTenant.id}
              activeFormId={activeForm.id}
              isSuperadmin={userIsSuperadmin}
              tenantFilter={formsTenantFilter}
              onTenantFilterChange={setFormsTenantFilter}
              isActionModalOpen={isDirectoryModalOpen}
              onViewForm={(form) => openDirectoryModal('preview', form)}
              onEditForm={(form) => openDirectoryModal('edit', form)}
              onViewFormSubmissions={(form) =>
                openDirectoryModal('submissions', form)
              }
              onDeleteForm={(formId) => {
                const target = forms.find((f) => f.id === formId);
                if (target) {
                  openDirectoryModal('delete', target);
                }
              }}
              onCreateFormForTenant={handleCreateFormForTenant}
            />
          )}

        {activeMode === 'edit' && (
          <Suspense fallback={<DirectoryModalSkeleton action="edit" />}>
            {renderBuilderWorkspace(setActiveMode)}
          </Suspense>
        )}

        {activeMode === 'preview' && (
          <Suspense fallback={<DirectoryModalSkeleton action="preview" />}>
            <FormRenderer
              key={`${activeForm.id}_${activeForm.updatedAt}`}
              schema={activeForm}
              onSubmitRecord={handleRecordSubmission}
            />
          </Suspense>
        )}

        {activeMode === 'submissions' && (
          <SubmissionsPanel
            tenant={activeTenant}
            schema={activeForm}
            submissions={scopedSubmissions}
            onDeleteSubmission={handleDeleteSubmission}
            onClearFormSubmissions={handleClearFormSubmissions}
          />
        )}

        {activeMode === 'submissions_explorer' && (
          <GlobalSubmissionsPanel
            tenants={tenants}
            forms={forms}
            submissions={submissions}
            isSuperadmin={userIsSuperadmin}
            activeTenantId={activeTenant.id}
            onDeleteSubmission={handleDeleteSubmissionScoped}
          />
        )}

        {activeMode === 'schema' && (
          <Suspense fallback={<DirectoryModalSkeleton action="schema" />}>
            <SchemaIoPanel
              schema={activeForm}
              availableForms={forms}
              tenants={tenants}
              onSelectForm={(targetForm) => {
                setActiveTenantId(targetForm.clientId);
                setActiveFormId(targetForm.id);
                setSelectedFieldId(targetForm.fields[0]?.id ?? null);
              }}
              onImportSchema={handleImportSchema}
            />
          </Suspense>
        )}
      </main>
    </div>

    {/* Full-Screen Pop-Up Modal: All Forms Table Actions */}
    {isDirectoryModalOpen && directoryModal && modalForm && (
      <div
        ref={directoryModalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-action-modal-title"
        className="fixed inset-0 z-40 h-screen w-screen bg-[#f4f5f7] dark:bg-zinc-950 flex flex-col overflow-hidden focus:outline-none animate-modal-enter"
      >
        <header className="h-12 px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center min-w-0 gap-2.5">
            <Badge
              variant={
                directoryModal.action === 'delete'
                  ? 'danger'
                  : directoryModal.action === 'preview'
                    ? 'success'
                    : 'neutral'
              }
            >
              {directoryModal.action === 'edit'
                ? 'EDIT BUILDER'
                : directoryModal.action === 'preview'
                  ? 'LIVE PREVIEW'
                  : directoryModal.action === 'submissions'
                    ? 'SUBMISSIONS'
                    : directoryModal.action === 'schema'
                      ? 'SCHEMA JSON'
                      : 'DELETE FORM'}
            </Badge>

            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 font-mono text-[11px] text-zinc-600 truncate max-w-[160px] shrink-0"
              title={`Tenant: ${modalTenant.name} (/${modalTenant.slug})`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              {modalTenant.name}
            </span>

            <span
              id="directory-action-modal-title"
              className="font-semibold text-xs sm:text-sm text-zinc-900 truncate"
            >
              {modalForm.title}
            </span>

            <span className="hidden sm:inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-xs text-zinc-500 shrink-0">
              /{modalForm.slug}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {directoryModal.action !== 'delete' && (
              <>
                {directoryModal.action === 'edit' && (
                  <div className="flex items-center gap-1 pr-2 border-r border-zinc-200">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Undo (Ctrl+Z)"
                      aria-label="Undo"
                    >
                      <span className="text-sm font-semibold select-none">
                        ↺
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Redo (Ctrl+Y)"
                      aria-label="Redo"
                    >
                      <span className="text-sm font-semibold select-none">
                        ↻
                      </span>
                    </button>
                  </div>
                )}

                <div className="hidden md:flex items-center gap-1 pr-2 border-r border-zinc-200">
                  {(
                    [
                      ['edit', 'Builder'],
                      ['preview', 'Preview'],
                      ['submissions', 'Submissions'],
                      ['schema', 'Schema'],
                    ] as const
                  ).map(([actionKey, label]) => (
                    <Button
                      key={actionKey}
                      size="xs"
                      variant={
                        directoryModal.action === actionKey
                          ? 'primary'
                          : 'ghost'
                      }
                      onClick={() =>
                        setDirectoryModal({
                          action: actionKey,
                          formId: modalForm.id,
                        })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {renderThemeSelect('modal_header_theme_select')}
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

            <Button
              size="sm"
              variant="secondary"
              onClick={closeDirectoryModal}
              aria-label="Close modal"
              title="Close (Esc)"
              className="shrink-0"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              <span>Close</span>
              <span className="font-mono text-[10px] text-zinc-400 border border-zinc-200 bg-zinc-50 px-1 rounded-xs">
                Esc
              </span>
            </Button>
          </div>
        </header>

        <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
          {directoryModal.action !== 'delete' && !isModalContentReady ? (
            <DirectoryModalSkeleton action={directoryModal.action} />
          ) : (
            <Suspense
              fallback={
                directoryModal.action === 'delete' ? null : (
                  <DirectoryModalSkeleton action={directoryModal.action} />
                )
              }
            >
              <div
                key={activeModalKey}
                className="flex-1 flex min-h-0 min-w-0 overflow-hidden animate-modal-content-enter"
              >
                {directoryModal.action === 'edit' &&
                  renderBuilderWorkspace((nextMode) => {
                    if (nextMode === 'forms') {
                      closeDirectoryModal();
                    } else {
                      setDirectoryModal((prev) =>
                        prev ? { ...prev, action: nextMode } : null,
                      );
                    }
                  })}

                {directoryModal.action === 'preview' && (
                  <FormRenderer
                    key={`${modalForm.id}_${modalForm.updatedAt}`}
                    schema={modalForm}
                    onSubmitRecord={handleRecordSubmission}
                  />
                )}

                {directoryModal.action === 'submissions' && (
                  <SubmissionsPanel
                    tenant={modalTenant}
                    schema={modalForm}
                    submissions={modalScopedSubmissions}
                    onDeleteSubmission={handleDeleteSubmission}
                    onClearFormSubmissions={handleClearFormSubmissions}
                  />
                )}

                {directoryModal.action === 'schema' && (
                  <SchemaIoPanel
                    schema={modalForm}
                    onImportSchema={handleImportSchema}
                  />
                )}

                {directoryModal.action === 'delete' && (
                  <div className="flex-1 flex items-center justify-center p-6 bg-[#f4f5f7] overflow-y-auto">
                    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="danger">DELETE FORM</Badge>
                          <span className="font-mono text-xs text-zinc-500">
                            {modalTenant.name}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-zinc-900">
                          Delete &ldquo;{modalForm.title}&rdquo;?
                        </p>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          This action permanently deletes the form schema and{' '}
                          <span className="font-semibold text-zinc-900">
                            {modalScopedSubmissions.length}{' '}
                            {modalScopedSubmissions.length === 1
                              ? 'submission'
                              : 'submissions'}
                          </span>{' '}
                          recorded under this form.
                        </p>
                        {modalTenantFormCount <= 1 && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                            This is the last remaining form for{' '}
                            {modalTenant.name}. A fresh blank form will be
                            created automatically for this tenant.
                          </p>
                        )}
                      </div>

                      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Route</span>
                          <span className="font-mono text-zinc-800">
                            /{modalForm.slug}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Fields</span>
                          <span className="font-mono text-zinc-800">
                            {modalForm.fields.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Submissions</span>
                          <span className="font-mono text-zinc-800">
                            {modalScopedSubmissions.length}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={closeDirectoryModal}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            handleDeleteForm(modalForm.id);
                            closeDirectoryModal();
                          }}
                        >
                          Delete Form
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Suspense>
          )}
        </div>
      </div>
    )}

    {/* Modal: New Form (Header Action) */}
    {showHeaderNewFormModal && (
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
        onClick={() => {
          setShowHeaderNewFormModal(false);
          setNewHeaderFormTitle('');
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 space-y-3 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <span className="font-mono text-xs uppercase text-zinc-700 font-semibold">
              New Form
            </span>
            <Badge variant="neutral">{activeTenant.name}</Badge>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="header_new_form_title">Form Title</Label>
            <Input
              id="header_new_form_title"
              value={newHeaderFormTitle}
              onChange={(e) => setNewHeaderFormTitle(e.target.value)}
              placeholder="Feedback Survey"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateHeaderFormSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setShowHeaderNewFormModal(false);
                setNewHeaderFormTitle('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              variant="primary"
              disabled={!newHeaderFormTitle.trim()}
              onClick={handleCreateHeaderFormSubmit}
            >
              Create Form
            </Button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
