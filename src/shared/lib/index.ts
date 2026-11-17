/**
 * Pure utility functions for class names and unique ID generation.
 * Zero domain, field, or feature imports.
 */

export { ApiError, apiRequest } from './http';
export {
  WORKSPACE_MODES,
  buildWorkspacePath,
  isFormScopedMode,
  parseAppRoute,
  type AppRoute,
  type WorkspaceMode,
} from './router';
export {
  EMAIL_PATTERN,
  USERNAME_PATTERN,
  ensureUniqueUsername,
  toSnakeCaseUsername,
} from './username';

export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(' ');
}

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const THEME_MODES = ['light', 'dark', 'system'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeOptionItem {
  value: ThemeMode;
  label: string;
  description: string;
  meta: string;
}

export const THEME_OPTIONS: ThemeOptionItem[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Crisp light surfaces',
    meta: 'LIGHT',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low-glare zinc dark mode',
    meta: 'DARK',
  },
  {
    value: 'system',
    label: 'System',
    description: 'Match OS appearance',
    meta: 'AUTO',
  },
];

const THEME_STORAGE_KEY = 'form_builder_theme_v1';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function loadThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

export function persistThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures (e.g. private browsing or quota errors)
  }
}

export function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const isDark = resolved === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body?.classList.toggle('dark', isDark);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}
