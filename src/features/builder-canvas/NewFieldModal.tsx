import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { FieldType } from '../../domain/form-schema/index.ts';
import { getFieldCatalog } from '../../fields/index.ts';
import { Button, Input } from '../../shared/ui/index.ts';
import { toSnakeCase } from '../../shared/lib/index.ts';

export interface NewFieldModalProps {
  isOpen: boolean;
  fieldType: FieldType | null;
  initialLabel?: string;
  onClose: () => void;
  onConfirm: (label: string, webhookKey: string) => void;
}

interface NewFieldModalContentProps {
  fieldType: FieldType;
  initialLabel: string;
  onClose: () => void;
  onConfirm: (label: string, webhookKey: string) => void;
}

function NewFieldModalContent({
  fieldType,
  initialLabel,
  onClose,
  onConfirm,
}: NewFieldModalContentProps): ReactElement {
  const [label, setLabel] = useState<string>(initialLabel);
  const [webhookKey, setWebhookKey] = useState<string>(() => toSnakeCase(initialLabel));
  const [isKeyCustomized, setIsKeyCustomized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const catalogItem = getFieldCatalog().find((item) => item.type === fieldType);
  const typeDisplay = catalogItem?.paletteLabel ?? (fieldType ? fieldType.charAt(0).toUpperCase() + fieldType.slice(1) : '');

  const handleLabelChange = (nextLabel: string): void => {
    setLabel(nextLabel);
    if (error) {
      setError(null);
    }
    if (!isKeyCustomized) {
      setWebhookKey(toSnakeCase(nextLabel));
    }
  };

  const handleKeyChange = (val: string): void => {
    setIsKeyCustomized(true);
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setWebhookKey(sanitized);
  };

  const handleResetKey = (): void => {
    setIsKeyCustomized(false);
    setWebhookKey(toSnakeCase(label));
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Question name is required.');
      return;
    }
    const finalKey = webhookKey.trim() || toSnakeCase(trimmedLabel) || 'field';
    onConfirm(trimmedLabel, finalKey);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-field-modal-title"
      className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 sm:mx-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg p-5 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 font-mono text-[10px] font-bold">
              {catalogItem?.badge ?? 'FLD'}
            </div>
            <div>
              <h3 id="new-field-modal-title" className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                Add {typeDisplay || 'Question'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Name your question to add it to the form.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field Label Input */}
          <div className="space-y-1.5">
            <label htmlFor="new-field-label-input" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Question / Field Label <span className="text-rose-500">*</span>
            </label>
            <Input
              id="new-field-label-input"
              autoFocus
              type="text"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder={`e.g. ${catalogItem?.paletteLabel ?? 'Full Name'}`}
              className="w-full text-xs"
            />
            {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}
          </div>

          {/* Advanced CRM / Export Settings (Optional) */}
          <details className="group rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 p-3 text-xs">
            <summary className="flex cursor-pointer select-none items-center justify-between font-medium text-zinc-700 dark:text-zinc-300">
              <span>Advanced CRM / Export Settings (Optional)</span>
              <span className="text-[11px] text-zinc-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-3 space-y-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="new-field-key-input" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    CRM / Webhook Field Key
                  </label>
                  <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                    {isKeyCustomized ? 'manual override' : 'auto-generated'}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="new-field-key-input"
                    type="text"
                    value={webhookKey}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder="auto_generated_key"
                    className="w-full font-mono text-xs pr-16"
                  />
                  {isKeyCustomized && (
                    <button
                      type="button"
                      onClick={handleResetKey}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Exported attribute key for GoHighLevel, Close, Zoho, and Webhooks.
                </p>
              </div>

              {/* Payload Preview */}
              <div className="rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Payload preview:</span>
                <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                  &quot;{webhookKey || 'field_key'}&quot;: &quot;...&quot;
                </span>
              </div>
            </div>
          </details>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!label.trim()}>
              Add Question
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NewFieldModal({
  isOpen,
  fieldType,
  initialLabel = '',
  onClose,
  onConfirm,
}: NewFieldModalProps): ReactElement | null {
  if (!isOpen || !fieldType) {
    return null;
  }

  return (
    <NewFieldModalContent
      key={`${fieldType}-${initialLabel}`}
      fieldType={fieldType}
      initialLabel={initialLabel}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
