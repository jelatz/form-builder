import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Badge, Button, Input, Label, PageContainer } from '../../shared/ui';

export interface UserGuidePanelProps {
  userRole: 'superadmin' | 'tenant_admin' | 'tenant_member';
  tenantName?: string;
  tenantSlug?: string;
  hasActiveForm: boolean;
  onNavigate: (
    mode:
      | 'dashboard'
      | 'tenants'
      | 'forms'
      | 'submissions_explorer'
      | 'schema',
  ) => void;
  onOpenActiveFormMode?: (
    mode: 'form_detail' | 'edit' | 'preview' | 'submissions' | 'integrations',
  ) => void;
}

type AudienceFilter = 'all' | 'superadmin' | 'clients';

interface GuideSectionMeta {
  id: string;
  number: string;
  title: string;
  shortLabel: string;
  audience: 'all' | 'superadmin' | 'clients';
  audienceLabel: string;
  keywords: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  keywords: string;
}

const GUIDE_SECTIONS: GuideSectionMeta[] = [
  {
    id: 'overview',
    number: '01',
    title: 'Workspace Overview & Roles',
    shortLabel: 'Overview & Roles',
    audience: 'all',
    audienceLabel: 'ALL ROLES',
    keywords:
      'sidebar navigation rail collapse expand theme dark light system permissions rbac roles superadmin tenant admin member',
  },
  {
    id: 'tenants',
    number: '02',
    title: 'Creating & Managing Tenants',
    shortLabel: 'Tenants (Superadmin)',
    audience: 'superadmin',
    audienceLabel: 'SUPERADMIN',
    keywords:
      'tenant client organization slug create new tenant edit suspend reactivate delete onboarding email login portal',
  },
  {
    id: 'team',
    number: '03',
    title: 'Client Team & User Management',
    shortLabel: 'Team & Users',
    audience: 'clients',
    audienceLabel: 'SUPERADMIN & CLIENT ADMIN',
    keywords:
      'users team manage team tenant_admin tenant_member password reset credentials invite onboarding email',
  },
  {
    id: 'forms',
    number: '04',
    title: 'Creating & Managing Forms',
    shortLabel: 'Forms & Sharing',
    audience: 'all',
    audienceLabel: 'ALL ROLES',
    keywords:
      'new form create publish unpublish form overview public link embed share iframe modal script prefill delete',
  },
  {
    id: 'builder',
    number: '05',
    title: 'Using the Edit Builder',
    shortLabel: 'Edit Builder',
    audience: 'all',
    audienceLabel: 'ALL ROLES',
    keywords:
      'edit builder field palette form fields smart fields drag drop grid column section multi-step undo redo publish changes property inspector dock validation',
  },
  {
    id: 'preview',
    number: '06',
    title: 'Live Preview & Public Forms',
    shortLabel: 'Preview & Public URL',
    audience: 'all',
    audienceLabel: 'ALL ROLES',
    keywords:
      'live preview public form /f/ validation wizard section prefill query parameters embed=1 thank you redirect',
  },
  {
    id: 'submissions',
    number: '07',
    title: 'Managing Submissions & Exports',
    shortLabel: 'Submissions & Export',
    audience: 'all',
    audienceLabel: 'ALL ROLES',
    keywords:
      'submissions ledger explorer search filter inspect json export csv export json delete clear all',
  },
  {
    id: 'integrations',
    number: '08',
    title: 'Setting Up Integrations & Webhooks',
    shortLabel: 'Webhooks & Integrations',
    audience: 'all',
    audienceLabel: 'ALL ROLES',
    keywords:
      'integrations webhook destination url hmac sha256 signature secret whsec test event retry delivery log queued running completed failed zapier slack crm',
  },
  {
    id: 'schema',
    number: '09',
    title: 'Schema JSON Import & Export',
    shortLabel: 'Schema JSON',
    audience: 'all',
    audienceLabel: 'ALL ROLES',
    keywords:
      'schema json copy download upload import parseFormSchemaJson portable ast',
  },
  {
    id: 'faq',
    number: '10',
    title: 'Troubleshooting & FAQ',
    shortLabel: 'Troubleshooting & FAQ',
    audience: 'all',
    audienceLabel: 'ALL ROLES',
    keywords:
      'faq help 404 suspended unpublished permissions 403 slack webhook timeout draft published',
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-public-404',
    question:
      'Why does the public form URL (/f/<tenant-slug>/<form-slug>) return 404 or "Form Unavailable"?',
    answer:
      'A public form only loads when two conditions are true: (1) the form itself is marked PUBLISHED (not DRAFT / UNPUBLISHED) in Form Overview or via "Publish Changes" in the Edit Builder, and (2) the parent tenant status is ACTIVE rather than SUSPENDED.',
    keywords: '404 unavailable public form url unpublished draft suspended',
  },
  {
    id: 'faq-client-tenant',
    question: 'Can a client account create a new tenant workspace?',
    answer:
      'No. Tenant creation and the All Tenants directory (/tenants) are restricted to Superadmin accounts. Client accounts (Tenant Admin and Tenant Member) are scoped strictly to their assigned tenant. A Tenant Admin can, however, add and manage team members inside their own workspace using Dashboard -> Manage Team.',
    keywords: 'client create tenant superadmin manage team role permissions',
  },
  {
    id: 'faq-member-403',
    question:
      'Why do Tenant Members see permission errors or missing controls on webhooks and delete actions?',
    answer:
      'Tenant Members can create, edit, and publish forms, view/export submissions, send webhook test events, and retry failed webhook deliveries. Destructive or configuration-level actions—deleting forms, clearing all submissions, managing team users, and creating/editing/deleting webhook endpoints—require Tenant Admin or Superadmin.',
    keywords: '403 permission member admin delete webhook clear submissions',
  },
  {
    id: 'faq-webhook-direction',
    question:
      'Where do I get the Destination URL for a webhook integration, and why does Slack reject raw webhooks?',
    answer:
      'FormBuilder pushes submissions outward via HTTP POST. Your receiving app (Zapier, Make, n8n, Pipedream, or your own API) gives you a webhook URL, and you paste it into FormBuilder’s Destination URL box. All connector presets send FormBuilder’s standard JSON payload. Because Slack incoming webhooks expect a top-level "text" or "blocks" field, route Slack alerts through Zapier, Make, or a tiny formatter endpoint.',
    keywords: 'destination url slack zapier make webhook payload json format',
  },
  {
    id: 'faq-webhook-retry',
    question:
      'What happens if my webhook endpoint is down or takes longer than 5 seconds?',
    answer:
      'Each outbound request has a 5-second timeout. Non-2xx responses or timeouts mark the delivery as "failed" in the Delivery Activity log, while still saving the respondent’s form submission cleanly. There is no automatic background retry loop yet—fix the receiving endpoint and click Retry on the failed delivery row to re-send with the saved payload and current endpoint secret.',
    keywords: 'timeout 5s failed retry delivery log',
  },
  {
    id: 'faq-draft-published',
    question:
      'Do edits in the Edit Builder go live on the public form immediately?',
    answer:
      'Edits save to the form record as you work. When a form is marked as having unpublished changes (DRAFT badge in the top toolbar), click "Publish Changes" in the builder header or toggle Publish on Form Overview to update the live status.',
    keywords: 'draft published publish changes builder save live',
  },
];

const WEBHOOK_PAYLOAD_EXAMPLE = `{
  "id": "whd_01J...",
  "event": "submission.created",
  "createdAt": "2026-11-19T14:00:00.000Z",
  "form": {
    "id": "form_01J...",
    "clientId": "tenant_01J...",
    "slug": "client-intake",
    "title": "Client Intake Form"
  },
  "submission": {
    "id": "sub_01J...",
    "submittedAt": "2026-11-19T14:00:00.000Z",
    "values": {
      "fld_name": { "firstName": "Jane", "lastName": "Doe" },
      "fld_email": "jane@company.com"
    },
    "fields": [
      { "id": "fld_name", "label": "Full Name", "type": "name", "value": { "firstName": "Jane", "lastName": "Doe" } },
      { "id": "fld_email", "label": "Work Email", "type": "email", "value": "jane@company.com" }
    ]
  }
}`;

const VERIFY_HMAC_SNIPPET = `import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyFormBuilderWebhook(rawBody: string, headerSig: string, secret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(headerSig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}`;

function RoleCheck({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
      No
    </span>
  );
}

function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="list-decimal pl-5 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
      {steps.map((step, index) => (
        <li key={index}>{step}</li>
      ))}
    </ol>
  );
}

export function UserGuidePanel({
  userRole,
  tenantName,
  tenantSlug,
  hasActiveForm,
  onNavigate,
  onOpenActiveFormMode,
}: UserGuidePanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tocNavRef = useRef<HTMLElement | null>(null);
  const faqListRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all');
  const [activeSectionId, setActiveSectionId] = useState<string>('overview');
  const [copiedSnippet, setCopiedSnippet] = useState<'payload' | 'hmac' | null>(
    null,
  );
  const [allFaqExpanded, setAllFaqExpanded] = useState(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return GUIDE_SECTIONS.filter((section) => {
      if (audienceFilter === 'superadmin' && section.audience === 'clients') {
        return false;
      }
      if (audienceFilter === 'clients' && section.audience === 'superadmin') {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        section.title.toLowerCase().includes(normalizedQuery) ||
        section.shortLabel.toLowerCase().includes(normalizedQuery) ||
        section.keywords.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [audienceFilter, normalizedQuery]);

  const visibleSectionIds = useMemo(
    () => new Set(visibleSections.map((s) => s.id)),
    [visibleSections],
  );

  const visibleFaqItems = useMemo(() => {
    if (!normalizedQuery) return FAQ_ITEMS;
    const matches = FAQ_ITEMS.filter(
      (item) =>
        item.question.toLowerCase().includes(normalizedQuery) ||
        item.answer.toLowerCase().includes(normalizedQuery) ||
        item.keywords.toLowerCase().includes(normalizedQuery),
    );
    return matches.length > 0 ? matches : FAQ_ITEMS;
  }, [normalizedQuery]);

  const resolvedActiveSectionId = visibleSectionIds.has(activeSectionId)
    ? activeSectionId
    : (visibleSections[0]?.id ?? 'overview');

  // Keep scrollspy aria-current & IntersectionObserver fallback synced with scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    const tocNav = tocNavRef.current;
    if (!container || !tocNav) return;

    const supportsNativeScrollTarget =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('scroll-target-group: auto');

    if (supportsNativeScrollTarget) {
      const syncNativeTarget = () => {
        const currentLink = tocNav.querySelector('a:target-current');
        if (!currentLink) return;
        const href = currentLink.getAttribute('href');
        if (href && href.startsWith('#')) {
          setActiveSectionId(href.slice(1));
        }
      };

      const frameId = window.requestAnimationFrame(syncNativeTarget);
      container.addEventListener('scrollend', syncNativeTarget);
      return () => {
        window.cancelAnimationFrame(frameId);
        container.removeEventListener('scrollend', syncNativeTarget);
      };
    }

    const sections = Array.from(
      container.querySelectorAll<HTMLElement>('section[data-guide-section="true"]'),
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );
        const topMatch = intersecting[0];
        if (topMatch?.target instanceof HTMLElement && topMatch.target.id) {
          setActiveSectionId(topMatch.target.id);
        }
      },
      {
        root: container,
        rootMargin: '-15% 0px -70% 0px',
        threshold: 0,
      },
    );

    for (const sec of sections) {
      observer.observe(sec);
    }

    return () => {
      observer.disconnect();
    };
  }, [visibleSections]);

  const handleTocLinkClick = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) => {
    event.preventDefault();
    setActiveSectionId(sectionId);
    const target = document.getElementById(sectionId);
    if (!target) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    target.focus({ preventScroll: true });
  };

  const handleToggleAllFaq = () => {
    const root = faqListRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLDetailsElement>('details'));
    const nextOpen = !allFaqExpanded;
    for (const item of items) {
      item.open = nextOpen;
    }
    setAllFaqExpanded(nextOpen);
  };

  const syncFaqAllExpandedState = () => {
    const root = faqListRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLDetailsElement>('details'));
    setAllFaqExpanded(items.length > 0 && items.every((el) => el.open));
  };

  const handleCopyCode = (key: 'payload' | 'hmac', content: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(content).then(() => {
      setCopiedSnippet(key);
      window.setTimeout(() => setCopiedSnippet(null), 1600);
    });
  };

  const roleBadgeLabel =
    userRole === 'superadmin'
      ? 'SUPERADMIN'
      : userRole === 'tenant_admin'
        ? 'TENANT ADMIN'
        : 'TENANT MEMBER';

  return (
    <div
      ref={scrollContainerRef}
      role="region"
      aria-label="User Guide content"
      tabIndex={0}
      className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 bg-[#f4f5f7] dark:bg-zinc-950 focus:outline-none"
    >
      <PageContainer className="space-y-5">
        {/* Header Card */}
        <header className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">USER GUIDE</Badge>
                <Badge variant="neutral">{roleBadgeLabel}</Badge>
                {tenantName && (
                  <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    Active Workspace: {tenantName}
                    {tenantSlug ? ` (/t/${tenantSlug}/login)` : ''}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                FormBuilder User Guide
              </h1>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
                Complete operational reference for Superadmins and Client Teams—covering
                tenant provisioning, team access, form creation, the visual Edit
                Builder, submissions, Schema JSON, and signed webhook integrations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onNavigate('dashboard')}
              >
                Go to Dashboard
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onNavigate('forms')}
              >
                {userRole === 'superadmin' ? 'Open All Forms' : 'Open Forms'}
              </Button>
              {userRole === 'superadmin' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onNavigate('tenants')}
                >
                  All Tenants
                </Button>
              )}
            </div>
          </div>

          {/* Search & Audience Filter Toolbar */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="flex-1 min-w-0 max-w-md space-y-1">
              <Label htmlFor="guide-search-input">Search topics or keywords</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="guide-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. webhook, tenant, grid, publish, export CSV..."
                  className="h-9 text-xs"
                />
                {searchQuery && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div
              role="group"
              aria-label="Filter guide by role"
              className="flex flex-wrap items-center gap-1.5"
            >
              {(
                [
                  { id: 'all', label: 'All Topics' },
                  { id: 'superadmin', label: 'Superadmin' },
                  { id: 'clients', label: 'Client Teams' },
                ] as const
              ).map((item) => {
                const isActive = audienceFilter === item.id;
                return (
                  <Button
                    key={item.id}
                    size="sm"
                    variant={isActive ? 'primary' : 'secondary'}
                    aria-pressed={isActive}
                    onClick={() => setAudienceFilter(item.id)}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Two-Column Guide Layout: Sticky Section TOC + Long-Form Documentation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Sticky Table of Contents */}
          <aside className="lg:col-span-3 lg:sticky lg:top-0">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-2xs space-y-2">
              <div className="px-2 py-1 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Contents
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {visibleSections.length}/{GUIDE_SECTIONS.length}
                </span>
              </div>

              <nav
                ref={tocNavRef}
                aria-label="Guide sections"
                className="guide-toc flex flex-col space-y-0.5"
              >
                {visibleSections.map((section) => {
                  const isCurrent = resolvedActiveSectionId === section.id;
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      aria-current={isCurrent ? 'true' : 'false'}
                      onClick={(e) => handleTocLinkClick(e, section.id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-r-md border-l-2 text-xs transition-colors ${
                        isCurrent
                          ? 'target-current border-emerald-500 bg-emerald-50/70 text-emerald-900 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                        {section.number}
                      </span>
                      <span className="truncate">{section.shortLabel}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Guide Sections */}
          <div className="lg:col-span-9 space-y-5 min-w-0">
            {visibleSections.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center space-y-2.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  No guide sections match &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Reset the search box or switch the role filter back to All Topics.
                </p>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setAudienceFilter('all');
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            )}

            {/* 01: Workspace Overview & Roles */}
            {visibleSectionIds.has('overview') && (
              <section
                id="overview"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">01 · OVERVIEW</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Workspace Overview &amp; Roles
                    </h2>
                  </div>
                  <Badge variant="neutral">ALL ROLES</Badge>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  FormBuilder separates every client organization into an isolated
                  tenant workspace. Use the persistent left navigation rail to move
                  between <strong>Dashboard</strong>,{' '}
                  {userRole === 'superadmin' && (
                    <>
                      <strong>All Tenants</strong>,{' '}
                    </>
                  )}
                  <strong>{userRole === 'superadmin' ? 'All Forms' : 'Forms'}</strong>,{' '}
                  <strong>Submissions</strong>, <strong>Schema JSON</strong>, and this{' '}
                  <strong>User Guide</strong>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-3.5 space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Shell Controls &amp; Theme
                    </h3>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <li>
                        Use the top-left collapse button in the header bar to toggle
                        the sidebar between full labels (<code className="font-mono">w-60</code>)
                        and an icon-only rail (<code className="font-mono">w-16</code>).
                      </li>
                      <li>
                        Switch between <strong>Light</strong>, <strong>Dark</strong>,
                        and <strong>System</strong> appearance from the sidebar footer.
                      </li>
                      <li>
                        Client accounts can sign in at the global{' '}
                        <code className="font-mono">/login</code> page or their
                        dedicated portal <code className="font-mono">/t/&lt;tenant-slug&gt;/login</code>.
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-3.5 space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Three Role Levels
                    </h3>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <li>
                        <strong>Superadmin</strong>: Platform owner; manages all
                        tenants, global forms, global submissions, and tenant admins.
                      </li>
                      <li>
                        <strong>Tenant Admin</strong>: Full builder, team, webhook,
                        and destructive management inside their own tenant.
                      </li>
                      <li>
                        <strong>Tenant Member</strong>: Collaborator who builds forms,
                        reviews/exports submissions, and runs webhook tests/retries.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <caption className="sr-only">
                      Role permissions matrix across Superadmin, Tenant Admin, and Tenant Member
                    </caption>
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 font-mono text-[11px] uppercase text-zinc-600 dark:text-zinc-400">
                        <th scope="col" className="py-2 px-3">Capability</th>
                        <th scope="col" className="py-2 px-3">Superadmin</th>
                        <th scope="col" className="py-2 px-3">Tenant Admin</th>
                        <th scope="col" className="py-2 px-3">Tenant Member</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <tr>
                        <td className="py-2 px-3">Create / edit / suspend / delete tenants</td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed={false} /></td>
                        <td className="py-2 px-3"><RoleCheck allowed={false} /></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">Manage tenant team users &amp; reset credentials</td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed={false} /></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">Create, edit, publish &amp; embed forms</td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">Delete forms &amp; clear all form submissions</td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed={false} /></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">View submissions, export CSV/JSON &amp; delete single records</td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">Create, edit, toggle &amp; delete webhooks</td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed={false} /></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">Send webhook test event &amp; retry failed deliveries</td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                        <td className="py-2 px-3"><RoleCheck allowed /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 02: Creating & Managing Tenants */}
            {visibleSectionIds.has('tenants') && (
              <section
                id="tenants"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">02 · TENANTS</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Creating &amp; Managing Tenants
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">SUPERADMIN ONLY</Badge>
                    {userRole === 'superadmin' && (
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => onNavigate('tenants')}
                      >
                        Open All Tenants
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      For Superadmins: Provision a New Client Tenant
                    </h3>
                    <StepList
                      steps={[
                        'Open Dashboard (/dashboard) or All Tenants (/tenants) from the left navigation rail and click "+ New Tenant".',
                        'Enter the Organization / Tenant Name (at least 2 characters). FormBuilder automatically generates a unique URL slug.',
                        'Review or customize the Admin Username (auto-formatted in snake_case) and enter the client admin’s Email address.',
                        'Submit the form. The server creates the active tenant, provisions the initial tenant_admin user with a generated temporary password, and sends onboarding credentials plus the tenant login URL (/t/<tenant-slug>/login).',
                        'In local development without RESEND_API_KEY configured, the welcome credentials and login URL are logged directly to the Fastify API console.',
                      ]}
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Editing, Suspending &amp; For Clients
                    </h3>
                    <ul className="list-disc pl-4 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      <li>
                        <strong>Edit / Suspend Tenant</strong>: On{' '}
                        <strong>All Tenants</strong>, click the edit icon on any row
                        to rename the organization, change its slug, or toggle{' '}
                        <code className="font-mono">ACTIVE</code> /{' '}
                        <code className="font-mono">SUSPENDED</code>.
                      </li>
                      <li>
                        <strong>Immediate Session Revocation</strong>: Suspending a
                        tenant immediately revokes active user sessions for that tenant
                        and blocks its public forms until reactivated.
                      </li>
                      <li>
                        <strong>For Clients</strong>: Client users cannot create new
                        tenants themselves. Ask your platform Superadmin to provision
                        a new tenant workspace, then sign in via{' '}
                        <code className="font-mono">/t/&lt;tenant-slug&gt;/login</code>.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* 03: Client Team & User Management */}
            {visibleSectionIds.has('team') && (
              <section
                id="team"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">03 · TEAM</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Client Team &amp; User Management
                    </h2>
                  </div>
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => onNavigate('dashboard')}
                  >
                    Open Dashboard
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      How Client Admins Manage Their Own Team
                    </h3>
                    <StepList
                      steps={[
                        'Sign in as a Tenant Admin and open Dashboard (/dashboard).',
                        'Click "Manage Team" in the top-right action bar to open the team modal for your workspace.',
                        'Add one or more users (up to 10 in a batch) by choosing a Username, Display Name, Password, and Role (Tenant Admin or Tenant Member).',
                        'Edit existing teammates to change their role, deactivate/reactivate access, reset their password, or send updated login credentials by email.',
                      ]}
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      How Superadmins Manage Tenant Users
                    </h3>
                    <StepList
                      steps={[
                        'Open All Tenants (/tenants) from the left navigation rail.',
                        'Click the Users count or the "Manage team" icon button on any tenant row.',
                        'Create new tenant_admin or tenant_member accounts, toggle active status, delete users, or trigger Reset Credentials to generate and email fresh login details.',
                      ]}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* 04: Creating & Managing Forms */}
            {visibleSectionIds.has('forms') && (
              <section
                id="forms"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">04 · FORMS</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Creating &amp; Managing Forms
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => onNavigate('forms')}
                    >
                      Open {userRole === 'superadmin' ? 'All Forms' : 'Forms'}
                    </Button>
                    {hasActiveForm && onOpenActiveFormMode && (
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => onOpenActiveFormMode('form_detail')}
                      >
                        Form Overview
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Creating a New Form
                    </h3>
                    <StepList
                      steps={[
                        'Click "+ New Form" on Dashboard or All Forms (or "+ Form" in the top bar when inside a form workspace).',
                        'If you are a Superadmin, choose the target Client Tenant first. Client users automatically scope the form to their own tenant.',
                        'Enter a Form Title (and optional description). FormBuilder generates a unique URL slug within that tenant.',
                        'Once created, the form opens directly or can be selected from All Forms to enter Form Overview (/forms/:formId).',
                      ]}
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Form Overview, Publishing &amp; Embedding
                    </h3>
                    <ul className="list-disc pl-4 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      <li>
                        <strong>Publish / Unpublish</strong>: Toggle live public
                        availability from the status button on{' '}
                        <strong>Form Overview</strong>. Unpublished forms return a
                        safe unavailable state at the public URL.
                      </li>
                      <li>
                        <strong>Public URL</strong>: Every published form is served at{' '}
                        <code className="font-mono">/f/&lt;tenant-slug&gt;/&lt;form-slug&gt;</code>.
                      </li>
                      <li>
                        <strong>Embed &amp; Share Modal</strong>: Click{' '}
                        <strong>Embed &amp; Share</strong> on Form Overview for three
                        ready-to-copy options: <strong>Direct Link</strong> (plus sample
                        query-parameter prefill URL), <strong>Iframe</strong> embed
                        (<code className="font-mono">?embed=1</code>), and{' '}
                        <strong>Modal Script</strong> (listens for{' '}
                        <code className="font-mono">formbuilder:submitted</code> via{' '}
                        <code className="font-mono">postMessage</code>).
                      </li>
                      <li>
                        <strong>Delete Form</strong>: Tenant Admins and Superadmins
                        can permanently remove a form and its associated submissions
                        and webhooks from Form Overview.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* 05: Using the Edit Builder */}
            {visibleSectionIds.has('builder') && (
              <section
                id="builder"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">05 · BUILDER</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Using the Edit Builder
                    </h2>
                  </div>
                  {hasActiveForm && onOpenActiveFormMode && (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => onOpenActiveFormMode('edit')}
                    >
                      Open Edit Builder
                    </Button>
                  )}
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Open any form&rsquo;s <strong>Form Overview</strong> and click{' '}
                  <strong>Edit Builder</strong> (<code className="font-mono">/forms/:formId/edit</code>)
                  to launch the three-pane workspace: <strong>Field Palette</strong>,{' '}
                  <strong>Builder Canvas</strong>, and{' '}
                  <strong>Property Inspector</strong>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-3.5 space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      1. Field Palette (15 Types)
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Switch between <strong>Form Fields</strong> and{' '}
                      <strong>Smart Fields</strong> tabs, then click or drag any tile
                      onto the canvas or into a grid column:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                      <li>
                        <strong>Standard</strong>: Text, Email, Number, Select
                        Dropdown, Radio, Checkbox, Date.
                      </li>
                      <li>
                        <strong>Extended</strong>: Full Name, Phone, Address, Textarea,
                        Website URL, Currency.
                      </li>
                      <li>
                        <strong>Layout</strong>: Multi-step <strong>Section</strong>{' '}
                        page breaks and 1/2/3-column <strong>Grid</strong> containers.
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-3.5 space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      2. Canvas, Grids &amp; Sections
                    </h3>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <li>
                        Drag field cards up/down or into 1-, 2-, or 3-column Grid
                        dropzones.
                      </li>
                      <li>
                        Add extra <strong>Sections</strong> to split long forms into a
                        validated multi-step wizard.
                      </li>
                      <li>
                        Duplicate or delete individual fields directly on each card.
                      </li>
                      <li>
                        Use <strong>Undo</strong> (<code className="font-mono">Ctrl+Z</code>)
                        and <strong>Redo</strong> (<code className="font-mono">Ctrl+Y</code>)
                        in the top bar, then click <strong>Publish Changes</strong> when
                        ready to go live.
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-3.5 space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      3. Property Inspector
                    </h3>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <li>
                        <strong>Field Settings</strong>: Edit label, placeholder,
                        helper text, required toggle, text min/max length, numeric
                        bounds, email <code className="font-mono">allowedDomains</code>{' '}
                        or <code className="font-mono">confirmEmail</code>, date limits,
                        and dropdown/radio options.
                      </li>
                      <li>
                        <strong>Form Settings Tab</strong>: Configure form Title,
                        Slug, Submit Button Text, Thank You Title &amp; Message, and
                        post-submit Redirect URL.
                      </li>
                      <li>
                        Dock the inspector on the left or right side of the canvas using
                        its header toggle.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* 06: Live Preview & Public Forms */}
            {visibleSectionIds.has('preview') && (
              <section
                id="preview"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3.5 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">06 · RUNTIME</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Live Preview &amp; Public Forms
                    </h2>
                  </div>
                  {hasActiveForm && onOpenActiveFormMode && (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => onOpenActiveFormMode('preview')}
                    >
                      Open Live Preview
                    </Button>
                  )}
                </div>

                <ul className="list-disc pl-4 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  <li>
                    <strong>Live Preview</strong> (<code className="font-mono">/forms/:formId/preview</code>):
                    Test multi-section Next/Back validation, field error states, and
                    real submission persistence without leaving the workspace.
                  </li>
                  <li>
                    <strong>Public Runner</strong> (<code className="font-mono">/f/&lt;tenant-slug&gt;/&lt;form-slug&gt;</code>):
                    Share with external respondents once the form is{' '}
                    <code className="font-mono">PUBLISHED</code> and the tenant is{' '}
                    <code className="font-mono">ACTIVE</code>.
                  </li>
                  <li>
                    <strong>Query Prefill &amp; Embed Mode</strong>: Pass field query
                    keys in the URL to prefill inputs (generated automatically in the
                    Embed &amp; Share modal), or append{' '}
                    <code className="font-mono">?embed=1</code> for clean iframe
                    framing and <code className="font-mono">formbuilder:submitted</code>{' '}
                    parent window notifications.
                  </li>
                </ul>
              </section>
            )}

            {/* 07: Managing Submissions & Exports */}
            {visibleSectionIds.has('submissions') && (
              <section
                id="submissions"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">07 · SUBMISSIONS</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Managing Submissions &amp; Exports
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => onNavigate('submissions_explorer')}
                    >
                      Submissions Explorer
                    </Button>
                    {hasActiveForm && onOpenActiveFormMode && (
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => onOpenActiveFormMode('submissions')}
                      >
                        Form Submissions
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Two Views for Submissions
                    </h3>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      <li>
                        <strong>Per-Form Submissions</strong> (via{' '}
                        <strong>Form Overview → Submissions</strong> at{' '}
                        <code className="font-mono">/forms/:formId/submissions</code>):
                        Displays columns mapped to your form&rsquo;s fields, a row
                        inspector showing formatted answers + raw JSON, and{' '}
                        <strong>Export CSV</strong> / <strong>Export JSON</strong>.
                      </li>
                      <li>
                        <strong>Global Submissions Explorer</strong> (via sidebar{' '}
                        <strong>Submissions</strong> at{' '}
                        <code className="font-mono">/submissions</code>): Search and
                        filter responses across all forms in your tenant (or across
                        all tenants as Superadmin) and export CSV.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Cleanup &amp; Deletion Rules
                    </h3>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      <li>
                        <strong>Delete Individual Row</strong>: Available to all
                        workspace roles with confirmation inside the table or detail
                        panel.
                      </li>
                      <li>
                        <strong>Clear All Submissions</strong>: Permanently wipes all
                        records for a single form. Restricted to{' '}
                        <strong>Tenant Admin</strong> and <strong>Superadmin</strong>.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* 08: Setting Up Integrations & Webhooks */}
            {visibleSectionIds.has('integrations') && (
              <section
                id="integrations"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">08 · INTEGRATIONS</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Setting Up Integrations &amp; Webhooks
                    </h2>
                  </div>
                  {hasActiveForm && onOpenActiveFormMode && (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => onOpenActiveFormMode('integrations')}
                    >
                      Open Integrations
                    </Button>
                  )}
                </div>

                <div className="rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 space-y-1">
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    How the Destination URL works (Push Model)
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200/90 leading-relaxed">
                    FormBuilder does not expose a URL for other apps to poll. Instead,
                    your receiving service (Zapier, Make, n8n, CRM, or your own backend
                    API) gives you an HTTPS endpoint URL—you paste that URL into{' '}
                    <strong>Destination URL</strong> here, and FormBuilder signs and{' '}
                    <code className="font-mono">POST</code>s every new submission to it.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Configure &amp; Test a Webhook
                    </h3>
                    <StepList
                      steps={[
                        'Open Form Overview for the form and click "Integrations" (/forms/:formId/integrations).',
                        'Click "+ Add Webhook" or pick a Quick Connector Template (Custom Webhook, Zapier / Make, Slack Webhook, or HubSpot / CRM). Note: all templates send FormBuilder’s standard JSON payload—native Slack webhooks need an automation or middleware step to reformat JSON into Slack text.',
                        'Enter an Integration Name (2–80 characters), paste the receiving service’s http:// or https:// Destination URL, and optionally enter a custom Signing Secret (at least 8 characters; leave blank to auto-generate whsec_...).',
                        'Save the endpoint (requires Tenant Admin or Superadmin). Copy or reveal the signing secret so your receiving server can verify signatures.',
                        'Click "Send Test Event" to immediately send a webhook.test payload with sample values for your form’s fields and inspect the Delivery Activity row.',
                      ]}
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Delivery Lifecycle &amp; Retries
                    </h3>
                    <ul className="list-disc pl-4 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      <li>
                        <strong>Automatic Trigger</strong>: Active webhooks subscribed
                        to <code className="font-mono">submission.created</code> fire
                        on every valid authenticated or public submission.
                      </li>
                      <li>
                        <strong>5-Second Timeout</strong>: Outbound{' '}
                        <code className="font-mono">POST</code> requests time out after
                        5,000 ms and capture up to 1,000 characters of the response body.
                      </li>
                      <li>
                        <strong>Status Lifecycle</strong>: Deliveries transition through{' '}
                        <code className="font-mono">queued</code> →{' '}
                        <code className="font-mono">running</code> →{' '}
                        <code className="font-mono">completed</code> (HTTP 2xx) or{' '}
                        <code className="font-mono">failed</code>. Failed webhooks never
                        block saving the respondent&rsquo;s submission.
                      </li>
                      <li>
                        <strong>Manual Retry</strong>: Click <strong>Retry</strong> on
                        any failed entry in Delivery Activity to re-send the saved
                        payload using the endpoint&rsquo;s current URL and secret.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Webhook Headers Table */}
                <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <caption className="sr-only">
                      HTTP headers sent on every FormBuilder outbound webhook request
                    </caption>
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 font-mono text-[11px] uppercase text-zinc-600 dark:text-zinc-400">
                        <th scope="col" className="py-2 px-3">Header</th>
                        <th scope="col" className="py-2 px-3">Example / Format</th>
                        <th scope="col" className="py-2 px-3">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <tr>
                        <td className="py-2 px-3 font-mono">X-FormBuilder-Event</td>
                        <td className="py-2 px-3 font-mono">submission.created | webhook.test</td>
                        <td className="py-2 px-3">Identifies live submissions vs test pings</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono">X-FormBuilder-Delivery-Id</td>
                        <td className="py-2 px-3 font-mono">whd_...</td>
                        <td className="py-2 px-3">Unique delivery ID for idempotency / deduplication</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-mono">X-FormBuilder-Signature</td>
                        <td className="py-2 px-3 font-mono">sha256=&lt;hex&gt;</td>
                        <td className="py-2 px-3">HMAC-SHA256 digest of the raw JSON request body</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Copyable Code Snippets */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase text-zinc-600 dark:text-zinc-400">
                        Sample JSON Payload
                      </span>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          handleCopyCode('payload', WEBHOOK_PAYLOAD_EXAMPLE)
                        }
                      >
                        {copiedSnippet === 'payload' ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="p-3 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50/40 dark:bg-zinc-950/80 overflow-x-auto leading-relaxed">
                      <code>{WEBHOOK_PAYLOAD_EXAMPLE}</code>
                    </pre>
                  </div>

                  <div className="rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase text-zinc-600 dark:text-zinc-400">
                        Verify Signature (Node.js)
                      </span>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          handleCopyCode('hmac', VERIFY_HMAC_SNIPPET)
                        }
                      >
                        {copiedSnippet === 'hmac' ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="p-3 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50/40 dark:bg-zinc-950/80 overflow-x-auto leading-relaxed">
                      <code>{VERIFY_HMAC_SNIPPET}</code>
                    </pre>
                  </div>
                </div>
              </section>
            )}

            {/* 09: Schema JSON Import & Export */}
            {visibleSectionIds.has('schema') && (
              <section
                id="schema"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3.5 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">09 · PORTABILITY</Badge>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Schema JSON Import &amp; Export
                    </h2>
                  </div>
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => onNavigate('schema')}
                  >
                    Open Schema JSON
                  </Button>
                </div>

                <StepList
                  steps={[
                    'Open Schema JSON from the left navigation rail (/schema or /forms/:formId/schema) to inspect the active form’s portable JSON AST.',
                    'Use "Copy JSON" or "Download .json" to back up the form or transfer its structure to another form or tenant.',
                    'To import, paste raw FormSchema JSON or upload a .json file. FormBuilder structurally validates every field type and configuration before allowing confirmation.',
                  ]}
                />
              </section>
            )}

            {/* 10: Troubleshooting & FAQ */}
            {visibleSectionIds.has('faq') && (
              <section
                id="faq"
                data-guide-section="true"
                tabIndex={-1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4 scroll-mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">10 · FAQ</Badge>
                    <h2 id="faq-heading" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Troubleshooting &amp; FAQ
                    </h2>
                  </div>
                  <Button
                    size="xs"
                    variant="secondary"
                    aria-expanded={allFaqExpanded}
                    onClick={handleToggleAllFaq}
                  >
                    {allFaqExpanded ? 'Collapse all' : 'Expand all'}
                  </Button>
                </div>

                <div
                  ref={faqListRef}
                  aria-labelledby="faq-heading"
                  className="guide-faq divide-y divide-zinc-200 dark:divide-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                >
                  {visibleFaqItems.map((item) => (
                    <details
                      key={item.id}
                      onToggle={syncFaqAllExpandedState}
                      className="group bg-white dark:bg-zinc-900"
                    >
                      <summary className="flex items-center gap-2.5 px-4 py-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40">
                        <svg
                          className="guide-chevron w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        <span>{item.question}</span>
                      </summary>
                      <div className="px-4 pb-3.5 pt-1 pl-10 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {item.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
