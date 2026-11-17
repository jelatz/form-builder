import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib';

export type TooltipSide = 'top' | 'bottom' | 'right' | 'left';

export interface TooltipProps {
  /** Text shown in the tooltip bubble. */
  content: ReactNode;
  /** Preferred side; flips automatically when there is no room. */
  side?: TooltipSide;
  /** Hover delay in ms (keyboard focus shows immediately). */
  delay?: number;
  /** Disable the tooltip without unmounting the wrapper. */
  disabled?: boolean;
  /** Extra classes for the inline wrapper element. */
  className?: string;
  children: ReactNode;
}

interface TooltipPosition {
  top: number;
  left: number;
  side: TooltipSide;
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Lightweight hover/focus tooltip. Wraps its trigger in an inline span so it
 * also works for disabled buttons (which don't emit pointer events). The
 * bubble is portaled to <body> so it is never clipped by overflow containers.
 *
 * Do NOT also set a native `title` on the trigger, or the browser tooltip will
 * appear on top of this one.
 */
export function Tooltip({
  content,
  side = 'top',
  delay = 250,
  disabled = false,
  className,
  children,
}: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = (immediate: boolean) => {
    if (disabled) return;
    clearTimer();
    if (immediate) {
      setIsOpen(true);
    } else {
      timerRef.current = window.setTimeout(() => setIsOpen(true), delay);
    }
  };

  const hide = () => {
    clearTimer();
    setIsOpen(false);
    setPosition(null);
  };

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;

    const t = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const fits: Record<TooltipSide, boolean> = {
      top: t.top - b.height - GAP >= VIEWPORT_MARGIN,
      bottom: t.bottom + b.height + GAP <= vh - VIEWPORT_MARGIN,
      right: t.right + b.width + GAP <= vw - VIEWPORT_MARGIN,
      left: t.left - b.width - GAP >= VIEWPORT_MARGIN,
    };
    const opposite: Record<TooltipSide, TooltipSide> = {
      top: 'bottom',
      bottom: 'top',
      right: 'left',
      left: 'right',
    };
    const resolved = fits[side] || !fits[opposite[side]] ? side : opposite[side];

    let top: number;
    let left: number;
    if (resolved === 'top' || resolved === 'bottom') {
      top = resolved === 'top' ? t.top - b.height - GAP : t.bottom + GAP;
      left = t.left + t.width / 2 - b.width / 2;
    } else {
      top = t.top + t.height / 2 - b.height / 2;
      left = resolved === 'right' ? t.right + GAP : t.left - b.width - GAP;
    }

    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - b.width - VIEWPORT_MARGIN));
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - b.height - VIEWPORT_MARGIN));

    setPosition({ top, left, side: resolved });
  }, [side]);

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition, content]);

  useEffect(() => {
    if (!isOpen) return;
    const handleDismiss = () => {
      setIsOpen(false);
      setPosition(null);
    };
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    window.addEventListener('mousedown', handleDismiss, true);
    return () => {
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
      window.removeEventListener('mousedown', handleDismiss, true);
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const visible = isOpen && !disabled;

  return (
    <span
      ref={triggerRef}
      className={cn('inline-flex', className)}
      aria-describedby={visible ? id : undefined}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onFocus={(e) => {
        // Only show on keyboard focus, not on mouse-click focus.
        const target = e.target as HTMLElement;
        if (target.matches(':focus-visible')) show(true);
      }}
      onBlur={hide}
    >
      {children}
      {visible &&
        content !== null &&
        content !== '' &&
        createPortal(
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
            }}
            className={cn(
              'z-[100] pointer-events-none max-w-xs rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-50 shadow-md whitespace-nowrap',
              'dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900',
              position ? 'opacity-100' : 'opacity-0',
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
