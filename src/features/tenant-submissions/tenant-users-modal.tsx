import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { ClientTenant } from '../../domain/form-schema';
import { EMAIL_PATTERN, cn } from '../../shared/lib';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  Tooltip,
  type DropdownOption,
} from '../../shared/ui';
import type {
  ManagedTenantUser,
  ResetUserCredentialsResponse,
} from './storage';
import {
  validateEditTenantUserInput,
  validateNewTenantUserDrafts,
  type NewTenantUserDraft,
} from './tenant-utils';

export interface TenantUsersModalProps {
  tenant: ClientTenant;
  users: ManagedTenantUser[];
  onClose: () => void;
  onCreateUser: (input: {
    clientId: string;
    username: string;
    displayName: string;
    password: string;
    role: 'tenant_admin' | 'tenant_member';
  }) => Promise<void>;
  onUpdateUser: (
    userId: string,
    input: {
      username?: string;
      displayName?: string;
      role?: 'tenant_admin' | 'tenant_member';
      isActive?: boolean;
      password?: string;
    },
  ) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onResetCredentials?: (
    userId: string,
    input: {
      password?: string;
      email?: string;
    },
  ) => Promise<ResetUserCredentialsResponse>;
}

type TenantRole = 'tenant_admin' | 'tenant_member';

interface MemberDraftRow extends NewTenantUserDraft {
  key: string;
  error: string | null;
}

const ROLE_OPTIONS: DropdownOption[] = [
  {
    value: 'tenant_admin',
    label: 'Tenant Admin',
    description: 'Full form builder & submission management for this tenant',
    meta: 'ADMIN',
  },
  {
    value: 'tenant_member',
    label: 'Tenant Member',
    description: 'Collaborator restricted to this tenant workspace',
    meta: 'MEMBER',
  },
];

const MAX_BATCH_SIZE = 10;

let draftKeyCounter = 0;
function createDraftRow(role: TenantRole = 'tenant_member'): MemberDraftRow {
  draftKeyCounter += 1;
  return {
    key: `draft-${draftKeyCounter}`,
    username: '',
    displayName: '',
    password: '',
    role,
    error: null,
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function SvgIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const PencilIcon = () => (
  <SvgIcon>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </SvgIcon>
);
const KeyIcon = () => (
  <SvgIcon>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.8-9.8" />
    <path d="m17 6 3 3" />
    <path d="m14.5 8.5 2 2" />
  </SvgIcon>
);
const BanIcon = () => (
  <SvgIcon>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </SvgIcon>
);
const CheckCircleIcon = () => (
  <SvgIcon>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </SvgIcon>
);
const TrashIcon = () => (
  <SvgIcon>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </SvgIcon>
);
const CloseIcon = () => (
  <SvgIcon>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </SvgIcon>
);
const PlusIcon = () => (
  <SvgIcon>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </SvgIcon>
);

function IconActionButton({
  label,
  tooltip,
  onClick,
  disabled,
  active,
  tone = 'neutral',
  children,
}: {
  label: string;
  /** Short visible tooltip text; defaults to `label`. */
  tooltip?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: 'neutral' | 'danger';
  children: ReactNode;
}) {
  return (
    <Tooltip content={tooltip ?? label}>
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
        'disabled:opacity-50 disabled:pointer-events-none',
        active
          ? 'border-zinc-300 bg-zinc-100 text-zinc-900'
          : 'border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900',
        tone === 'danger' &&
          !active &&
          'hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600',
      )}
    >
      {children}
    </button>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function TenantUsersModal({
  tenant,
  users,
  onClose,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onResetCredentials,
}: TenantUsersModalProps) {
  const [drafts, setDrafts] = useState<MemberDraftRow[]>(() => [
    createDraftRow(),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<TenantRole>('tenant_admin');
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordDraft, setResetPasswordDraft] = useState('');
  const [resetEmailDraft, setResetEmailDraft] = useState('');
  const [issuedCredentials, setIssuedCredentials] = useState<{
    username: string;
    generatedPassword?: string;
    email?: string;
    emailDelivery?: ResetUserCredentialsResponse['emailDelivery'];
  } | null>(null);
  const [copiedCredential, setCopiedCredential] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(
    null,
  );
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on open (so key events originate inside it,
  // not from the trigger button, whose table cell stops key propagation),
  // and restore focus to the trigger on close.
  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const tenantUsers = users.filter((u) => u.clientId === tenant.id);
  const activeCount = tenantUsers.filter((u) => u.isActive).length;

  /* ---------------- Bulk add ---------------- */

  const updateDraft = (key: string, patch: Partial<NewTenantUserDraft>) => {
    setAddedNotice(null);
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch, error: null } : d)),
    );
  };

  const addDraftRow = () => {
    setDrafts((prev) =>
      prev.length >= MAX_BATCH_SIZE
        ? prev
        : [...prev, createDraftRow(prev[prev.length - 1]?.role)],
    );
  };

  const removeDraftRow = (key: string) => {
    setDrafts((prev) =>
      prev.length <= 1 ? [createDraftRow()] : prev.filter((d) => d.key !== key),
    );
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setAddedNotice(null);

    const validationErrors = validateNewTenantUserDrafts(
      drafts,
      tenantUsers.map((u) => u.username),
    );
    if (validationErrors.some((e) => e !== null)) {
      setDrafts((prev) =>
        prev.map((d, i) => ({ ...d, error: validationErrors[i] ?? null })),
      );
      return;
    }

    setIsSubmitting(true);
    const failed: MemberDraftRow[] = [];
    let createdCount = 0;
    // Sequential to keep server-side uniqueness checks deterministic.
    for (const draft of drafts) {
      try {
        await onCreateUser({
          clientId: tenant.id,
          username: draft.username.trim(),
          displayName: draft.displayName.trim(),
          password: draft.password,
          role: draft.role,
        });
        createdCount += 1;
      } catch (err) {
        failed.push({
          ...draft,
          error:
            err instanceof Error ? err.message : 'Failed to create team member.',
        });
      }
    }
    setIsSubmitting(false);
    setDrafts(failed.length > 0 ? failed : [createDraftRow()]);
    if (createdCount > 0) {
      setAddedNotice(
        `Added ${createdCount} team member${createdCount === 1 ? '' : 's'}.`,
      );
    }
  };

  /* ---------------- Existing user actions ---------------- */

  const handleToggleActive = async (user: ManagedTenantUser) => {
    setBusyUserId(user.id);
    setError(null);
    try {
      await onUpdateUser(user.id, { isActive: !user.isActive });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setBusyUserId(null);
    }
  };

  const startEditingUser = (user: ManagedTenantUser) => {
    setError(null);
    setResetUserId(null);
    setConfirmDeleteUserId(null);
    if (editingUserId === user.id) {
      setEditingUserId(null);
      return;
    }
    setEditingUserId(user.id);
    setEditUsername(user.username);
    setEditDisplayName(user.displayName);
    setEditRole(user.role === 'tenant_member' ? 'tenant_member' : 'tenant_admin');
  };

  const toggleResetPanel = (user: ManagedTenantUser) => {
    setError(null);
    setEditingUserId(null);
    setConfirmDeleteUserId(null);
    setResetUserId(resetUserId === user.id ? null : user.id);
    setResetPasswordDraft('');
    setResetEmailDraft('');
  };

  const handleSaveUserEdit = async (userId: string) => {
    const validation = validateEditTenantUserInput({
      username: editUsername,
      displayName: editDisplayName,
      role: editRole,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setBusyUserId(userId);
    setError(null);
    try {
      await onUpdateUser(userId, validation.data);
      setEditingUserId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update user profile.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async (user: ManagedTenantUser) => {
    const trimmedEmail = resetEmailDraft.trim().toLowerCase();
    if (resetPasswordDraft !== '' && resetPasswordDraft.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (trimmedEmail !== '' && !EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!onResetCredentials && resetPasswordDraft.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setBusyUserId(user.id);
    setError(null);
    setCopiedCredential(false);
    try {
      if (onResetCredentials) {
        const result = await onResetCredentials(user.id, {
          ...(resetPasswordDraft ? { password: resetPasswordDraft } : {}),
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
        });
        setIssuedCredentials({
          username: result.user.username,
          generatedPassword: result.generatedPassword,
          email: trimmedEmail || undefined,
          emailDelivery: result.emailDelivery,
        });
      } else {
        await onUpdateUser(user.id, { password: resetPasswordDraft });
        setIssuedCredentials({
          username: user.username,
        });
      }
      setResetUserId(null);
      setResetPasswordDraft('');
      setResetEmailDraft('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset credentials.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCopyGeneratedPassword = async (value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedCredential(true);
    } catch {
      setError('Unable to copy password to clipboard.');
    }
  };

  const handleDelete = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    try {
      await onDeleteUser(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setBusyUserId(null);
    }
  };

  const submitLabel = isSubmitting
    ? 'Adding…'
    : drafts.length === 1
      ? 'Add member'
      : `Add ${drafts.length} members`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenant-users-modal-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[88vh] focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="tenant-users-modal-title"
              className="text-base font-semibold text-zinc-900"
            >
              Manage team
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 truncate">
              Control who can sign in to the{' '}
              <span className="font-medium text-zinc-700">{tenant.name}</span>{' '}
              workspace.
            </p>
          </div>
          <IconActionButton
            label="Close dialog"
            tooltip="Close (Esc)"
            onClick={onClose}
          >
            <CloseIcon />
          </IconActionButton>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              {error}
            </div>
          )}

          {issuedCredentials && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Credentials updated for @{issuedCredentials.username}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setIssuedCredentials(null)}
                >
                  Dismiss
                </Button>
              </div>
              {issuedCredentials.generatedPassword && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-200 bg-white px-2.5 py-1.5">
                  <div className="font-mono text-xs text-zinc-900">
                    <span className="text-zinc-500 mr-2">Password:</span>
                    <span>{issuedCredentials.generatedPassword}</span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() =>
                      void handleCopyGeneratedPassword(
                        issuedCredentials.generatedPassword!,
                      )
                    }
                  >
                    {copiedCredential ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
              {issuedCredentials.emailDelivery && (
                <p className="text-[11px] text-emerald-800">
                  {issuedCredentials.emailDelivery.status === 'sent'
                    ? `Emailed login credentials to ${issuedCredentials.email ?? 'recipient'} via ${issuedCredentials.emailDelivery.provider}.`
                    : `Logged login credentials for ${issuedCredentials.email ?? 'recipient'} to dev console.`}
                </p>
              )}
            </div>
          )}

          {/* Existing members */}
          <section className="space-y-2.5" aria-labelledby="team-members-heading">
            <div className="flex items-center justify-between">
              <h3
                id="team-members-heading"
                className="font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold"
              >
                Members
              </h3>
              <span className="font-mono text-[11px] text-zinc-500">
                {tenantUsers.length} total · {activeCount} active
              </span>
            </div>

            {tenantUsers.length === 0 ? (
              <div className="p-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 text-center text-xs text-zinc-500">
                No team members yet. Add your first member below.
              </div>
            ) : (
              <ul className="rounded-lg border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                {tenantUsers.map((user) => {
                  const isBusy = busyUserId === user.id;
                  const isConfirmingDelete = confirmDeleteUserId === user.id;
                  const isEditing = editingUserId === user.id;
                  const isResetting = resetUserId === user.id;
                  return (
                    <li key={user.id} className="bg-white">
                      <div className="flex items-center gap-3 px-3.5 py-3">
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold',
                            user.isActive
                              ? 'border-zinc-200 bg-zinc-100 text-zinc-700'
                              : 'border-zinc-200 bg-white text-zinc-400',
                          )}
                          aria-hidden="true"
                        >
                          {getInitials(user.displayName)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'truncate text-sm font-medium',
                                user.isActive ? 'text-zinc-900' : 'text-zinc-500',
                              )}
                            >
                              {user.displayName}
                            </span>
                            <Badge variant="neutral">
                              {user.role === 'tenant_admin' ? 'Admin' : 'Member'}
                            </Badge>
                            {!user.isActive && (
                              <Badge variant="danger">Disabled</Badge>
                            )}
                          </div>
                          <span className="block truncate font-mono text-xs text-zinc-500">
                            @{user.username}
                          </span>
                        </div>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-2">
                            <span className="hidden sm:inline text-xs text-zinc-600">
                              Remove this member?
                            </span>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteUserId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="danger"
                              disabled={isBusy}
                              onClick={() => {
                                setConfirmDeleteUserId(null);
                                void handleDelete(user.id);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5">
                            <IconActionButton
                              label={`Edit ${user.displayName}`}
                              tooltip={isEditing ? 'Close editor' : 'Edit profile'}
                              active={isEditing}
                              disabled={isBusy}
                              onClick={() => startEditingUser(user)}
                            >
                              <PencilIcon />
                            </IconActionButton>
                            <IconActionButton
                              label={`Reset credentials for ${user.displayName}`}
                              tooltip="Reset password"
                              active={isResetting}
                              disabled={isBusy}
                              onClick={() => toggleResetPanel(user)}
                            >
                              <KeyIcon />
                            </IconActionButton>
                            <IconActionButton
                              label={
                                user.isActive
                                  ? `Disable ${user.displayName}`
                                  : `Enable ${user.displayName}`
                              }
                              tooltip={
                                user.isActive
                                  ? 'Disable access'
                                  : 'Enable access'
                              }
                              disabled={isBusy}
                              onClick={() => void handleToggleActive(user)}
                            >
                              {user.isActive ? <BanIcon /> : <CheckCircleIcon />}
                            </IconActionButton>
                            <span
                              className="mx-1 h-5 w-px bg-zinc-200"
                              aria-hidden="true"
                            />
                            <IconActionButton
                              label={`Delete ${user.displayName}`}
                              tooltip="Remove member"
                              tone="danger"
                              disabled={isBusy}
                              onClick={() => {
                                setEditingUserId(null);
                                setResetUserId(null);
                                setConfirmDeleteUserId(user.id);
                              }}
                            >
                              <TrashIcon />
                            </IconActionButton>
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mx-3.5 mb-3 rounded-md border border-zinc-200 bg-zinc-50/70 p-3 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="space-y-1">
                              <Label htmlFor={`edit-user-username-${user.id}`}>
                                Username
                              </Label>
                              <Input
                                id={`edit-user-username-${user.id}`}
                                value={editUsername}
                                onChange={(e) => {
                                  setError(null);
                                  setEditUsername(e.target.value);
                                }}
                                disabled={isBusy}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-user-display-${user.id}`}>
                                Display Name
                              </Label>
                              <Input
                                id={`edit-user-display-${user.id}`}
                                value={editDisplayName}
                                onChange={(e) => {
                                  setError(null);
                                  setEditDisplayName(e.target.value);
                                }}
                                disabled={isBusy}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-user-role-${user.id}`}>
                                Role
                              </Label>
                              <Select
                                id={`edit-user-role-${user.id}`}
                                aria-label={`Role for ${user.username}`}
                                value={editRole}
                                options={ROLE_OPTIONS}
                                onValueChange={(next) => {
                                  setError(null);
                                  setEditRole(next as TenantRole);
                                }}
                                disabled={isBusy}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => setEditingUserId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="primary"
                              disabled={isBusy}
                              onClick={() => void handleSaveUserEdit(user.id)}
                            >
                              Save changes
                            </Button>
                          </div>
                        </div>
                      )}

                      {isResetting && (
                        <div className="mx-3.5 mb-3 rounded-md border border-zinc-200 bg-zinc-50/70 p-3 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label htmlFor={`reset-pw-${user.id}`}>
                                New Password{' '}
                                {onResetCredentials
                                  ? '(leave blank to auto-generate)'
                                  : '(min 8 chars)'}
                              </Label>
                              <Input
                                id={`reset-pw-${user.id}`}
                                type="password"
                                aria-label={`New password for ${user.username}`}
                                placeholder={
                                  onResetCredentials
                                    ? 'Blank = generate 16-char password'
                                    : 'New password (min 8 chars)'
                                }
                                value={resetPasswordDraft}
                                onChange={(e) => {
                                  setError(null);
                                  setResetPasswordDraft(e.target.value);
                                }}
                                disabled={isBusy}
                                className="h-8 text-xs"
                              />
                            </div>
                            {onResetCredentials && (
                              <div className="space-y-1">
                                <Label htmlFor={`reset-email-${user.id}`}>
                                  Email Credentials To (optional)
                                </Label>
                                <Input
                                  id={`reset-email-${user.id}`}
                                  type="email"
                                  aria-label={`Email credentials for ${user.username}`}
                                  placeholder="admin@company.com"
                                  value={resetEmailDraft}
                                  onChange={(e) => {
                                    setError(null);
                                    setResetEmailDraft(e.target.value);
                                  }}
                                  disabled={isBusy}
                                  className="h-8 text-xs"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => {
                                setResetUserId(null);
                                setResetPasswordDraft('');
                                setResetEmailDraft('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="primary"
                              disabled={isBusy}
                              onClick={() => void handleResetPassword(user)}
                            >
                              {resetPasswordDraft
                                ? 'Save password'
                                : 'Generate & reset'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Add members (batch) */}
          <form
            onSubmit={(e) => void handleCreateSubmit(e)}
            className="space-y-3"
            aria-labelledby="add-members-heading"
            noValidate
          >
            <div className="flex items-center justify-between">
              <h3
                id="add-members-heading"
                className="font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold"
              >
                Add members
              </h3>
              <span className="font-mono text-[11px] text-zinc-500">
                {drafts.length} / {MAX_BATCH_SIZE}
              </span>
            </div>

            {addedNotice && (
              <div
                role="status"
                className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900"
              >
                {addedNotice}
              </div>
            )}

            <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100">
              {drafts.map((draft, index) => {
                const n = index + 1;
                return (
                  <fieldset
                    key={draft.key}
                    className={cn(
                      'p-3.5 space-y-2.5',
                      draft.error && 'bg-rose-50/40',
                    )}
                    disabled={isSubmitting}
                  >
                    <div className="flex items-center justify-between">
                      <legend className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                        Member {n}
                      </legend>
                      <IconActionButton
                        label={`Remove member ${n} from list`}
                        tooltip="Remove from list"
                        tone="danger"
                        disabled={
                          isSubmitting ||
                          (drafts.length === 1 &&
                            !draft.username &&
                            !draft.displayName &&
                            !draft.password)
                        }
                        onClick={() => removeDraftRow(draft.key)}
                      >
                        <CloseIcon />
                      </IconActionButton>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label
                          htmlFor={`new-user-display-${draft.key}`}
                          requiredIndicator
                        >
                          Display name
                        </Label>
                        <Input
                          id={`new-user-display-${draft.key}`}
                          placeholder="e.g. Jane Doe"
                          value={draft.displayName}
                          onChange={(e) =>
                            updateDraft(draft.key, {
                              displayName: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor={`new-user-username-${draft.key}`}
                          requiredIndicator
                        >
                          Username
                        </Label>
                        <Input
                          id={`new-user-username-${draft.key}`}
                          placeholder="e.g. jane_doe"
                          className="font-mono"
                          autoComplete="off"
                          value={draft.username}
                          onChange={(e) =>
                            updateDraft(draft.key, { username: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor={`new-user-password-${draft.key}`}
                          requiredIndicator
                        >
                          Password
                        </Label>
                        <Input
                          id={`new-user-password-${draft.key}`}
                          type="password"
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                          value={draft.password}
                          onChange={(e) =>
                            updateDraft(draft.key, { password: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`new-user-role-${draft.key}`}>Role</Label>
                        <Select
                          id={`new-user-role-${draft.key}`}
                          aria-label={`Role for member ${n}`}
                          value={draft.role}
                          options={ROLE_OPTIONS}
                          onValueChange={(next) =>
                            updateDraft(draft.key, { role: next as TenantRole })
                          }
                        />
                      </div>
                    </div>

                    {draft.error && (
                      <p role="alert" className="text-xs text-rose-600">
                        {draft.error}
                      </p>
                    )}
                  </fieldset>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isSubmitting || drafts.length >= MAX_BATCH_SIZE}
                onClick={addDraftRow}
              >
                <PlusIcon />
                Add another
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={isSubmitting}
              >
                {submitLabel}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
