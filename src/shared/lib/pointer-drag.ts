export type PointerDropPosition = 'before' | 'after' | 'left' | 'right';

export interface PointerDragState {
  kind: 'palette' | 'canvas';
  id: string; // FieldType for 'palette', field.id for 'canvas'
  label: string;
  badge: string;
  clientX: number;
  clientY: number;
  isDragging: boolean;
  overTargetId: string | null;
  dropPosition: PointerDropPosition;
  overContainer: boolean;
}

export type PointerDropCallback = (result: {
  kind: 'palette' | 'canvas';
  id: string;
  overTargetId: string | null;
  dropPosition: PointerDropPosition;
  overContainer: boolean;
}) => void;

export interface BeginPointerDragParams {
  kind: 'palette' | 'canvas';
  id: string;
  label: string;
  badge: string;
  startX: number;
  startY: number;
}

const listeners = new Set<(state: PointerDragState | null) => void>();
const dropHandlers = new Set<PointerDropCallback>();
let activeCleanup: (() => void) | null = null;

function notifyListeners(state: PointerDragState | null): void {
  for (const listener of listeners) {
    listener(state);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function subscribePointerDrag(listener: (state: PointerDragState | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerPointerDropHandler(handler: PointerDropCallback): () => void {
  dropHandlers.add(handler);
  return () => {
    dropHandlers.delete(handler);
  };
}

export function beginPointerDrag(params: {
  kind: 'palette' | 'canvas';
  id: string;
  label: string;
  badge: string;
  startX: number;
  startY: number;
}): void {
  if (activeCleanup) {
    activeCleanup();
  }

  let isDragging = false;
  let lastState: PointerDragState | null = null;

  const onPointerMove = (ev: PointerEvent): void => {
    const dist = Math.hypot(ev.clientX - params.startX, ev.clientY - params.startY);
    if (!isDragging) {
      if (dist <= 4) {
        return;
      }
      isDragging = true;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    }

    let ghost = document.getElementById('ag-pointer-drag-ghost');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.id = 'ag-pointer-drag-ghost';
      ghost.className =
        'fixed z-[99999] pointer-events-none flex items-center gap-2 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 border border-zinc-700 px-3 py-2 text-xs font-semibold shadow-md select-none';
      document.body.appendChild(ghost);
    }
    ghost.style.left = `${ev.clientX + 12}px`;
    ghost.style.top = `${ev.clientY + 12}px`;
    ghost.innerHTML = `<span class="flex h-5 w-5 items-center justify-center rounded-sm bg-zinc-800 text-zinc-300 dark:bg-zinc-200 dark:text-zinc-800 font-mono text-[10px] font-bold">${escapeHtml(
      params.badge,
    )}</span><span>${escapeHtml(params.label)}</span>`;

    const elements = document.elementsFromPoint(ev.clientX, ev.clientY);

    let foundCardEl: HTMLElement | null = null;
    for (const el of elements) {
      if (el instanceof HTMLElement) {
        const card = el.closest<HTMLElement>('[data-drag-card-id]');
        if (card) {
          foundCardEl = card;
          break;
        }
      }
    }

    const overContainer = elements.some(
      (el) => el instanceof HTMLElement && Boolean(el.closest('[data-drag-dropzone="true"]')),
    );

    if (!foundCardEl && overContainer) {
      const dropzones = document.querySelectorAll<HTMLElement>('[data-drag-dropzone="true"]');
      let minDistance = Infinity;
      let bestCard: HTMLElement | null = null;

      for (const dropzone of dropzones) {
        const cards = dropzone.querySelectorAll<HTMLElement>('[data-drag-card-id]');
        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          if (rect.top - 6 <= ev.clientY && ev.clientY <= rect.bottom + 6) {
            let dist = 0;
            if (ev.clientX < rect.left) {
              dist = rect.left - ev.clientX;
            } else if (ev.clientX > rect.right) {
              dist = ev.clientX - rect.right;
            }
            if (dist < minDistance) {
              minDistance = dist;
              bestCard = card;
            }
          }
        }
      }

      if (bestCard) {
        foundCardEl = bestCard;
      }
    }

    let overTargetId: string | null = null;
    let dropPosition: PointerDropPosition = 'before';

    if (foundCardEl) {
      const targetId = foundCardEl.getAttribute('data-drag-card-id');
      const canBeside = foundCardEl.getAttribute('data-drag-can-beside') !== 'false';
      const rect = foundCardEl.getBoundingClientRect();
      const relX = Math.min(Math.max((ev.clientX - rect.left) / Math.max(rect.width, 1), 0), 1);
      const relY = Math.min(Math.max((ev.clientY - rect.top) / Math.max(rect.height, 1), 0), 1);

      if (canBeside && relY >= 0.2 && relY <= 0.8) {
        if (relX < 0.38) {
          dropPosition = 'left';
        } else if (relX > 0.62) {
          dropPosition = 'right';
        } else {
          dropPosition = relY <= 0.5 ? 'before' : 'after';
        }
      } else {
        dropPosition = relY <= 0.5 ? 'before' : 'after';
      }

      if (params.kind === 'canvas' && targetId === params.id) {
        overTargetId = null;
      } else {
        overTargetId = targetId;
      }
    }

    lastState = {
      kind: params.kind,
      id: params.id,
      label: params.label,
      badge: params.badge,
      clientX: ev.clientX,
      clientY: ev.clientY,
      isDragging: true,
      overTargetId,
      dropPosition,
      overContainer,
    };

    notifyListeners(lastState);
  };

  const cleanup = (): void => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    const ghost = document.getElementById('ag-pointer-drag-ghost');
    if (ghost && ghost.parentNode) {
      ghost.parentNode.removeChild(ghost);
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    activeCleanup = null;
  };

  const onPointerUp = (): void => {
    const wasDragging = isDragging;
    const finalState = lastState;
    cleanup();

    if (wasDragging && finalState) {
      const suppressClick = (e: MouseEvent): void => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener('click', suppressClick, { capture: true, once: true });
      setTimeout(() => {
        window.removeEventListener('click', suppressClick, { capture: true });
      }, 50);

      const result = {
        kind: params.kind,
        id: params.id,
        overTargetId: finalState.overTargetId,
        dropPosition: finalState.dropPosition,
        overContainer: finalState.overContainer,
      };

      for (const handler of dropHandlers) {
        handler(result);
      }
    }

    notifyListeners(null);
  };

  activeCleanup = cleanup;
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}
