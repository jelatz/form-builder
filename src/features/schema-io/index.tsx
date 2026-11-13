import { useState, type ChangeEvent } from 'react';
import {
  parseFormSchemaJson,
  type FormSchema,
} from '../../domain/form-schema';
import { Badge, Button } from '../../shared/ui';

export interface SchemaIoPanelProps {
  schema: FormSchema;
  onImportSchema: (schema: FormSchema) => void;
}

export function SchemaIoPanel({ schema, onImportSchema }: SchemaIoPanelProps) {
  const formattedSchemaJson = JSON.stringify(schema, null, 2);
  const [importDraft, setImportDraft] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(formattedSchemaJson);
      setStatusMessage({
        type: 'success',
        text: 'Copied FormSchema JSON to clipboard.',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Clipboard access failed.',
      });
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([formattedSchemaJson], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${schema.slug || 'form-schema'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage({
      type: 'success',
      text: `Downloaded ${schema.slug || 'form-schema'}.json`,
    });
  };

  const handleApplyImport = (rawJson: string) => {
    const result = parseFormSchemaJson(rawJson, schema.clientId);
    if (!result.ok) {
      setStatusMessage({ type: 'error', text: result.error });
      return;
    }
    onImportSchema(result.schema);
    setImportDraft('');
    setStatusMessage({
      type: 'success',
      text: `Imported "${result.schema.title}" (${result.schema.fields.length} fields).`,
    });
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleApplyImport(reader.result);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <main
      aria-label="Schema JSON I/O"
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export / Live AST View */}
        <section className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">EXPORT AST</Badge>
                <span className="font-mono text-xs text-zinc-500">
                  {schema.id}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                100% serializable FormSchema JSON representation
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Button size="xs" variant="secondary" onClick={handleCopyJson}>
                Copy JSON
              </Button>
              <Button size="xs" variant="primary" onClick={handleDownloadJson}>
                Download .json
              </Button>
            </div>
          </div>

          <pre className="p-3 rounded-md bg-zinc-50 border border-zinc-200 font-mono text-xs text-zinc-800 overflow-auto max-h-[480px]">
            {formattedSchemaJson}
          </pre>
        </section>

        {/* Import / Parse View */}
        <section className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <Badge variant="neutral">IMPORT AST</Badge>
              <p className="text-xs text-zinc-500 mt-1">
                Paste JSON or upload a schema file to validate and load
              </p>
            </div>

            <label className="inline-flex items-center justify-center h-7 px-2.5 text-xs rounded-md bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 border border-zinc-200 font-medium cursor-pointer transition-colors duration-150 shadow-2xs">
              Upload .json
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
          </div>

          <textarea
            aria-label="Paste FormSchema JSON"
            value={importDraft}
            onChange={(e) => setImportDraft(e.target.value)}
            placeholder='{"id": "form_custom", "title": "Custom Form", "fields": [...]}'
            rows={14}
            className="w-full p-3 rounded-md bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 border border-zinc-200 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-600 transition-colors"
          />

          {statusMessage && (
            <div
              role="status"
              className={
                statusMessage.type === 'error'
                  ? 'px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-xs text-rose-700'
                  : 'px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-xs text-emerald-700'
              }
            >
              {statusMessage.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={!importDraft.trim()}
              onClick={() => {
                setImportDraft('');
                setStatusMessage(null);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!importDraft.trim()}
              onClick={() => handleApplyImport(importDraft)}
            >
              Validate & Load Schema
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
