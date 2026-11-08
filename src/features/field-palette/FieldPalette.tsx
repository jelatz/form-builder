import { useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { FieldType } from '../../domain/form-schema/index.ts';
import { getFieldCatalog } from '../../fields/index.ts';
import type { FieldCatalogItem } from '../../fields/index.ts';
import { cn } from '../../shared/lib/cn.ts';
import { beginPointerDrag } from '../../shared/lib/pointer-drag.ts';

export interface FieldPaletteProps {
  onAddField: (type: FieldType) => void;
  className?: string;
}

const INPUT_FIELD_TYPES: readonly FieldType[] = [
  'text',
  'email',
  'phone',
  'number',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'date',
];

const LAYOUT_FIELD_TYPES: readonly FieldType[] = [
  'section',
  'hidden',
];

function FieldTypeIcon({ type }: { type: FieldType }): ReactElement {
  switch (type) {
    case 'text':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h15m-7.5 0v10.5m-3-10.5h6m-6 10.5h6" />
        </svg>
      );
    case 'email':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      );
    case 'phone':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
      );
    case 'number':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h13.5m-13.5 7.5h13.5m-10.5-12l-3 16.5m9-16.5l-3 16.5" />
        </svg>
      );
    case 'textarea':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      );
    case 'select':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      );
    case 'radio':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="8" stroke="currentColor" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    case 'checkbox':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'date':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
        </svg>
      );
    case 'hidden':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      );
    case 'section':
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6h16.5" />
        </svg>
      );
  }
}

export function FieldPalette({ onAddField, className }: FieldPaletteProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const catalog = getFieldCatalog();

  const filteredCatalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter(
      (item) =>
        item.paletteLabel.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        item.badge.toLowerCase().includes(query)
    );
  }, [catalog, searchQuery]);

  const inputFields = useMemo(
    () => filteredCatalog.filter((item) => (INPUT_FIELD_TYPES as readonly string[]).includes(item.type)),
    [filteredCatalog]
  );

  const layoutFields = useMemo(
    () => filteredCatalog.filter((item) => (LAYOUT_FIELD_TYPES as readonly string[]).includes(item.type)),
    [filteredCatalog]
  );

  const renderFieldTile = (item: FieldCatalogItem): ReactNode => {
    return (
      <div
        key={item.type}
        role="button"
        tabIndex={0}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (e.pointerType !== 'mouse' || (typeof window !== 'undefined' && window.innerWidth < 1024)) {
            return;
          }
          beginPointerDrag({
            kind: 'palette',
            id: item.type,
            label: `Add ${item.paletteLabel}`,
            badge: item.badge,
            startX: e.clientX,
            startY: e.clientY,
          });
        }}
        onClick={() => onAddField(item.type)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAddField(item.type);
          }
        }}
        className={cn(
          'group flex cursor-grab select-none touch-manipulation items-start gap-2 sm:gap-2.5 rounded-md border p-2 sm:p-2.5 text-left min-w-0 max-w-full',
          'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60',
          'hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700',
          'active:scale-[0.99] active:cursor-grabbing',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300',
          'transition-all duration-150 shadow-sm'
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
          <FieldTypeIcon type={item.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1 min-w-0">
            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white truncate min-w-0">
              {item.paletteLabel}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="lg:hidden shrink-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                + Add
              </span>
              <span className="shrink-0 font-mono text-[9px] sm:text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded-sm border border-zinc-200/60 dark:border-zinc-700/60 select-none">
                {item.badge}
              </span>
            </div>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 min-w-0 truncate">
            {item.description}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 shadow-sm flex flex-col',
        className
      )}
    >
      {/* Palette Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Add a Question
          </h2>
          <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
            Click or Drag
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Click or drag any question type onto your form
        </p>

        {/* Search Input */}
        <div className="relative mt-3 min-w-0">
          <label htmlFor="field-palette-search" className="sr-only">
            Search question types
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            id="field-palette-search"
            aria-label="Search question types"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search question types..."
            className={cn(
              'h-9 sm:h-8 w-full min-w-0 rounded-md border pl-8 pr-8 text-xs touch-manipulation',
              'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900',
              'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300',
              'transition-colors shadow-sm'
            )}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 touch-manipulation"
              title="Clear search"
              aria-label="Clear search"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <kbd className="inline-flex items-center justify-center font-mono text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 select-none">
                ⌘K
              </kbd>
            </div>
          )}
        </div>
      </div>

      {/* Field Groups or Empty State */}
      <div className="space-y-4 overflow-y-auto min-w-0">
        {filteredCatalog.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 py-8 px-3 text-center">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">No question types found</p>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              No question type matches &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300 touch-manipulation"
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            {/* Form Fields Group */}
            {inputFields.length > 0 && (
              <div className="space-y-2 min-w-0">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate min-w-0">
                    Question Types
                  </span>
                  <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 shrink-0">
                    {inputFields.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 w-full min-w-0">
                  {inputFields.map((item) => renderFieldTile(item))}
                </div>
              </div>
            )}

            {/* Layout & Structure Group */}
            {layoutFields.length > 0 && (
              <div className="space-y-2 pt-1 min-w-0">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate min-w-0">
                    Headings &amp; Tracking
                  </span>
                  <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 shrink-0">
                    {layoutFields.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 w-full min-w-0">
                  {layoutFields.map((item) => renderFieldTile(item))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
