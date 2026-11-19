import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  addField,
  addFieldToSection,
  addSection,
  countDataFields,
  duplicateField,
  ensureLeadingSection,
  markFormAsDraft,
  moveField,
  moveFieldToGrid,
  moveSection,
  partitionFieldsIntoSections,
  publishFormSchema,
  removeField,
  removeSection,
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
  FormDetailPanel,
  FormIntegrationsPanel,
  FormsDirectoryPanel,
  GlobalSubmissionsPanel,
  SubmissionsPanel,
  TenantDashboardPanel,
  TenantUsersModal,
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
  apiResetTenantUserCredentials,
  apiSubmitPublicForm,
  apiUpdateForm,
  apiUpdateTenant,
  apiUpdateTenantUser,
  fetchSuperadminSnapshot,
  fetchTenantSnapshot,
  filterFormsByTenant,
  filterSubmissionsByTenantForm,
  type ResetUserCredentialsResponse,
} from './features/tenant-submissions/storage';
import { createDefaultField } from './fields/registry';
import {
  applyResolvedTheme,
  buildWorkspacePath,
  isFormScopedMode,
  loadThemeMode,
  parseAppRoute,
  persistThemeMode,
  resolveThemeMode,
  THEME_OPTIONS,
  type AppRoute,
  type ResolvedTheme,
  type ThemeMode,
  type WorkspaceMode,
} from './shared/lib';
import { Badge, Button, Input, Label, PageContainer, Select, Skeleton, Tooltip } from './shared/ui';

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

export type { WorkspaceMode };

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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = data
      ? `${data.form.title} · ${data.tenant.name}`
      : 'FormBuilder';
  }, [data]);

  if (status === 'loading') {
    return <WorkspaceViewSkeleton view="preview" />;
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-h-screen w-screen bg-[#f4f5f7] dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xs space-y-3">
          <Badge variant="danger">UNAVAILABLE</Badge>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Form not found
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {errorMsg ||
              'This form does not exist, is unpublished, or the workspace is inactive.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-[#f4f5f7] dark:bg-zinc-950 flex flex-col">
      <Suspense fallback={<WorkspaceViewSkeleton view="preview" />}>
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

interface FormHistoryEntry {
  past: FormSchema[];
  future: FormSchema[];
}

function WorkspaceViewSkeleton({
  view,
}: {
  view: 'edit' | 'preview' | 'submissions' | 'schema';
}) {
  if (view === 'edit') {
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

  if (view === 'preview') {
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

  if (view === 'submissions') {
    return (
      <div
        aria-label="Loading submissions"
        className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
      >
        <PageContainer>
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
        </PageContainer>
      </div>
    );
  }

  return (
    <div
      aria-label="Loading schema JSON"
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <PageContainer>
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
      </PageContainer>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined'
      ? parseAppRoute(window.location.pathname)
      : { kind: 'workspace', mode: 'dashboard' },
  );

  const navigatePath = useCallback(
    (nextPath: string, options?: { replace?: boolean }) => {
      if (typeof window === 'undefined') return;
      if (window.location.pathname !== nextPath) {
        if (options?.replace) {
          window.history.replaceState({}, '', nextPath);
        } else {
          window.history.pushState({}, '', nextPath);
        }
      }
      setRoute(parseAppRoute(nextPath));
    },
    [],
  );

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const nextRoute = parseAppRoute(window.location.pathname);
      const isSuper = checkIsSuperadmin(authSession?.user);
      if (
        nextRoute.kind === 'workspace' &&
        nextRoute.mode === 'tenants' &&
        authSession &&
        !isSuper
      ) {
        window.history.replaceState({}, '', '/dashboard');
        setRoute({ kind: 'workspace', mode: 'dashboard' });
        return;
      }
      setRoute(nextRoute);
      if (nextRoute.kind === 'workspace' && nextRoute.formId) {
        const matched = forms.find(
          (f) =>
            f.id === nextRoute.formId &&
            (isSuper || f.clientId === authSession?.user.clientId),
        );
        if (matched) {
          setActiveTenantId(matched.clientId);
          setActiveFormId(matched.id);
          setSelectedFieldId(matched.fields[0]?.id ?? null);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [authSession, forms]);

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
  const activeMode: WorkspaceMode =
    route.kind === 'workspace' ? route.mode : 'dashboard';

  useEffect(() => {
    if (typeof document === 'undefined' || route.kind === 'public_form') {
      return;
    }
    if (route.kind === 'tenant_login') {
      document.title = `${route.tenantSlug} Sign In · FormBuilder`;
      return;
    }
    if (!authSession) {
      document.title = 'Sign In · FormBuilder';
      return;
    }
    const modeTitles: Record<WorkspaceMode, string> = {
      dashboard: 'Dashboard · FormBuilder',
      tenants: 'All Tenants · FormBuilder',
      forms: 'All Forms · FormBuilder',
      submissions_explorer: 'Submissions · FormBuilder',
      form_detail: activeForm
        ? `${activeForm.title} · FormBuilder`
        : 'Form Overview · FormBuilder',
      edit: activeForm
        ? `Edit: ${activeForm.title} · FormBuilder`
        : 'Form Builder · FormBuilder',
      preview: activeForm
        ? `Preview: ${activeForm.title} · FormBuilder`
        : 'Form Preview · FormBuilder',
      submissions: activeForm
        ? `Submissions: ${activeForm.title} · FormBuilder`
        : 'Form Submissions · FormBuilder',
      integrations: activeForm
        ? `Integrations: ${activeForm.title} · FormBuilder`
        : 'Integrations · FormBuilder',
      schema: activeForm
        ? `Schema: ${activeForm.title} · FormBuilder`
        : 'Schema JSON · FormBuilder',
    };
    document.title = modeTitles[activeMode];
  }, [route, authSession, activeMode, activeForm]);

  const navigateWorkspace = (
    nextMode: WorkspaceMode,
    nextFormId?: string,
    options?: { replace?: boolean },
  ) => {
    const effectiveFormId =
      nextFormId !== undefined ? nextFormId : activeForm?.id;
    const nextPath = buildWorkspacePath(nextMode, effectiveFormId);
    navigatePath(nextPath, options);
  };
  const [formsTenantFilter, setFormsTenantFilter] = useState<string>('ALL');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsSidebarMinimized(event.matches);
    };
    mediaQuery.addEventListener('change', handleViewportChange);
    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    resolveThemeMode('system'),
  );
  const resolvedTheme: ResolvedTheme =
    themeMode === 'system' ? systemTheme : themeMode;
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showHeaderNewFormModal, setShowHeaderNewFormModal] = useState(false);
  const [newHeaderFormTitle, setNewHeaderFormTitle] = useState('');
  const [showTenantTeamModal, setShowTenantTeamModal] = useState(false);

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

  const loadWorkspaceData = useCallback(
    async (session: AuthSession) => {
      setIsWorkspaceLoading(true);
      setSyncError(null);
      try {
        const isSuperadminSession = checkIsSuperadmin(session.user);
        const snapshot = isSuperadminSession
          ? await fetchSuperadminSnapshot()
          : session.tenant
            ? await fetchTenantSnapshot(
                session.tenant,
                session.user.role === 'tenant_admin',
              )
            : { tenants: [], forms: [], submissions: [], users: [] };

        const normalizedForms = snapshot.forms.map((form) =>
          ensureLeadingSection(form),
        );
        setTenants(snapshot.tenants);
        setForms(normalizedForms);
        setSubmissions(snapshot.submissions);
        setTenantUsers(snapshot.users);

        const currentRoute: AppRoute =
          typeof window !== 'undefined'
            ? parseAppRoute(window.location.pathname)
            : { kind: 'workspace', mode: 'dashboard' };

        const matchedUrlForm =
          currentRoute.kind === 'workspace' && currentRoute.formId
            ? snapshot.forms.find(
                (f) =>
                  f.id === currentRoute.formId &&
                  (isSuperadminSession || f.clientId === session.user.clientId),
              )
            : undefined;

        const defaultTenantId = matchedUrlForm
          ? matchedUrlForm.clientId
          : isSuperadminSession
            ? (snapshot.tenants[0]?.id ?? '')
            : (session.user.clientId ?? snapshot.tenants[0]?.id ?? '');

        setActiveTenantId(defaultTenantId);
        setFormsTenantFilter(isSuperadminSession ? 'ALL' : defaultTenantId);

        const initialForm =
          matchedUrlForm ??
          filterFormsByTenant(snapshot.forms, defaultTenantId)[0];
        if (initialForm) {
          setActiveFormId(initialForm.id);
          setSelectedFieldId(initialForm.fields[0]?.id ?? null);
        } else {
          setActiveFormId('');
          setSelectedFieldId(null);
        }

        if (currentRoute.kind === 'workspace') {
          if (currentRoute.mode === 'tenants' && !isSuperadminSession) {
            navigatePath('/dashboard', { replace: true });
          } else if (
            isFormScopedMode(currentRoute.mode) &&
            (!currentRoute.formId || !matchedUrlForm)
          ) {
            const fallbackPath = buildWorkspacePath(
              currentRoute.mode,
              initialForm?.id,
            );
            navigatePath(fallbackPath, { replace: true });
          } else if (
            typeof window !== 'undefined' &&
            (window.location.pathname === '/' ||
              window.location.pathname === '/login')
          ) {
            navigatePath('/dashboard', { replace: true });
          }
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
    },
    [navigatePath],
  );

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
  const canManageTenantAdmin =
    userIsSuperadmin || authSession?.user.role === 'tenant_admin';

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

  const formSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const formSaveRevisionRef = useRef<Map<string, number>>(new Map());
  const pendingFormSchemasRef = useRef<Map<string, FormSchema>>(new Map());
  const formRollbackBaselineRef = useRef<Map<string, FormSchema>>(new Map());
  const inFlightFormSavesRef = useRef<Set<string>>(new Set());

  const cancelPendingFormSave = useCallback((formId: string) => {
    const existingTimer = formSaveTimersRef.current.get(formId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
      formSaveTimersRef.current.delete(formId);
    }
    pendingFormSchemasRef.current.delete(formId);
    formRollbackBaselineRef.current.delete(formId);
    formSaveRevisionRef.current.set(
      formId,
      (formSaveRevisionRef.current.get(formId) ?? 0) + 1,
    );
  }, []);

  const cancelAllPendingFormSaves = useCallback(() => {
    for (const timer of formSaveTimersRef.current.values()) {
      clearTimeout(timer);
    }
    formSaveTimersRef.current.clear();
    pendingFormSchemasRef.current.clear();
    formRollbackBaselineRef.current.clear();
    for (const formId of formSaveRevisionRef.current.keys()) {
      formSaveRevisionRef.current.set(
        formId,
        (formSaveRevisionRef.current.get(formId) ?? 0) + 1,
      );
    }
  }, []);

  const flushFormSave = useCallback((formId: string) => {
    const runSave = (targetFormId: string) => {
      const existingTimer = formSaveTimersRef.current.get(targetFormId);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        formSaveTimersRef.current.delete(targetFormId);
      }

      if (inFlightFormSavesRef.current.has(targetFormId)) {
        return;
      }

      const schemaToSave = pendingFormSchemasRef.current.get(targetFormId);
      if (!schemaToSave) {
        return;
      }

      pendingFormSchemasRef.current.delete(targetFormId);
      const sentRevision = formSaveRevisionRef.current.get(targetFormId) ?? 0;
      inFlightFormSavesRef.current.add(targetFormId);

      apiUpdateForm(schemaToSave.clientId, schemaToSave.id, {
        title: schemaToSave.title,
        slug: schemaToSave.slug,
        description: schemaToSave.description,
        submitButtonText: schemaToSave.submitButtonText,
        thankYouTitle: schemaToSave.thankYouTitle,
        thankYouMessage: schemaToSave.thankYouMessage,
        redirectUrl: schemaToSave.redirectUrl,
        isPublished: schemaToSave.isPublished,
        fields: schemaToSave.fields,
      })
        .then((persisted) => {
          const isLatest =
            formSaveRevisionRef.current.get(persisted.id) === sentRevision &&
            !pendingFormSchemasRef.current.has(persisted.id);
          if (!isLatest) {
            return;
          }
          formRollbackBaselineRef.current.delete(persisted.id);
          setForms((curr) =>
            curr.map((f) => (f.id === persisted.id ? persisted : f)),
          );
        })
        .catch(() => {
          const isLatest =
            formSaveRevisionRef.current.get(schemaToSave.id) === sentRevision &&
            !pendingFormSchemasRef.current.has(schemaToSave.id);
          if (!isLatest) {
            return;
          }
          const rollback = formRollbackBaselineRef.current.get(schemaToSave.id);
          formRollbackBaselineRef.current.delete(schemaToSave.id);
          if (rollback) {
            setForms((curr) =>
              curr.map((f) => (f.id === rollback.id ? rollback : f)),
            );
          }
          setSyncError('Failed to persist form schema; rolled back changes.');
        })
        .finally(() => {
          inFlightFormSavesRef.current.delete(schemaToSave.id);
          if (
            pendingFormSchemasRef.current.has(schemaToSave.id) &&
            !formSaveTimersRef.current.has(schemaToSave.id)
          ) {
            runSave(schemaToSave.id);
          }
        });
    };

    runSave(formId);
  }, []);

  useEffect(() => {
    const flushAllPending = () => {
      for (const formId of Array.from(pendingFormSchemasRef.current.keys())) {
        flushFormSave(formId);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAllPending();
      }
    };

    window.addEventListener('pagehide', flushAllPending);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const timersMap = formSaveTimersRef.current;

    return () => {
      window.removeEventListener('pagehide', flushAllPending);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      for (const timer of timersMap.values()) {
        clearTimeout(timer);
      }
      timersMap.clear();
    };
  }, [flushFormSave]);

  /**
   * Optimistically updates the active FormSchema in `forms`, records Undo/Redo history,
   * and persists to the API sequentially (debounced for rapid typing) so stale in-flight
   * responses never overwrite newer local edits.
   */
  const commitFormSchema = (
    nextSchema: FormSchema,
    recordHistory = true,
    debounceMs = 0,
    options?: { preservePublishState?: boolean },
  ) => {
    if (!activeForm || nextSchema === activeForm) return;

    const effectiveSchema: FormSchema = options?.preservePublishState
      ? nextSchema
      : markFormAsDraft(nextSchema);

    if (!formRollbackBaselineRef.current.has(effectiveSchema.id)) {
      formRollbackBaselineRef.current.set(effectiveSchema.id, activeForm);
    }

    const nextRevision =
      (formSaveRevisionRef.current.get(effectiveSchema.id) ?? 0) + 1;
    formSaveRevisionRef.current.set(effectiveSchema.id, nextRevision);

    setForms((curr) =>
      curr.map((f) => (f.id === effectiveSchema.id ? effectiveSchema : f)),
    );
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

    pendingFormSchemasRef.current.set(effectiveSchema.id, effectiveSchema);

    const existingTimer = formSaveTimersRef.current.get(effectiveSchema.id);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
      formSaveTimersRef.current.delete(effectiveSchema.id);
    }

    if (debounceMs > 0) {
      const timer = setTimeout(() => {
        formSaveTimersRef.current.delete(effectiveSchema.id);
        flushFormSave(effectiveSchema.id);
      }, debounceMs);
      formSaveTimersRef.current.set(effectiveSchema.id, timer);
    } else {
      flushFormSave(effectiveSchema.id);
    }
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
    commitFormSchema(previous, false, 0, { preservePublishState: true });
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
    commitFormSchema(next, false, 0, { preservePublishState: true });
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
    } else {
      setActiveFormId('');
      setSelectedFieldId(null);
    }
    if (navigateToForms) {
      setFormsTenantFilter(tenantId);
      navigateWorkspace('forms');
    } else if (isFormScopedMode(activeMode)) {
      navigateWorkspace(activeMode, firstForm?.id ?? '');
    }
  };

  const handleSelectForm = (formId: string) => {
    const target = tenantForms.find((f) => f.id === formId);
    if (!target) return;
    setActiveFormId(target.id);
    setSelectedFieldId(target.fields[0]?.id ?? null);
    if (isFormScopedMode(activeMode)) {
      navigateWorkspace(activeMode, target.id);
    }
  };

  const handleCreateTenant = async (input: {
    name: string;
    slug: string;
    adminUsername: string;
    email: string;
  }) => {
    if (!userIsSuperadmin) return;
    const { tenant, adminUser } = await apiCreateTenant(input);
    setTenants((prev) => [...prev, tenant]);
    setTenantUsers((prev) => [...prev, adminUser]);
    setActiveTenantId(tenant.id);
    setActiveFormId('');
    setSelectedFieldId(null);
  };

  const handleUpdateTenant = async (
    tenantId: string,
    input: {
      name: string;
      slug: string;
      status?: 'active' | 'suspended';
    },
  ) => {
    if (!userIsSuperadmin) return;
    const persisted = await apiUpdateTenant(tenantId, input);
    setTenants((curr) =>
      curr.map((t) => (t.id === persisted.id ? persisted : t)),
    );
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
    for (const formId of removedFormIds) {
      cancelPendingFormSave(formId);
    }
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
      } else {
        setActiveFormId('');
        setSelectedFieldId(null);
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
      username?: string;
      displayName?: string;
      role?: 'tenant_admin' | 'tenant_member';
      isActive?: boolean;
      password?: string;
    },
  ) => {
    const scopedClientId = userIsSuperadmin ? undefined : activeTenant?.id;
    const updated = await apiUpdateTenantUser(userId, input, scopedClientId);
    setTenantUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? updated : u)),
    );
  };

  const handleDeleteTenantUser = async (userId: string) => {
    const scopedClientId = userIsSuperadmin ? undefined : activeTenant?.id;
    await apiDeleteTenantUser(userId, scopedClientId);
    setTenantUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleResetTenantUserCredentials = async (
    userId: string,
    input: { password?: string; email?: string },
  ): Promise<ResetUserCredentialsResponse> => {
    const scopedClientId = userIsSuperadmin ? undefined : activeTenant?.id;
    const result = await apiResetTenantUserCredentials(
      userId,
      input,
      scopedClientId,
    );
    setTenantUsers((prev) =>
      prev.map((u) => (u.id === result.user.id ? result.user : u)),
    );
    return result;
  };

  const handleCreateFormForTenant = (targetTenantId: string, title: string) => {
    const effectiveTenantId = userIsSuperadmin
      ? targetTenantId
      : (authSession?.user.clientId ?? targetTenantId);
    const starterSection = createDefaultField('section', undefined, {
      label: 'Section 1',
      showLine: true,
    });
    const starterField = createDefaultField('text');

    void apiCreateForm(effectiveTenantId, {
      title,
      isPublished: true,
      fields: [starterSection, starterField],
    })
      .then((newForm) => {
        const normalized = ensureLeadingSection(newForm);
        setForms((prev) => [normalized, ...prev]);
        setActiveTenantId(effectiveTenantId);
        setActiveFormId(normalized.id);
        setSelectedFieldId(
          normalized.fields.find((f) => f.type !== 'section')?.id ??
            normalized.fields[0]?.id ??
            null,
        );
        navigateWorkspace('edit', normalized.id);
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

  const handleOpenFormDetail = (form: FormSchema) => {
    setActiveTenantId(form.clientId);
    setActiveFormId(form.id);
    setSelectedFieldId(form.fields[0]?.id ?? null);
    navigateWorkspace('form_detail', form.id);
  };

  const handleDeleteForm = (formId: string) => {
    const targetForm = forms.find((f) => f.id === formId);
    if (!targetForm) return;

    cancelPendingFormSave(formId);

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

    if (activeMode === 'form_detail' && activeForm?.id === formId) {
      navigateWorkspace('forms');
    }

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
          if (activeMode !== 'form_detail' && isFormScopedMode(activeMode)) {
            navigateWorkspace(activeMode, fallbackForm.id, { replace: true });
          }
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
    if (type === 'section') {
      const sectionCount = activeForm.fields.filter(
        (f) => f.type === 'section',
      ).length;
      const customTitle =
        typeof presetPatch?.label === 'string' && presetPatch.label.trim()
          ? presetPatch.label
          : `Section ${sectionCount + 1}`;
      const newField = createDefaultField('section', undefined, {
        showLine: true,
        ...presetPatch,
        label: customTitle,
      });
      const nextSchema = addField(activeForm, newField, index);
      commitFormSchema(nextSchema);
      setSelectedFieldId(newField.id);
      return;
    }
    const newField = createDefaultField(type, undefined, presetPatch);
    const nextSchema = addField(activeForm, newField, index);
    commitFormSchema(nextSchema);
    setSelectedFieldId(newField.id);
  };

  const handleAddSection = (afterSectionId?: string) => {
    if (!activeForm) return;
    const nextSchema = addSection(activeForm, undefined, undefined, afterSectionId);
    commitFormSchema(nextSchema);
    const addedSection = nextSchema.fields.find(
      (f) =>
        f.type === 'section' &&
        !activeForm.fields.some((existing) => existing.id === f.id),
    );
    if (addedSection) {
      setSelectedFieldId(addedSection.id);
    }
  };

  const handleMoveSection = (sectionId: string, direction: 'up' | 'down') => {
    if (!activeForm) return;
    commitFormSchema(moveSection(activeForm, sectionId, direction));
  };

  const handleRemoveSection = (sectionId: string) => {
    if (!activeForm) return;
    const nextSchema = removeSection(activeForm, sectionId);
    commitFormSchema(nextSchema);
    if (selectedFieldId === sectionId) {
      setSelectedFieldId(nextSchema.fields[0]?.id ?? null);
    }
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
    commitFormSchema(updateField(activeForm, updated.id, updated), true, 350);
  };

  const handleUpdateMetadata = (
    patch: Partial<
      Pick<
        FormSchema,
        | 'title'
        | 'description'
        | 'slug'
        | 'submitButtonText'
        | 'thankYouTitle'
        | 'thankYouMessage'
        | 'redirectUrl'
        | 'isPublished'
      >
    >,
  ) => {
    if (!activeForm) return;
    const isExplicitPublishChange = typeof patch.isPublished === 'boolean';
    const nextPatch = isExplicitPublishChange
      ? patch
      : { ...patch, isPublished: false };
    commitFormSchema(
      updateFormMetadata(activeForm, nextPatch),
      !isExplicitPublishChange,
      isExplicitPublishChange ? 0 : 350,
      { preservePublishState: isExplicitPublishChange },
    );
  };

  const handlePublishForm = () => {
    if (!activeForm || activeForm.isPublished !== false) return;
    commitFormSchema(publishFormSchema(activeForm), false, 0, {
      preservePublishState: true,
    });
  };

  const handleImportSchema = (imported: FormSchema) => {
    if (!activeForm || !activeTenant) return;
    const scopedImport: FormSchema = ensureLeadingSection({
      ...imported,
      id: activeForm.id,
      clientId: activeTenant.id,
    });
    commitFormSchema(scopedImport);
    setSelectedFieldId(scopedImport.fields[0]?.id ?? null);
    navigateWorkspace('edit', activeForm.id);
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
    cancelAllPendingFormSaves();
    void logoutUserAction().finally(() => {
      setAuthSession(null);
      setTenants([]);
      setForms([]);
      setSubmissions([]);
      setTenantUsers([]);
      setShowTenantTeamModal(false);
      navigatePath('/login');
    });
  };

  const cycleThemeMode = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(themeMode);
    const nextMode = order[(currentIndex + 1) % order.length] ?? 'light';
    setThemeMode(nextMode);
  };

  const renderThemeIcon = (sizeClass = 'w-3.5 h-3.5') =>
    resolvedTheme === 'dark' ? (
      <svg
        className={sizeClass}
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
        className={sizeClass}
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
    );

  const renderThemeSelect = (id?: string) => (
    <Select
      id={id}
      aria-label="Theme mode"
      menuHeading="Appearance"
      value={themeMode}
      options={THEME_OPTIONS}
      onValueChange={(val) => setThemeMode(val as ThemeMode)}
      align="left"
      icon={renderThemeIcon('w-3.5 h-3.5')}
      className="h-8 text-xs font-medium px-2.5"
    />
  );

  const renderBuilderWorkspace = () => {
    if (!activeForm) return null;
    return (
      <div className="flex-1 flex min-h-0 min-w-0">
        <FieldPalette
          onAddField={(type, presetPatch) => {
            if (type === 'section') {
              handleAddFieldAt('section', undefined, presetPatch);
              return;
            }
            if (type !== 'grid' && selectedField) {
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
              const sections = partitionFieldsIntoSections(activeForm.fields);
              const activeSection = sections.find(
                (sec) =>
                  sec.sectionField?.id === selectedField.id ||
                  sec.topLevelFields.some((f) => f.id === selectedField.id),
              );
              if (activeSection?.sectionField) {
                const newField = createDefaultField(type, undefined, presetPatch);
                const nextSchema = addFieldToSection(
                  activeForm,
                  newField,
                  activeSection.sectionField.id,
                );
                commitFormSchema(nextSchema);
                setSelectedFieldId(newField.id);
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
          onUpdateField={handleUpdateField}
          onAddSection={handleAddSection}
          onMoveSection={handleMoveSection}
          onRemoveSection={handleRemoveSection}
          onMoveField={handleMoveField}
          onMoveFieldToGrid={handleMoveFieldToGrid}
          onDuplicateField={handleDuplicateField}
          onRemoveField={handleRemoveField}
          onUpdateMetadata={handleUpdateMetadata}
        />

        {inspectorSide === 'right' && (
          <PropertyInspector
            schema={activeForm}
            selectedField={selectedField}
            onUpdateField={handleUpdateField}
            onDuplicateField={handleDuplicateField}
            onRemoveField={handleRemoveField}
            onUpdateMetadata={handleUpdateMetadata}
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
            window.location.pathname === '/login' ||
            window.location.pathname === '/'
          ) {
            navigatePath('/dashboard');
          }
          void loadWorkspaceData(session);
        }}
        onNavigateGlobalLogin={() => navigatePath('/login')}
      />
    );
  }

  if (isWorkspaceLoading || (!activeTenant && !userIsSuperadmin)) {
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
    <div className="h-screen w-full overflow-hidden bg-[#f4f5f7] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-row selection:bg-emerald-100 dark:selection:bg-emerald-950/60">
      {!isSidebarMinimized && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
            onClick={() => setIsSidebarMinimized(true)}
            aria-hidden="true"
          />
          <div className="w-16 shrink-0 md:hidden" aria-hidden="true" />
        </>
      )}
      {/* Left Side Navigation */}
      <aside
        aria-label="Workspace Navigation"
        className={`${
          isSidebarMinimized
            ? 'w-16 z-20'
            : 'w-60 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-xl md:z-20'
        } shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-between transition-[width] duration-200`}
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
            <Tooltip content={userIsSuperadmin ? `Dashboard · ${tenants.length} ${tenants.length === 1 ? 'tenant' : 'tenants'}` : 'Dashboard'} side="right" disabled={!isSidebarMinimized} className="flex w-full">
              <button
                type="button"
                onClick={() => navigateWorkspace('dashboard')}
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
                    {userIsSuperadmin && (
                      <span
                        className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
                          activeMode === 'dashboard'
                            ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {tenants.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            </Tooltip>

            {/* Mode 1: All Tenants (Superadmin only) */}
            {userIsSuperadmin && (
              <Tooltip content={`All Tenants · ${tenants.length}`} side="right" disabled={!isSidebarMinimized} className="flex w-full">
                <button
                  type="button"
                  onClick={() => navigateWorkspace('tenants')}
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
              </Tooltip>
            )}

            {/* Mode 2: All Forms */}
            <Tooltip content={`${userIsSuperadmin ? 'All Forms' : 'Forms'} · ${forms.length}`} side="right" disabled={!isSidebarMinimized} className="flex w-full">
              <button
                type="button"
                onClick={() => {
                  setFormsTenantFilter(
                    userIsSuperadmin ? 'ALL' : (activeTenant?.id ?? ''),
                  );
                  navigateWorkspace('forms');
                }}
                aria-label={userIsSuperadmin ? 'All Forms' : 'Forms'}
                className={
                  isSidebarMinimized
                    ? `w-10 h-9 mx-auto rounded-md flex items-center justify-center relative transition-colors cursor-pointer ${
                        activeMode === 'forms' || activeMode === 'form_detail'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                      }`
                    : `w-full h-9 px-2.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                        activeMode === 'forms' || activeMode === 'form_detail'
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
                        activeMode === 'forms' || activeMode === 'form_detail'
                          ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {forms.length}
                    </span>
                  </>
                )}
              </button>
            </Tooltip>

            {/* Mode 3: Submissions Explorer */}
            <Tooltip content={`Submissions · ${submissions.length}`} side="right" disabled={!isSidebarMinimized} className="flex w-full">
              <button
                type="button"
                onClick={() => navigateWorkspace('submissions_explorer')}
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
            </Tooltip>

            {/* Mode 4: Schema JSON */}
            <Tooltip content="Schema JSON" side="right" disabled={!isSidebarMinimized} className="flex w-full">
              <button
                type="button"
                onClick={() => navigateWorkspace('schema', activeForm?.id)}
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
            </Tooltip>
          </nav>
        </div>

        {/* Bottom Account & Appearance Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 shrink-0">
          {!isSidebarMinimized ? (
            <div className="p-3 space-y-2">
              {renderThemeSelect('sidebar_theme_select')}

              <div
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
                title={`Signed in as ${authSession.user.displayName} (@${authSession.user.username})`}
              >
                <span className="text-xs text-zinc-800 dark:text-zinc-200 font-medium truncate">
                  {authSession.user.displayName || authSession.user.username}
                </span>
                <Badge
                  variant={
                    authSession.user.role === 'superadmin'
                      ? 'success'
                      : 'neutral'
                  }
                  className="shrink-0"
                >
                  {authSession.user.role === 'superadmin'
                    ? 'Superadmin'
                    : authSession.user.role === 'tenant_admin'
                      ? 'Admin'
                      : 'Member'}
                </Badge>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleLogout}
                aria-label="Sign out"
                className="w-full justify-center gap-1.5"
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="p-2 flex flex-col items-center gap-1">
              <Tooltip
                content={`Appearance: ${themeMode} (click to switch)`}
                side="right"
              >
                <button
                  type="button"
                  onClick={cycleThemeMode}
                  aria-label={`Appearance: ${themeMode}. Switch theme mode`}
                  className="w-10 h-9 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  {renderThemeIcon('w-4 h-4')}
                </button>
              </Tooltip>

              <Tooltip
                content={`${authSession.user.displayName || authSession.user.username} · ${
                  authSession.user.role === 'superadmin'
                    ? 'Superadmin'
                    : authSession.user.role === 'tenant_admin'
                      ? 'Admin'
                      : 'Member'
                }`}
                side="right"
              >
                <div
                  aria-label={`Signed in as ${authSession.user.displayName || authSession.user.username}`}
                  className="w-10 h-9 rounded-md flex items-center justify-center text-zinc-600 dark:text-zinc-400"
                >
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
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </Tooltip>

              <Tooltip content="Sign Out" side="right">
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  className="w-10 h-9 rounded-md flex items-center justify-center text-zinc-600 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
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
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>

      {/* Right-Hand Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top Navigation Bar */}
        <header className="h-12 px-2.5 sm:px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-10 min-w-0">
          {/* Left Section */}
          <div className="flex items-center min-w-0 gap-2 sm:gap-2.5">
            {/* Side Navigation Minimize / Expand Toggle Button */}
            <Tooltip content={isSidebarMinimized ? 'Expand sidebar' : 'Collapse sidebar'} side="bottom">
              <button
                type="button"
                onClick={() => setIsSidebarMinimized((prev) => !prev)}
                aria-label={
                  isSidebarMinimized
                    ? 'Expand side navigation'
                    : 'Minimize side navigation'
                }
                aria-expanded={!isSidebarMinimized}
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
            </Tooltip>

            {/* Vertical divider */}
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0 hidden sm:block" />

            {activeMode === 'dashboard' ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {userIsSuperadmin ? 'Dashboard' : 'Workspace Overview'}
                </span>
                {userIsSuperadmin && (
                  <span className="hidden sm:inline-flex">
                    <Badge variant="neutral">
                      {tenants.length} {tenants.length === 1 ? 'tenant' : 'tenants'}
                    </Badge>
                  </span>
                )}
                <span className="hidden sm:inline-flex">
                  <Badge variant="neutral">
                    {forms.length} {forms.length === 1 ? 'form' : 'forms'}
                  </Badge>
                </span>
              </div>
            ) : activeMode === 'tenants' ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  All Tenants
                </span>
                <span className="hidden sm:inline-flex">
                  <Badge variant="neutral">{tenants.length} total</Badge>
                </span>
              </div>
            ) : activeMode === 'forms' ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {userIsSuperadmin ? 'All Forms' : 'Forms'}
                </span>
                <span className="hidden sm:inline-flex">
                  <Badge variant="neutral">{forms.length} total</Badge>
                </span>
              </div>
            ) : activeMode === 'submissions_explorer' ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {userIsSuperadmin ? 'Global Submissions' : 'Submissions'}
                </span>
                <span className="hidden sm:inline-flex">
                  <Badge variant="neutral">{submissions.length} total</Badge>
                </span>
              </div>
            ) : (
              <>
                {(activeMode === 'form_detail' ||
                  activeMode === 'edit' ||
                  activeMode === 'preview' ||
                  activeMode === 'submissions' ||
                  activeMode === 'integrations') && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigateWorkspace('forms')}
                      aria-label={
                        userIsSuperadmin ? 'Back to All Forms' : 'Back to Forms'
                      }
                      title={
                        userIsSuperadmin ? 'Back to All Forms' : 'Back to Forms'
                      }
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
                      <span>{userIsSuperadmin ? 'All Forms' : 'Forms'}</span>
                    </Button>
                    {activeMode !== 'form_detail' && activeForm && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigateWorkspace('form_detail', activeForm.id)
                        }
                        aria-label="Form Overview"
                        title="Back to Form Overview"
                        className="shrink-0"
                      >
                        <span>Form Overview</span>
                      </Button>
                    )}
                    <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  </>
                )}

                {/* Active Tenant context / switcher */}
                {userIsSuperadmin && tenants.length > 1 && activeTenant ? (
                  <Select
                    aria-label="Active Tenant"
                    menuHeading="Switch Tenant Workspace"
                    value={activeTenant.id}
                    onValueChange={(nextId) => handleSelectTenant(nextId, false)}
                    options={tenants.map((t) => {
                      const count = forms.filter((f) => f.clientId === t.id).length;
                      return {
                        value: t.id,
                        label: t.name,
                        meta: `${count} ${count === 1 ? 'form' : 'forms'}`,
                      };
                    })}
                    className="h-8 w-40 sm:w-44 text-xs font-medium px-2.5 shrink-0"
                  />
                ) : activeTenant ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 font-mono text-[11px] text-zinc-600 dark:text-zinc-300 truncate max-w-[180px] shrink-0"
                    title={activeTenant.name}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {activeTenant.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
                    No Tenant
                  </span>
                )}

                {activeForm && (
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
                      options={tenantForms.map((f) => {
                        const fieldCount = countDataFields(f.fields);
                        return {
                          value: f.id,
                          label: f.title,
                          description: f.description,
                          meta: `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`,
                        };
                      })}
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
                )}
              </>
            )}
          </div>

          {/* Right Section */}
          {activeMode === 'edit' && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <Tooltip content="Undo (Ctrl+Z)" side="bottom">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    aria-label="Undo"
                  >
                    <span className="text-sm font-semibold select-none">↺</span>
                  </button>
                </Tooltip>
                <Tooltip content="Redo (Ctrl+Y)" side="bottom">
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    aria-label="Redo"
                  >
                    <span className="text-sm font-semibold select-none">↻</span>
                  </button>
                </Tooltip>
              </div>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              {activeForm && (
                <>
                  <Badge
                    size="sm"
                    variant={
                      activeForm.isPublished === false ? 'warning' : 'success'
                    }
                    title={
                      activeForm.isPublished === false
                        ? 'Form has unpublished draft changes'
                        : 'All changes are published'
                    }
                  >
                    {activeForm.isPublished === false ? 'DRAFT' : 'PUBLISHED'}
                  </Badge>
                  <Button
                    size="sm"
                    variant={
                      activeForm.isPublished === false
                        ? 'primary'
                        : 'secondary'
                    }
                    disabled={activeForm.isPublished !== false}
                    onClick={handlePublishForm}
                    aria-label={
                      activeForm.isPublished === false
                        ? 'Publish Changes'
                        : 'Changes Published'
                    }
                    title={
                      activeForm.isPublished === false
                        ? 'Publish draft changes to live form'
                        : 'All changes are already published'
                    }
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
                      {activeForm.isPublished === false ? (
                        <>
                          <path d="M12 19V5" />
                          <path d="m5 12 7-7 7 7" />
                        </>
                      ) : (
                        <polyline points="20 6 9 17 4 12" />
                      )}
                    </svg>
                    <span>
                      {activeForm.isPublished === false
                        ? 'Publish Changes'
                        : 'Published'}
                    </span>
                  </Button>
                </>
              )}
            </div>
          )}
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
              activeTenantId={activeTenant?.id ?? ''}
              isSuperadmin={userIsSuperadmin}
              canManageTeam={canManageTenantAdmin}
              teamCount={
                activeTenant
                  ? tenantUsers.filter((u) => u.clientId === activeTenant.id)
                      .length
                  : 0
              }
              onOpenTeamModal={() => setShowTenantTeamModal(true)}
              onSelectTenant={handleSelectTenant}
              onCreateTenant={handleCreateTenant}
              onOpenForm={handleOpenFormDetail}
              onCreateFormForTenant={handleCreateFormForTenant}
            />
          )}

          {activeMode === 'tenants' && userIsSuperadmin && (
            <TenantsDirectoryPanel
              tenants={tenants}
              forms={forms}
              submissions={submissions}
              users={tenantUsers}
              onSelectTenant={handleSelectTenant}
              onCreateTenant={handleCreateTenant}
              onUpdateTenant={handleUpdateTenant}
              onDeleteTenant={handleDeleteTenant}
              onCreateTenantUser={handleCreateTenantUser}
              onUpdateTenantUser={handleUpdateTenantUser}
              onDeleteTenantUser={handleDeleteTenantUser}
              onResetTenantUserCredentials={handleResetTenantUserCredentials}
            />
          )}

          {activeMode === 'forms' && (
            <FormsDirectoryPanel
              tenants={tenants}
              forms={forms}
              submissions={submissions}
              activeTenantId={activeTenant?.id ?? ''}
              activeFormId={activeForm?.id ?? ''}
              isSuperadmin={userIsSuperadmin}
              tenantFilter={formsTenantFilter}
              onTenantFilterChange={setFormsTenantFilter}
              onOpenForm={handleOpenFormDetail}
              onCreateFormForTenant={handleCreateFormForTenant}
            />
          )}

          {(activeMode === 'form_detail' ||
            activeMode === 'edit' ||
            activeMode === 'preview' ||
            activeMode === 'submissions' ||
            activeMode === 'integrations' ||
            activeMode === 'schema') &&
            !activeForm && (
              <div className="flex-1 flex items-center justify-center p-6 bg-[#f4f5f7] dark:bg-zinc-950">
                <div className="max-w-md w-full rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center space-y-3">
                  {activeTenant ? (
                    <>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        No forms in {activeTenant.name} yet
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Create your first form to open the builder, preview, or submissions view.
                      </p>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setShowHeaderNewFormModal(true)}
                      >
                        + Create First Form
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        No client tenants created yet
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Create a client tenant workspace first before building or managing forms.
                      </p>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => navigateWorkspace('tenants')}
                      >
                        Go to All Tenants
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

          {activeMode === 'form_detail' && activeTenant && activeForm && (
            <FormDetailPanel
              tenant={activeTenant}
              form={activeForm}
              submissions={scopedSubmissions}
              tenantFormCount={tenantForms.length}
              onBackToForms={() => navigateWorkspace('forms')}
              onOpenBuilder={(fieldId) => {
                setSelectedFieldId(fieldId ?? activeForm.fields[0]?.id ?? null);
                navigateWorkspace('edit', activeForm.id);
              }}
              onViewForm={() => navigateWorkspace('preview', activeForm.id)}
              onViewSubmissions={() =>
                navigateWorkspace('submissions', activeForm.id)
              }
              onOpenIntegrations={() =>
                navigateWorkspace('integrations', activeForm.id)
              }
              onTogglePublish={(isPublished) =>
                handleUpdateMetadata({ isPublished })
              }
              canDeleteForm={canManageTenantAdmin}
              onDeleteForm={handleDeleteForm}
            />
          )}

        {activeMode === 'integrations' && activeTenant && activeForm && (
          <FormIntegrationsPanel
            key={activeForm.id}
            tenant={activeTenant}
            form={activeForm}
            onBackToOverview={() =>
              navigateWorkspace('form_detail', activeForm.id)
            }
          />
        )}

        {activeMode === 'edit' && activeForm && (
          <Suspense fallback={<WorkspaceViewSkeleton view="edit" />}>
            {renderBuilderWorkspace()}
          </Suspense>
        )}

        {activeMode === 'preview' && activeForm && (
          <Suspense fallback={<WorkspaceViewSkeleton view="preview" />}>
            <FormRenderer
              key={`${activeForm.id}_${activeForm.updatedAt}`}
              schema={activeForm}
              onSubmitRecord={handleRecordSubmission}
            />
          </Suspense>
        )}

        {activeMode === 'submissions' && activeTenant && activeForm && (
          <SubmissionsPanel
            tenant={activeTenant}
            schema={activeForm}
            submissions={scopedSubmissions}
            canClearAll={canManageTenantAdmin}
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
            activeTenantId={activeTenant?.id ?? ''}
            onDeleteSubmission={handleDeleteSubmissionScoped}
          />
        )}

        {activeMode === 'schema' && activeForm && (
          <Suspense fallback={<WorkspaceViewSkeleton view="schema" />}>
            <SchemaIoPanel
              schema={activeForm}
              onImportSchema={handleImportSchema}
            />
          </Suspense>
        )}
      </main>
    </div>

    {/* Modal: Tenant Team Management (Self-Service Tenant Admin) */}
    {showTenantTeamModal && activeTenant && canManageTenantAdmin && (
      <TenantUsersModal
        tenant={activeTenant}
        users={tenantUsers.filter((u) => u.clientId === activeTenant.id)}
        onClose={() => setShowTenantTeamModal(false)}
        onCreateUser={handleCreateTenantUser}
        onUpdateUser={handleUpdateTenantUser}
        onDeleteUser={handleDeleteTenantUser}
        onResetCredentials={handleResetTenantUserCredentials}
      />
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
            {activeTenant && (
              <Badge variant="neutral">{activeTenant.name}</Badge>
            )}
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
