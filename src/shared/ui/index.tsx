import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type LabelHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'sm' | 'xs';
export type ButtonAlign = 'center' | 'start' | 'between';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  align?: ButtonAlign;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 font-medium shadow-2xs',
  secondary:
    'bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 border border-zinc-200 font-medium shadow-2xs',
  ghost:
    'bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent',
  danger:
    'text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 font-medium',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  default: 'h-9 px-3 text-sm rounded-md',
  sm: 'h-8 px-2.5 text-xs rounded-md',
  xs: 'h-7 px-2 text-xs rounded-md',
};

const BUTTON_ALIGNS: Record<ButtonAlign, string> = {
  center: 'justify-center',
  start: 'justify-start',
  between: 'justify-between',
};

export function Button({
  variant = 'secondary',
  size = 'default',
  align,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const hasJustifyClass = Boolean(
    className &&
      /\bjustify-(start|end|center|between|around|evenly|stretch|normal)\b/.test(
        className,
      ),
  );

  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
        align ? BUTTON_ALIGNS[align] : !hasJustifyClass && 'justify-center',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ hasError, className, ref, ...props }: InputProps) {
  const hasWidthClass = Boolean(className && /\bw-\S+/.test(className));

  return (
    <input
      ref={ref}
      className={cn(
        !hasWidthClass && 'w-full',
        'h-9 px-3 text-sm rounded-md bg-white text-zinc-900 placeholder:text-zinc-400 border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-600 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
        hasError
          ? 'border-rose-500 focus-visible:ring-rose-500/30'
          : 'border-zinc-200 hover:border-zinc-300',
        className,
      )}
      {...props}
    />
  );
}

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  meta?: string;
  disabled?: boolean;
}

export type FilterDropdownOption = DropdownOption;

interface DropdownPopoverPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

function DropdownChevron({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={cn(
        'h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform duration-150',
        isOpen && 'rotate-180 text-zinc-600',
      )}
      aria-hidden="true"
    >
      <path
        d="M4.5 6.25L8 9.75l3.5-3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useDropdownPopover({
  align = 'left',
  disabled = false,
  minMenuWidth = 240,
  fixedMenuWidth,
}: {
  align?: 'left' | 'right';
  disabled?: boolean;
  minMenuWidth?: number;
  fixedMenuWidth?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<DropdownPopoverPosition | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportMargin = 8;
    const verticalGap = 6;
    const width = Math.min(
      fixedMenuWidth ?? Math.max(rect.width, minMenuWidth),
      window.innerWidth - viewportMargin * 2,
    );

    const rawLeft = align === 'right' ? rect.right - width : rect.left;
    const left = Math.max(
      viewportMargin,
      Math.min(rawLeft, window.innerWidth - width - viewportMargin),
    );

    const spaceBelow = window.innerHeight - rect.bottom - viewportMargin - verticalGap;
    const spaceAbove = rect.top - viewportMargin - verticalGap;
    const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      Math.min(288, openUpward ? spaceAbove : spaceBelow),
    );

    setPosition(
      openUpward
        ? {
            bottom: window.innerHeight - rect.top + verticalGap,
            left,
            width,
            maxHeight,
          }
        : {
            top: rect.bottom + verticalGap,
            left,
            width,
            maxHeight,
          },
    );
  }, [align, fixedMenuWidth, minMenuWidth]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleViewportChange = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isOpen, updatePosition]);

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const closeAndFocusTrigger = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!isOpen) {
        event.preventDefault();
        setIsOpen(true);
      }
    }
  };

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const optionNodes =
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      );
    if (!optionNodes || optionNodes.length === 0) return;

    const currentFocusIndex = Array.from(optionNodes).indexOf(
      event.currentTarget,
    );
    const activeIndex = currentFocusIndex >= 0 ? currentFocusIndex : index;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      optionNodes[(activeIndex + 1) % optionNodes.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      optionNodes[
        (activeIndex - 1 + optionNodes.length) % optionNodes.length
      ]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      optionNodes[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      optionNodes[optionNodes.length - 1]?.focus();
    }
  };

  return {
    isOpen,
    position,
    containerRef,
    triggerRef,
    menuRef,
    toggleOpen,
    closeAndFocusTrigger,
    handleTriggerKeyDown,
    handleOptionKeyDown,
  };
}

interface DropdownListboxPortalProps {
  isOpen: boolean;
  position: DropdownPopoverPosition | null;
  menuRef: Ref<HTMLDivElement>;
  ariaLabel?: string;
  menuHeading?: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  onOptionKeyDown: (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void;
}

function DropdownListboxPortal({
  isOpen,
  position,
  menuRef,
  ariaLabel,
  menuHeading,
  value,
  options,
  onSelect,
  onOptionKeyDown,
}: DropdownListboxPortalProps) {
  if (!isOpen || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
      className="z-50 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg"
    >
      {menuHeading && (
        <div className="px-2.5 py-1.5 mb-1 border-b border-zinc-100 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          {menuHeading}
        </div>
      )}
      <div className="space-y-0.5">
        {options.map((opt, index) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={opt.disabled}
              onClick={() => onSelect(opt.value)}
              onKeyDown={(e) => onOptionKeyDown(e, index)}
              className={cn(
                'w-full flex items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed',
                selected
                  ? 'bg-emerald-50/80 text-emerald-950'
                  : 'text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-950',
              )}
            >
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-xs truncate',
                    selected
                      ? 'font-semibold text-emerald-950'
                      : 'font-medium text-zinc-800',
                  )}
                >
                  {opt.label}
                </div>
                {opt.description && (
                  <div className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                    {opt.description}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {opt.meta && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono text-[10px] border',
                      selected
                        ? 'border-emerald-200 bg-white text-emerald-700'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-500',
                    )}
                  >
                    {opt.meta}
                  </span>
                )}
                {selected && (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-3.5 w-3.5 text-emerald-600"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.5 8.5l3 3 6-6.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

export interface SelectProps {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  value: string;
  options: DropdownOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  menuHeading?: string;
  prefix?: string;
  icon?: ReactNode;
  align?: 'left' | 'right';
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Select({
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  value,
  options,
  onValueChange,
  placeholder = '-Select-',
  menuHeading,
  prefix,
  icon,
  align = 'left',
  hasError = false,
  disabled = false,
  className,
}: SelectProps) {
  const hasWidthClass = Boolean(className && /\bw-\S+/.test(className));
  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;
  const isPlaceholderDisplay = !selectedOption || selectedOption.value === '';

  const {
    isOpen,
    position,
    containerRef,
    triggerRef,
    menuRef,
    toggleOpen,
    closeAndFocusTrigger,
    handleTriggerKeyDown,
    handleOptionKeyDown,
  } = useDropdownPopover({
    align,
    disabled,
    minMenuWidth: 240,
  });

  return (
    <div
      ref={containerRef}
      className={cn('relative', hasWidthClass ? 'inline-block' : 'block w-full')}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid ?? (hasError || undefined)}
        aria-required={ariaRequired}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          !hasWidthClass && 'w-full',
          'inline-flex items-center justify-between gap-2 h-9 px-3 text-sm rounded-md bg-white border transition-colors duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
          hasError
            ? 'border-rose-500 focus-visible:ring-rose-500/30'
            : isOpen
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300',
          className,
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
          {icon && <span className="shrink-0 text-zinc-400">{icon}</span>}
          {prefix && (
            <span className="text-zinc-500 whitespace-nowrap shrink-0">
              {prefix}:
            </span>
          )}
          <span
            className={cn(
              'truncate',
              isPlaceholderDisplay
                ? 'text-zinc-500 font-normal'
                : 'text-zinc-900 font-medium',
            )}
          >
            {displayLabel}
          </span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {selectedOption?.meta && (
            <span className="font-mono text-[11px] text-zinc-400">
              ({selectedOption.meta})
            </span>
          )}
          <DropdownChevron isOpen={isOpen} />
        </span>
      </button>

      <DropdownListboxPortal
        isOpen={isOpen}
        position={position}
        menuRef={menuRef}
        ariaLabel={ariaLabel ?? menuHeading ?? placeholder}
        menuHeading={menuHeading}
        value={value}
        options={options}
        onSelect={(nextValue) => {
          onValueChange(nextValue);
          closeAndFocusTrigger();
        }}
        onOptionKeyDown={handleOptionKeyDown}
      />
    </div>
  );
}

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  requiredIndicator?: boolean;
}

export function Label({
  requiredIndicator,
  className,
  children,
  ...props
}: LabelProps) {
  return (
    <label
      className={cn(
        'block text-xs font-medium text-zinc-700 select-none',
        className,
      )}
      {...props}
    >
      {children}
      {requiredIndicator && (
        <span className="ml-1 text-rose-500 font-semibold" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'text-zinc-600 border-zinc-200 bg-zinc-100',
  success: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  warning: 'text-amber-700 border-amber-200 bg-amber-50',
  danger: 'text-rose-700 border-rose-200 bg-rose-50',
};

export function Badge({
  children,
  variant = 'neutral',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-sm border font-mono text-xs uppercase tracking-wider',
        BADGE_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({
  id,
  checked,
  onChange,
  label,
  disabled,
}: SwitchProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-center gap-2.5 text-xs font-medium text-zinc-700 cursor-pointer select-none',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
          checked
            ? 'bg-emerald-600 border-emerald-600'
            : 'bg-zinc-200 border-zinc-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full transition-transform duration-150',
            checked
              ? 'translate-x-4 bg-white'
              : 'translate-x-0.5 bg-white shadow-2xs',
          )}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}

export interface FilterDropdownProps {
  ariaLabel: string;
  prefix: string;
  menuHeading?: string;
  value: string;
  options: FilterDropdownOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  isActive?: boolean;
  align?: 'left' | 'right';
}

export function FilterDropdown({
  ariaLabel,
  prefix,
  menuHeading,
  value,
  options,
  onChange,
  icon,
  isActive = false,
  align = 'left',
}: FilterDropdownProps) {
  const selectedOption =
    options.find((opt) => opt.value === value) ?? options[0];

  const {
    isOpen,
    position,
    containerRef,
    triggerRef,
    menuRef,
    toggleOpen,
    closeAndFocusTrigger,
    handleTriggerKeyDown,
    handleOptionKeyDown,
  } = useDropdownPopover({
    align,
    fixedMenuWidth: 256,
  });

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'inline-flex items-center h-9 rounded-md border px-2.5 gap-1.5 text-xs transition-colors duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25',
          isActive
            ? 'border-emerald-300 bg-emerald-50/50 text-emerald-950 hover:bg-emerald-50'
            : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300',
          isOpen && 'border-emerald-400 ring-2 ring-emerald-500/20',
        )}
      >
        {icon && (
          <span
            className={cn(
              'shrink-0',
              isActive ? 'text-emerald-600' : 'text-zinc-400',
            )}
          >
            {icon}
          </span>
        )}
        <span className="text-zinc-500 whitespace-nowrap">{prefix}:</span>
        <span className="font-medium text-zinc-900 truncate max-w-40">
          {selectedOption?.label ?? value}
        </span>
        {selectedOption?.meta && (
          <span className="font-mono text-[11px] text-zinc-400">
            ({selectedOption.meta})
          </span>
        )}
        <DropdownChevron isOpen={isOpen} />
      </button>

      <DropdownListboxPortal
        isOpen={isOpen}
        position={position}
        menuRef={menuRef}
        ariaLabel={ariaLabel}
        menuHeading={menuHeading}
        value={value}
        options={options}
        onSelect={(nextValue) => {
          onChange(nextValue);
          closeAndFocusTrigger();
        }}
        onOptionKeyDown={handleOptionKeyDown}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-zinc-200/80', className)}
    />
  );
}
