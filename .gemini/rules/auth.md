# Business Rules & Architecture: Authentication, Sessions & RBAC

This document defines the architectural boundaries, business invariants, security controls, and UX requirements for user authentication, session management, and role-based access control (RBAC) within `src/features/auth/` and associated Cloudflare Worker/D1 endpoints.

---

## 1. Feature Scope & Component Inventory

The authentication feature provides secure login, registration, tenant resolution, password management, and modal credential prompts across the Form Builder workspace:

```
src/features/auth/
├── AuthPage.tsx        # Full-page standalone authentication suite (login, signup, forgot password, reset)
├── LoginModal.tsx      # Modal dialog for inline re-authentication without losing workspace context
└── index.ts            # Public feature export barrel
```

### Boundary & Dependency Guardrails
- **Unidirectional Flow**: `src/features/auth/` may consume `src/domain/form-schema/` and `src/shared/`. It must **never** import other feature directories (`src/features/builder-canvas/`, `src/features/forms-manager/`, etc.).
- **Zero DOM / React in Domain**: Authentication entities, roles, and validation rules in `src/domain/` must remain pure TypeScript with zero UI dependencies.
- **Communication Upward**: Auth components communicate with the parent shell (`App.tsx`) strictly via props, typed user models (`AuthUser`), and state change callbacks (`onLogin`, `onLogout`).

---

## 2. Multi-Tenant User Scoping & RBAC Rules

The system implements a hardened multi-tenant architecture supporting two distinct roles:

| Role | Scope & Permissions | Tenant Constraint |
| :--- | :--- | :--- |
| `agency_admin` | Global platform administrator. Can create, edit, switch between, and manage all client workspaces and forms. | `client_id` is `NULL` (or globally privileged). Can access any tenant. |
| `client_editor` | Tenant-scoped collaborator. Restricted strictly to managing forms and submissions within their designated client workspace. | `client_id` **MUST** reference a valid `clients(id)`. Access to other tenants is rejected. |

### Invariants & Query Rules
1. **Mandatory Client Filtering**: All D1 database queries querying user accounts, credentials, or sessions for tenant operations must explicitly enforce `WHERE client_id = ?` to prevent cross-tenant credential exposure.
2. **Tenant Resolution on Sign-Up**: During self-registration, users are assigned to an existing client tenant by domain/slug resolution or assigned to a freshly provisioned tenant. The role defaults strictly to `client_editor` unless elevated by an authenticated `agency_admin`.
3. **Session Tenant Locking**: When a `client_editor` authenticates, their active session is permanently locked to their `client_id`. Any API attempt by a `client_editor` to request data from another `client_id` must return `HTTP 403 Forbidden`.

---

## 3. Session Architecture & Cookie Guardrails

To eliminate client-side token exfiltration and Cross-Site Scripting (XSS) vectors, the application enforces a strict zero-storage policy:

### 1. Zero LocalStorage Policy
- **PROHIBITED**: Never persist JWTs, session tokens, passwords, or API keys in browser `localStorage`, `sessionStorage`, or indexed DB.
- **ENFORCEMENT**: All authentication state must be held in-memory within React state during the active browsing session and validated against the backend via `HttpOnly` cookies.

### 2. Cryptographically Secure Session IDs (CSPRNG)
- Session identifiers must be generated using high-entropy Cryptographically Secure Pseudo-Random Number Generators (CSPRNG):
  ```typescript
  const sessionId = crypto.randomUUID(); // or crypto.getRandomValues(new Uint8Array(32))
  ```
- Store session records in D1 with explicit timestamps: `id`, `user_id`, `client_id`, `created_at`, and `expires_at`.

### 3. Hardened Cookie Attributes
- All session cookies issued via `Set-Cookie` must enforce the following security attributes:
  ```http
  Set-Cookie: session_id=<csprng_id>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800
  ```
- `HttpOnly`: Prevents JavaScript execution context from reading or tampering with the cookie.
- `Secure`: Ensures cookies are transmitted exclusively over TLS (HTTPS).
- `SameSite=Lax`: Defends against Cross-Site Request Forgery (CSRF) on cross-site subrequests while preserving top-level navigation state.

---

## 4. User Enumeration Prevention & Side-Channel Mitigation

Authentication endpoints must never leak whether an email address or username exists within the database.

### 1. Uniform Login Failure Responses
- Invalid credentials, non-existent emails, disabled accounts, and password mismatches must all return an identical, generic error message and HTTP status:
  ```json
  { "error": "Invalid email or password" }
  ```
- HTTP status code must consistently be `401 Unauthorized`.

### 2. Uniform Forgot Password Responses
- Requesting a password reset for an email address must always return `200 OK` with an identical response body regardless of whether the email was found in the database:
  ```json
  { "message": "If an account matching that email exists, password reset instructions have been sent." }
  ```

### 3. Constant-Time Comparisons
- Verification of token hashes, passwords, and message authentication codes must use constant-time comparison algorithms (e.g., `crypto.subtle.timingSafeEqual` or bitwise XOR accumulation) to prevent timing side-channel attacks that measure string comparison latency.

---

## 5. Password Reset Token Lifecycle

Password reset workflows must adhere to a strict time-to-live and single-use policy:

1. **CSPRNG Generation**: Reset tokens must be generated using 32 bytes of CSPRNG entropy (`crypto.getRandomValues(new Uint8Array(32))`) encoded as a hexadecimal or base64url string.
2. **Cryptographic Hash-at-Rest**: Plaintext reset tokens must **never** be persisted in D1 or logged. Only the SHA-256 cryptographic hash of the token is stored:
   ```typescript
   const tokenHash = await crypto.subtle.digest('SHA-256', encoder.encode(token));
   ```
3. **Strict 15-Minute Expiration (TTL)**: Reset tokens have a maximum validity of 900 seconds (15 minutes). Tokens checked after `expires_at` are rejected as invalid/expired.
4. **Single-Use Invalidation**: Upon successful password reset, the token must be immediately deleted or invalidated in the database. Initiating a new reset request immediately invalidates any previously issued active token for that user.
5. **Global Session Revocation**: Any successful password reset or password update must immediately revoke and delete all active sessions across all devices for that user account in D1.

---

## 6. Form UX, Accessibility & Password Manager Autocomplete

Authentication interfaces must provide enterprise-grade ergonomics, accessibility compliance (WCAG 2.1 AA), and seamless password manager integration:

### 1. Explicit HTML Autocomplete Attributes
All input fields across `AuthPage.tsx` and `LoginModal.tsx` must declare standard `autoComplete` attributes:

| Authentication Flow | Field | Required `autoComplete` Attribute |
| :--- | :--- | :--- |
| **Login** | Email / Identifier | `autoComplete="username"` (or `"email"`) |
| **Login** | Password | `autoComplete="current-password"` |
| **Registration** | Email / Identifier | `autoComplete="username"` (or `"email"`) |
| **Registration** | New Password | `autoComplete="new-password"` |
| **Forgot Password** | Email | `autoComplete="email"` |
| **Reset Password** | New Password | `autoComplete="new-password"` |
| **MFA / OTP** | Verification Code | `autoComplete="one-time-code"` |

### 2. Accessible Validation & Error States
- Inputs with active validation errors must have `aria-invalid="true"`.
- Error text elements must have a unique `id` linked via `aria-describedby` on the corresponding input:
  ```tsx
  <Input
    id="auth-email"
    type="email"
    autoComplete="username"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? 'auth-email-error' : undefined}
  />
  {errors.email && (
    <p id="auth-email-error" role="alert" className="text-xs text-red-500 font-mono">
      {errors.email}
    </p>
  )}
  ```

### 3. Password Visibility Toggles
- Password inputs must feature an accessible reveal button (`type="button"`).
- The button must toggle between `type="password"` and `type="text"`.
- The button must maintain dynamic, screen-reader accessible `aria-label` triggers (e.g., `aria-label={showPassword ? "Hide password" : "Show password"}`).

### 4. Design Standards Compliance (DESIGN.md)
- **Palette**: Strictly neutral `zinc` tokens (`bg-zinc-950`, `text-zinc-100`, `border-zinc-800` in dark; `bg-white`, `text-zinc-950`, `border-zinc-200` in light).
- **Geometry**: Compact 36px control height (`h-9`), maximum 8px corner radius (`rounded-lg`), 1px hairline borders (`border border-zinc-200 dark:border-zinc-800`).
- **Typography**: Monospace badges (`font-mono text-xs uppercase tracking-wider`) for technical labels and role pills.
- **Zero AI Slop**: Zero purple/violet gradients, zero pastel blob cards, and zero bubbly `rounded-2xl` containers.
