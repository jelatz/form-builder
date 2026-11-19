import { useEffect, useState } from 'react';
import type {
  ClientTenant,
  FormSchema,
  FormWebhook,
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../../domain/form-schema';
import {
  Badge,
  Button,
  Input,
  Label,
  PageContainer,
  Skeleton,
  Switch,
} from '../../shared/ui';
import {
  apiCreateFormWebhook,
  apiDeleteFormWebhook,
  apiFetchFormWebhooks,
  apiRetryWebhookDelivery,
  apiTestFormWebhook,
  apiUpdateFormWebhook,
} from './storage';
import { formatIsoTimestamp } from './tenant-utils';

interface ConnectorPreset {
  id: string;
  label: string;
  defaultName: string;
  placeholderUrl: string;
  description: string;
}

const CONNECTOR_PRESETS: ConnectorPreset[] = [
  {
    id: 'custom',
    label: 'Custom Webhook',
    defaultName: 'Custom API Webhook',
    placeholderUrl: 'https://api.client-app.com/webhooks/forms',
    description: 'Signed JSON POST with HMAC-SHA256 verification header.',
  },
  {
    id: 'zapier',
    label: 'Zapier / Make',
    defaultName: 'Zapier Automation Hook',
    placeholderUrl: 'https://hooks.zapier.com/hooks/catch/...',
    description: 'Trigger 5,000+ apps (Sheets, Notion, Airtable, Email).',
  },
  {
    id: 'slack',
    label: 'Slack Webhook',
    defaultName: 'Slack Lead Alerts',
    placeholderUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
    description: 'Forward form submission events into team channels.',
  },
  {
    id: 'crm',
    label: 'HubSpot / CRM',
    defaultName: 'CRM Lead Sync',
    placeholderUrl: 'https://hooks.client-crm.com/v1/leads/ingest',
    description: 'Sync lead capture records directly to client CRM workflows.',
  },
];

function getDeliveryBadgeVariant(
  status: WebhookDeliveryStatus,
): 'success' | 'danger' | 'warning' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'running':
      return 'warning';
    case 'queued':
      return 'neutral';
  }
}

export interface FormIntegrationsPanelProps {
  tenant: ClientTenant;
  form: FormSchema;
  onBackToOverview: () => void;
}

export function FormIntegrationsPanel({
  tenant,
  form,
  onBackToOverview,
}: FormIntegrationsPanelProps) {
  const [webhooks, setWebhooks] = useState<FormWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [draftName, setDraftName] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftSecret, setDraftSecret] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(
    new Set(),
  );
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(
    null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(
    null,
  );

  const handleRefresh = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiFetchFormWebhooks(tenant.id, form.id);
      setWebhooks(data.webhooks);
      setDeliveries(data.deliveries);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to load webhooks and deliveries.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiFetchFormWebhooks(tenant.id, form.id)
      .then((data) => {
        if (cancelled) return;
        setWebhooks(data.webhooks);
        setDeliveries(data.deliveries);
        setErrorMsg(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Failed to load webhooks and deliveries.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenant.id, form.id]);

  const activePreset =
    CONNECTOR_PRESETS.find((p) => p.id === selectedPresetId) ??
    CONNECTOR_PRESETS[0]!;

  const handleOpenPreset = (preset: ConnectorPreset) => {
    setSelectedPresetId(preset.id);
    setDraftName(preset.defaultName);
    setDraftUrl('');
    setDraftSecret('');
    setFormError(null);
    setShowCreatePanel(true);
  };

  const handleCreateWebhook = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNoticeMsg(null);

    const trimmedName = draftName.trim();
    const trimmedUrl = draftUrl.trim();
    if (trimmedName.length < 2) {
      setFormError('Endpoint name must be at least 2 characters.');
      return;
    }
    if (!trimmedUrl) {
      setFormError('Destination URL is required.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await apiCreateFormWebhook(tenant.id, form.id, {
        name: trimmedName,
        url: trimmedUrl,
        ...(draftSecret.trim() ? { secret: draftSecret.trim() } : {}),
        events: ['submission.created'],
        isActive: true,
      });
      setWebhooks((prev) => [created, ...prev]);
      setShowCreatePanel(false);
      setDraftName('');
      setDraftUrl('');
      setDraftSecret('');
      setNoticeMsg(`Webhook "${created.name}" created with signing secret.`);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create webhook.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWebhookActive = async (webhook: FormWebhook) => {
    setErrorMsg(null);
    const nextActive = !webhook.isActive;
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === webhook.id ? { ...w, isActive: nextActive } : w,
      ),
    );
    try {
      const updated = await apiUpdateFormWebhook(
        tenant.id,
        form.id,
        webhook.id,
        { isActive: nextActive },
      );
      setWebhooks((prev) =>
        prev.map((w) => (w.id === updated.id ? updated : w)),
      );
    } catch (err) {
      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhook.id ? webhook : w)),
      );
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to update webhook state.',
      );
    }
  };

  const handleSaveEdit = async (webhookId: string) => {
    setErrorMsg(null);
    try {
      const updated = await apiUpdateFormWebhook(
        tenant.id,
        form.id,
        webhookId,
        {
          name: editName.trim(),
          url: editUrl.trim(),
        },
      );
      setWebhooks((prev) =>
        prev.map((w) => (w.id === updated.id ? updated : w)),
      );
      setEditingWebhookId(null);
      setNoticeMsg(`Updated webhook "${updated.name}".`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to update webhook.',
      );
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    setErrorMsg(null);
    try {
      await apiDeleteFormWebhook(tenant.id, form.id, webhookId);
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
      setDeliveries((prev) => prev.filter((d) => d.webhookId !== webhookId));
      setConfirmDeleteId(null);
      setNoticeMsg('Webhook endpoint removed.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to delete webhook.',
      );
    }
  };

  const handleSendTest = async (webhook: FormWebhook) => {
    setErrorMsg(null);
    setNoticeMsg(null);
    setTestingWebhookId(webhook.id);
    try {
      const delivery = await apiTestFormWebhook(tenant.id, form.id, webhook.id);
      setDeliveries((prev) => [delivery, ...prev]);
      setExpandedDeliveryId(delivery.id);
      setNoticeMsg(
        delivery.status === 'completed'
          ? `Test event delivered to "${webhook.name}" (HTTP ${delivery.responseStatus ?? 200}).`
          : `Test delivery to "${webhook.name}" failed (${delivery.errorMessage ?? 'error'}).`,
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to dispatch test event.',
      );
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleRetryDelivery = async (delivery: WebhookDelivery) => {
    setErrorMsg(null);
    setNoticeMsg(null);
    setRetryingDeliveryId(delivery.id);
    try {
      const updated = await apiRetryWebhookDelivery(tenant.id, delivery.id);
      setDeliveries((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d)),
      );
      setNoticeMsg(
        updated.status === 'completed'
          ? `Retry #${updated.attemptCount} succeeded (HTTP ${updated.responseStatus ?? 200}).`
          : `Retry #${updated.attemptCount} failed (${updated.errorMessage ?? 'error'}).`,
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to retry delivery.',
      );
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  const handleCopySecret = (webhook: FormWebhook) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(webhook.secret).then(() => {
      setCopiedSecretId(webhook.id);
      window.setTimeout(() => setCopiedSecretId(null), 1600);
    });
  };

  const toggleSecretVisibility = (webhookId: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(webhookId)) {
        next.delete(webhookId);
      } else {
        next.add(webhookId);
      }
      return next;
    });
  };

  const activeCount = webhooks.filter((w) => w.isActive).length;
  const completedCount = deliveries.filter(
    (d) => d.status === 'completed',
  ).length;
  const failedCount = deliveries.filter((d) => d.status === 'failed').length;
  const webhookNameById = new Map(webhooks.map((w) => [w.id, w.name]));

  return (
    <section
      aria-label={`Integrations: ${form.title}`}
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7] dark:bg-zinc-950"
    >
      <PageContainer className="space-y-5">
        {/* Header Card */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={onBackToOverview}
                aria-label="Back to Form Overview"
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
                <span>Form Overview</span>
              </Button>
              <Badge variant="neutral">INTEGRATIONS &amp; WEBHOOKS</Badge>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{tenant.name}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleRefresh()}
                disabled={isLoading}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setDraftName(activePreset.defaultName);
                  setDraftUrl('');
                  setDraftSecret('');
                  setFormError(null);
                  setShowCreatePanel(true);
                }}
              >
                + Add Webhook
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {form.title} — Integrations
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
                Stream validated submissions to 3rd-party apps, automation tools
                (Zapier, Make, n8n), Slack channels, or client backend APIs via
                HMAC-SHA256 signed JSON webhooks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs">
                <span className="text-zinc-500">ACTIVE HOOKS </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeCount}/{webhooks.length}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs">
                <span className="text-zinc-500">DELIVERED </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {completedCount}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs">
                <span className="text-zinc-500">FAILED </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {failedCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2"
          >
            <span>{errorMsg}</span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setErrorMsg(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {noticeMsg && (
          <div
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2"
          >
            <span>{noticeMsg}</span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setNoticeMsg(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Quick Connector Presets */}
        <section aria-label="Connector Presets" className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500 font-semibold block">
            Quick Connector Templates
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CONNECTOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleOpenPreset(preset)}
                className="text-left rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {preset.label}
                  </span>
                  <Badge variant="neutral">POST JSON</Badge>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Create Webhook Form Card */}
        {showCreatePanel && (
          <form
            onSubmit={(e) => void handleCreateWebhook(e)}
            className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="success">NEW ENDPOINT</Badge>
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {activePreset.label}
                </span>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setShowCreatePanel(false)}
              >
                Cancel
              </Button>
            </div>

            {formError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-md px-3 py-2">
                {formError}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="webhook_name" requiredIndicator>
                  Integration Name
                </Label>
                <Input
                  id="webhook_name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. HubSpot Lead Sync"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="webhook_secret">
                  Signing Secret (optional)
                </Label>
                <Input
                  id="webhook_secret"
                  value={draftSecret}
                  onChange={(e) => setDraftSecret(e.target.value)}
                  placeholder="Auto-generated whsec_... if left blank"
                  className="font-mono text-xs"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="webhook_url" requiredIndicator>
                  Destination URL
                </Label>
                <Input
                  id="webhook_url"
                  type="url"
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  placeholder={activePreset.placeholderUrl}
                  className="font-mono text-xs"
                  required
                />
                <p className="text-[11px] text-zinc-500">
                  Receives a POST request on{' '}
                  <code className="font-mono">submission.created</code> signed
                  with <code className="font-mono">X-FormBuilder-Signature</code>
                  .
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowCreatePanel(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Create Webhook'}
              </Button>
            </div>
          </form>
        )}

        {/* Configured Webhooks List */}
        <section
          aria-label="Configured Webhooks"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-semibold">
              Configured Endpoints ({webhooks.length})
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              Event: submission.created
            </span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="p-10 text-center space-y-2.5">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                No webhooks configured for {form.title}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Add a webhook endpoint or pick a connector template above to
                automatically forward new form submissions to external services.
              </p>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleOpenPreset(CONNECTOR_PRESETS[0]!)}
                >
                  + Add First Webhook
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {webhooks.map((webhook) => {
                const isEditing = editingWebhookId === webhook.id;
                const isRevealed = revealedSecrets.has(webhook.id);
                const isConfirmingDelete = confirmDeleteId === webhook.id;
                const isTesting = testingWebhookId === webhook.id;

                return (
                  <div key={webhook.id} className="p-4 space-y-3">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor={`edit_wh_name_${webhook.id}`}>
                              Endpoint Name
                            </Label>
                            <Input
                              id={`edit_wh_name_${webhook.id}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`edit_wh_url_${webhook.id}`}>
                              Destination URL
                            </Label>
                            <Input
                              id={`edit_wh_url_${webhook.id}`}
                              value={editUrl}
                              onChange={(e) => setEditUrl(e.target.value)}
                              className="font-mono text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setEditingWebhookId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => void handleSaveEdit(webhook.id)}
                          >
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {webhook.name}
                              </span>
                              <Badge
                                size="sm"
                                variant={
                                  webhook.isActive ? 'success' : 'warning'
                                }
                              >
                                {webhook.isActive ? 'ACTIVE' : 'PAUSED'}
                              </Badge>
                              {webhook.events.map((ev) => (
                                <Badge key={ev} size="sm" variant="neutral">
                                  {ev}
                                </Badge>
                              ))}
                            </div>
                            <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400 break-all">
                              {webhook.url}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <Switch
                              id={`wh_active_${webhook.id}`}
                              checked={webhook.isActive}
                              onChange={() =>
                                void handleToggleWebhookActive(webhook)
                              }
                              label={webhook.isActive ? 'Enabled' : 'Paused'}
                            />
                            <Button
                              size="xs"
                              variant="secondary"
                              disabled={isTesting}
                              onClick={() => void handleSendTest(webhook)}
                            >
                              {isTesting ? 'Sending...' : 'Send Test Event'}
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setEditingWebhookId(webhook.id);
                                setEditName(webhook.name);
                                setEditUrl(webhook.url);
                              }}
                            >
                              Edit
                            </Button>
                            {isConfirmingDelete ? (
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="xs"
                                  variant="danger"
                                  onClick={() =>
                                    void handleDeleteWebhook(webhook.id)
                                  }
                                >
                                  Confirm
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="xs"
                                variant="danger"
                                onClick={() => setConfirmDeleteId(webhook.id)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] uppercase text-zinc-500 shrink-0">
                              Signing Secret:
                            </span>
                            <code className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 truncate">
                              {isRevealed
                                ? webhook.secret
                                : `${webhook.secret.slice(0, 10)}••••••••••••`}
                            </code>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => toggleSecretVisibility(webhook.id)}
                            >
                              {isRevealed ? 'Hide' : 'Reveal'}
                            </Button>
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => handleCopySecret(webhook)}
                            >
                              {copiedSecretId === webhook.id
                                ? 'Copied'
                                : 'Copy Secret'}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Webhook Delivery Activity Log */}
        <section
          aria-label="Webhook Delivery Log"
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-semibold">
              Delivery Activity Log ({deliveries.length})
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              X-FormBuilder-Signature: sha256=&lt;hmac&gt;
            </span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2.5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center space-y-1.5">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                No webhook deliveries recorded yet
              </p>
              <p className="text-[11px] text-zinc-500">
                Click &ldquo;Send Test Event&rdquo; on any endpoint or submit
                the form to inspect live HTTP delivery telemetry.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {deliveries.map((delivery) => {
                const isExpanded = expandedDeliveryId === delivery.id;
                const isRetrying = retryingDeliveryId === delivery.id;
                const hookName =
                  webhookNameById.get(delivery.webhookId) ?? delivery.webhookId;

                return (
                  <div key={delivery.id} className="p-3.5 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge size="sm" variant={getDeliveryBadgeVariant(delivery.status)}>
                          {delivery.status.toUpperCase()}
                        </Badge>
                        {delivery.responseStatus !== null && (
                          <Badge
                            size="sm"
                            variant={
                              delivery.responseStatus >= 200 &&
                              delivery.responseStatus < 300
                                ? 'success'
                                : 'danger'
                            }
                          >
                            HTTP {delivery.responseStatus}
                          </Badge>
                        )}
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {hookName}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {delivery.eventType}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400">
                          Attempt #{delivery.attemptCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-zinc-500">
                          {formatIsoTimestamp(delivery.createdAt)}
                        </span>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            setExpandedDeliveryId(
                              isExpanded ? null : delivery.id,
                            )
                          }
                        >
                          {isExpanded ? 'Hide Payload' : 'Inspect Payload'}
                        </Button>
                        <Button
                          size="xs"
                          variant="secondary"
                          disabled={isRetrying}
                          onClick={() => void handleRetryDelivery(delivery)}
                        >
                          {isRetrying ? 'Retrying...' : 'Retry'}
                        </Button>
                      </div>
                    </div>

                    {delivery.errorMessage && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                        Error: {delivery.errorMessage}
                      </p>
                    )}

                    {isExpanded && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 space-y-1">
                          <span className="font-mono text-[10px] uppercase text-zinc-500 font-semibold block">
                            Request JSON Payload
                          </span>
                          <pre className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 overflow-x-auto max-h-56">
                            {JSON.stringify(delivery.requestPayload, null, 2)}
                          </pre>
                        </div>
                        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 space-y-1">
                          <span className="font-mono text-[10px] uppercase text-zinc-500 font-semibold block">
                            Response Body
                          </span>
                          <pre className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 overflow-x-auto max-h-56 whitespace-pre-wrap break-all">
                            {delivery.responseBody || '— (empty response body)'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </PageContainer>
    </section>
  );
}
