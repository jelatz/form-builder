import { useEffect, useState } from 'react';
import {
  toFieldQueryKey,
  type ClientTenant,
  type FormSchema,
} from '../../domain/form-schema';
import { Badge, Button, Input, Label } from '../../shared/ui';

type EmbedTab = 'direct' | 'iframe' | 'script';

export interface EmbedFormModalProps {
  open: boolean;
  tenant: ClientTenant;
  form: FormSchema;
  onClose: () => void;
}

export function EmbedFormModal({
  open,
  tenant,
  form,
  onClose,
}: EmbedFormModalProps) {
  const [activeTab, setActiveTab] = useState<EmbedTab>('direct');
  const [iframeHeight, setIframeHeight] = useState('640');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.example.com';
  const publicPath = `/f/${tenant.slug}/${form.slug}`;
  const publicUrl = `${origin}${publicPath}`;

  const dataFields = form.fields.filter(
    (f) => f.type !== 'section' && f.type !== 'grid',
  );
  const sampleParams = dataFields
    .slice(0, 2)
    .map((f) => {
      const key = toFieldQueryKey(f.label, f.id);
      const sampleVal =
        f.type === 'email'
          ? 'client@company.com'
          : f.type === 'checkbox'
            ? 'true'
            : f.type === 'number' || f.type === 'currency'
              ? '100'
              : 'Sample';
      return `${encodeURIComponent(key)}=${encodeURIComponent(sampleVal)}`;
    })
    .join('&');
  const prefillUrl = sampleParams ? `${publicUrl}?${sampleParams}` : publicUrl;

  const safeTitle = form.title.replace(/"/g, '&quot;');
  const sanitizedHeight =
    Number.isFinite(Number(iframeHeight)) && Number(iframeHeight) >= 240
      ? String(Math.round(Number(iframeHeight)))
      : '640';

  const iframeSnippet = `<iframe
  src="${publicUrl}?embed=1"
  title="${safeTitle}"
  width="100%"
  height="${sanitizedHeight}"
  style="border: 1px solid #e4e4e7; border-radius: 8px; background: #ffffff;"
  loading="lazy"
></iframe>`;

  const scriptSnippet = `<div id="formbuilder-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;align-items:center;justify-content:center;padding:16px;">
  <div style="width:100%;max-width:680px;background:#fff;border-radius:8px;overflow:hidden;position:relative;">
    <button type="button" onclick="document.getElementById('formbuilder-modal').style.display='none'" style="position:absolute;top:10px;right:12px;border:none;background:#f4f4f5;border-radius:4px;padding:4px 8px;cursor:pointer;">Close</button>
    <iframe src="${publicUrl}?embed=1" title="${safeTitle}" width="100%" height="${sanitizedHeight}" style="border:0;" loading="lazy"></iframe>
  </div>
</div>
<button type="button" onclick="document.getElementById('formbuilder-modal').style.display='flex'">
  Open ${safeTitle}
</button>
<script>
  window.addEventListener('message', function (event) {
    if (event.origin !== '${origin}') return;
    if (event.data && event.data.type === 'formbuilder:submitted') {
      console.log('Form submitted:', event.data.formId, event.data.values);
    }
  });
</script>`;

  const handleCopy = (key: string, text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="embed-modal-title"
        className="w-full max-w-2xl rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="success">EMBED &amp; SHARE</Badge>
              <span className="font-mono text-xs text-zinc-500 truncate">
                {tenant.name}
              </span>
            </div>
            <h2
              id="embed-modal-title"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate"
            >
              Share &ldquo;{form.title}&rdquo;
            </h2>
          </div>

          <Button size="xs" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 px-5 pt-2 gap-5 text-xs">
          {(
            [
              { id: 'direct', label: 'Direct Link & Prefill' },
              { id: 'iframe', label: 'Inline Iframe' },
              { id: 'script', label: 'Popup & JS Events' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {form.isPublished === false && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              This form is currently <strong>UNPUBLISHED</strong>. Publish it
              before embedding on a live site.
            </div>
          )}

          {activeTab === 'direct' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="embed_direct_url">Public Form URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="embed_direct_url"
                    readOnly
                    value={publicUrl}
                    className="font-mono text-xs bg-zinc-50"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCopy('direct', publicUrl)}
                    className="shrink-0"
                  >
                    {copiedKey === 'direct' ? 'Copied' : 'Copy URL'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="embed_prefill_url">
                  URL Query Prefill Example
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="embed_prefill_url"
                    readOnly
                    value={prefillUrl}
                    className="font-mono text-xs bg-zinc-50"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCopy('prefill', prefillUrl)}
                    className="shrink-0"
                  >
                    {copiedKey === 'prefill' ? 'Copied' : 'Copy Prefill'}
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Pass query parameters matching field keys or IDs to pre-fill
                  values when opening the form.
                </p>
              </div>

              {dataFields.length > 0 && (
                <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 p-3 space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                    Supported Prefill Query Keys
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dataFields.map((field) => (
                      <span
                        key={field.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-[11px] text-zinc-700 dark:text-zinc-300"
                        title={`Field: ${field.label} (ID: ${field.id})`}
                      >
                        <span className="text-zinc-400">?</span>
                        <span>{toFieldQueryKey(field.label, field.id)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'iframe' && (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="w-36 space-y-1.5">
                  <Label htmlFor="embed_iframe_height">Height (px)</Label>
                  <Input
                    id="embed_iframe_height"
                    type="number"
                    min={240}
                    max={2000}
                    value={iframeHeight}
                    onChange={(e) => setIframeHeight(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <p className="text-xs text-zinc-500 pb-2">
                  Embed directly inside any HTML, Webflow, WordPress, or React
                  page.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>HTML Iframe Snippet</Label>
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => handleCopy('iframe', iframeSnippet)}
                  >
                    {copiedKey === 'iframe' ? 'Copied Snippet' : 'Copy Snippet'}
                  </Button>
                </div>
                <pre className="p-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
                  {iframeSnippet}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'script' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Launch the form in a modal popup and listen for{' '}
                  <code className="font-mono text-emerald-700 dark:text-emerald-400">
                    formbuilder:submitted
                  </code>{' '}
                  events via <code className="font-mono">postMessage</code>.
                </p>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => handleCopy('script', scriptSnippet)}
                  className="shrink-0"
                >
                  {copiedKey === 'script' ? 'Copied Code' : 'Copy Code'}
                </Button>
              </div>

              <pre className="p-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
                {scriptSnippet}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
