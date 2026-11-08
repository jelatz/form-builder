import { useState } from 'react';
import type { ReactElement } from 'react';
import type { FormSchema } from '../../domain/form-schema/index.ts';
import { Badge } from '../../shared/ui/badge.tsx';
import { Button } from '../../shared/ui/button.tsx';
import { Kbd } from '../../shared/ui/kbd.tsx';

export interface SchemaInspectorProps {
  schema: FormSchema;
  onReplaceSchema: (schema: FormSchema) => void;
  onResetSchema: () => void;
}

function downloadSchema(schema: FormSchema): void {
  const dataStr = JSON.stringify(schema, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `form-backup-${schema.slug || 'form'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SchemaInspector({
  schema,
  onReplaceSchema,
  onResetSchema,
}: SchemaInspectorProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const jsonString = JSON.stringify(schema, null, 2);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = (): void => {
    downloadSchema(schema);
  };

  const handleApplyImport = (): void => {
    try {
      setImportError(null);
      const parsed = JSON.parse(importJson) as unknown;

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Backup must be a valid JSON object');
      }

      const candidate = parsed as Record<string, unknown>;
      if (typeof candidate.id !== 'string') {
        throw new Error('Missing or invalid "id" property in backup data');
      }
      if (typeof candidate.title !== 'string') {
        throw new Error('Missing or invalid "title" property in backup data');
      }
      if (!Array.isArray(candidate.fields)) {
        throw new Error('Missing or invalid "fields" array in backup data');
      }

      onReplaceSchema(candidate as unknown as FormSchema);
      setIsImporting(false);
      setImportJson('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm text-zinc-900 dark:text-zinc-100">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            Form Backup, Export &amp; Restore
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Download a backup file of your form questions or restore from a saved template.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsImporting(!isImporting);
              setImportError(null);
            }}
          >
            {isImporting ? 'Cancel' : 'Restore from Backup'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 touch-manipulation"
          >
            {copied ? (
              <>
                <span className="text-emerald-600 dark:text-emerald-400">&#10003;</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <span>Copy Data</span>
                <Kbd className="hidden sm:inline-flex">⌘C</Kbd>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            className="gap-1.5 touch-manipulation"
          >
            <span>Download Backup</span>
            <Kbd>JSON</Kbd>
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onResetSchema}
            className="gap-1.5 touch-manipulation"
          >
            <span>Reset Form</span>
            <Kbd>DEL</Kbd>
          </Button>
        </div>
      </div>

      {/* Import Drawer / Box */}
      {isImporting && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
            Restore Form from Backup
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Paste your saved Form Backup below to restore your questions, options, and settings.
          </p>
          <label
            htmlFor="import-schema-json"
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            Advanced Form Data (JSON Format)
          </label>
          <textarea
            id="import-schema-json"
            aria-label="Advanced Form Data (JSON Format)"
            rows={8}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Paste Form Backup JSON here..."
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 font-mono text-xs text-zinc-900 dark:text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
          />
          {importError && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-400"
            >
              <strong>Validation Error:</strong> {importError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsImporting(false);
                setImportError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApplyImport}
            >
              Apply Backup
            </Button>
          </div>
        </div>
      )}

      {/* Metadata Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Form Identifier
          </div>
          <div className="mt-1 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate">
            {schema.id}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Questions
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            {schema.fields.length}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Question Types Used
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Array.from(new Set(schema.fields.map((f) => f.type))).map((type) => (
              <Badge
                key={type}
                variant="default"
              >
                {type}
              </Badge>
            ))}
            {schema.fields.length === 0 && (
              <span className="text-xs text-zinc-400">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Form Data JSON Viewer */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:p-5 shadow-sm overflow-hidden">
        <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-600 inline-block" />
            <span className="h-2 w-2 rounded-full bg-zinc-600 inline-block" />
            <span className="h-2 w-2 rounded-full bg-zinc-600 inline-block" />
            <span className="ml-2 font-mono text-xs text-zinc-400">
              Advanced Form Data (JSON Format)
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            {new Blob([jsonString]).size} bytes
          </span>
        </div>
        <pre className="overflow-x-auto font-mono text-xs text-zinc-100 leading-relaxed max-h-[500px]">
          {jsonString}
        </pre>
      </div>
    </div>
  );
}
