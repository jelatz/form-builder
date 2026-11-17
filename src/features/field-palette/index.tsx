import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import type { FieldType, FormField } from '../../domain/form-schema';
import {
  ZOHO_PALETTE_CATEGORIES,
  type ZohoPaletteCategoryGroup,
  type ZohoPaletteTab,
  type ZohoPaletteTile,
} from '../../fields/registry';
import { Tooltip } from '../../shared/ui';

const PALETTE_DRAG_TYPE_MIME = 'application/x-form-builder-field-type';
const PALETTE_DRAG_PRESET_MIME = 'application/x-form-builder-field-preset';

const ACCENT_COLOR_CLASSES: Record<ZohoPaletteTile['accentColor'], string> = {
  amber: 'text-amber-500',
  emerald: 'text-emerald-600',
  blue: 'text-blue-600',
  violet: 'text-violet-600',
  cyan: 'text-sky-600',
  rose: 'text-rose-500',
};

function renderTileIcon(
  iconType: string,
  accentColor: ZohoPaletteTile['accentColor'],
): ReactNode {
  const iconColor = ACCENT_COLOR_CLASSES[accentColor] || 'text-zinc-600';
  const iconClass = `w-[18px] h-[18px] shrink-0 ${iconColor}`;

  switch (iconType) {
    case 'col-1':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="4"
            y="3"
            width="16"
            height="18"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8 8h8M8 12h8M8 16h5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'col-2':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="3"
            width="8"
            height="18"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="13"
            y="3"
            width="8"
            height="18"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
    case 'col-3':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="2"
            y="3"
            width="5.5"
            height="18"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="9.25"
            y="3"
            width="5.5"
            height="18"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="16.5"
            y="3"
            width="5.5"
            height="18"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
    case 'user':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'address':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="9 22 9 12 15 12 15 22"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'email':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            width="20"
            height="16"
            x="2"
            y="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'globe':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
    case 'map-pin':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'text-single':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="6"
            width="18"
            height="12"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7 12h10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'text-multi':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7 8h10M7 12h10M7 16h6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'regex':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8 9v6M7 9h2M7 15h2M12 12h.01M16 10l-2 4M14 10l2 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'number':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 21"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'decimal':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="8" cy="14" r="1.5" fill="currentColor" />
          <path
            d="M12 10a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0v-2a2 2 0 0 1 2-2zM18 10a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0v-2a2 2 0 0 1 2-2z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      );
    case 'formula':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M6 19c2 0 3-1 3.5-3.5L12 6h3M7 11h7M16 16l4-4M16 12l4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'currency':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'dropdown':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m8 10 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'grouped-dropdown':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M7 8h6M7 12h4M7 16h5M17 11l2 2 2-2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'dependent-dropdown':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="4"
            width="11"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="10"
            y="13"
            width="11"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8.5 11v3.5h1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'radio':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
        </svg>
      );
    case 'checkbox':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            width="16"
            height="16"
            x="4"
            y="4"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m9 12 2 2 4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'multi-choice':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M9 6h11M9 12h11M9 18h11"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m4 6 1 1 2-2M4 12 5 13 7 11M4 18 5 19 7 17"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'cardview':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="4"
            width="8"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="13"
            y="4"
            width="8"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="3"
            y="13"
            width="8"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="13"
            y="13"
            width="8"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
    case 'image-choices':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            width="18"
            height="18"
            x="3"
            y="3"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <path
            d="m21 15-5-5-8 8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'date':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <path
            d="M8 2v4M16 2v4M3 10h18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect
            width="18"
            height="18"
            x="3"
            y="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="8" cy="14" r="1" fill="currentColor" />
          <circle cx="12" cy="14" r="1" fill="currentColor" />
          <circle cx="16" cy="14" r="1" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 8v8M8 12h8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export interface FieldPaletteProps {
  onAddField: (type: FieldType, presetPatch?: Partial<FormField>) => void;
}

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  const [activeTab, setActiveTab] = useState<ZohoPaletteTab>('form_fields');
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const displayedGroups = useMemo(() => {
    return ZOHO_PALETTE_CATEGORIES.map((group) => {
      // When searching, match tiles across any category
      if (normalizedQuery) {
        const matchingTiles = group.tiles.filter(
          (tile) =>
            tile.label.toLowerCase().includes(normalizedQuery) ||
            tile.category.toLowerCase().includes(normalizedQuery),
        );
        if (matchingTiles.length === 0) return null;
        return {
          ...group,
          tiles: matchingTiles,
        };
      }

      // No query: only show groups in the active tab
      if (group.tab !== activeTab) return null;
      return group;
    }).filter((g): g is ZohoPaletteCategoryGroup => g !== null);
  }, [activeTab, normalizedQuery]);

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    tile: ZohoPaletteTile,
  ) => {
    event.dataTransfer.setData(PALETTE_DRAG_TYPE_MIME, tile.type);
    if (tile.presetPatch) {
      event.dataTransfer.setData(
        PALETTE_DRAG_PRESET_MIME,
        JSON.stringify(tile.presetPatch),
      );
    }
    event.dataTransfer.setData('text/plain', tile.type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside
      aria-label="Field Palette"
      className="w-72 shrink-0 border-r border-zinc-200 bg-white flex flex-col select-none"
    >
      {/* Top Tabs (Form Fields / Smart Fields) */}
      <div className="grid grid-cols-2 border-b border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => setActiveTab('form_fields')}
          className={`h-10 text-xs flex items-center justify-center transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === 'form_fields'
              ? 'text-emerald-600 font-semibold border-emerald-600'
              : 'text-zinc-600 hover:text-zinc-900 border-transparent'
          }`}
        >
          Form Fields
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('smart_fields')}
          className={`h-10 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-px ${
            activeTab === 'smart_fields'
              ? 'text-emerald-600 font-semibold border-emerald-600'
              : 'text-zinc-600 hover:text-zinc-900 border-transparent'
          }`}
        >
          <span>Smart Fields</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="p-2.5 border-b border-zinc-100 bg-white">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="h-8 w-full pl-8 pr-3 text-xs rounded-md border border-zinc-200 bg-zinc-50/50 text-zinc-800 placeholder:text-zinc-400 focus:bg-white focus:border-emerald-500 focus:outline-none"
          />
          {searchQuery && (
            <Tooltip content="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2">
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-zinc-400 hover:text-zinc-600 text-xs p-0.5"
                aria-label="Clear search"
              >
                ✕
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Categorized 3-Column Icon-Tile Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-white">
        {displayedGroups.map((group) => (
          <div key={group.category}>
            <h3 className="text-[11px] font-bold text-zinc-800 mb-2">
              {group.category}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {group.tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  draggable
                  onClick={() => onAddField(tile.type, tile.presetPatch)}
                  onDragStart={(e) => handleDragStart(e, tile)}
                  className="relative h-[68px] p-1.5 rounded-md border border-zinc-200/90 bg-white hover:border-emerald-500 hover:shadow-xs transition-all duration-150 flex flex-col items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing active:scale-[0.98] group overflow-hidden"
                >
                  {renderTileIcon(tile.iconType, tile.accentColor)}
                  <span className="text-[10px] font-medium text-zinc-700 group-hover:text-zinc-950 text-center leading-tight line-clamp-2">
                    {tile.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {displayedGroups.length === 0 && (
          <div className="py-8 text-center text-xs text-zinc-400">
            No fields found matching &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>
    </aside>
  );
}
