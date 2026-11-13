# Business Rules Index

When working on tasks touching specific functional areas, consult the corresponding rule file:

- **Authentication, Sessions & RBAC:** Read `.gemini/rules/auth.md`
- **Tenant Management & Client Workspace:** Read `.gemini/rules/tenant-workspace.md`
- **Forms Lifecycle & Management:** Read `.gemini/rules/forms-manager.md`
- **Builder Canvas & Drag-and-Drop:** Read `.gemini/rules/builder-canvas.md`
- **Property Inspector & Field Configuration:** Read `.gemini/rules/property-inspector.md`
- **Field Palette & Component Discovery:** Read `.gemini/rules/field-palette.md`
- **Form Renderer & Runtime Execution:** Read `.gemini/rules/form-renderer.md`
- **Public Form Runner & Domain Routing:** Read `.gemini/rules/public-runner.md`
- **Submissions Ledger & Audit Trail:** Read `.gemini/rules/submissions-ledger.md`
- **Integrations Hub & Store-and-Forward Queue:** Read `.gemini/rules/integrations-hub.md`
- **Schema I/O & AST Serialization:** Read `.gemini/rules/schema-io.md`

### Global Invariants
- **Multi-Tenant Scoping**: Every FormSchema, SubmissionRecord, and Cloudflare D1 query must include and filter by `clientId`. Cross-client leakage is strictly prohibited.
- **Pure Domain AST**: The `FormSchema` AST must remain 100% JSON-serializable. Zero DOM, React, or browser imports allowed in `src/domain/`.
- **Open/Closed Principle**: Dynamic resolution via field registry (`src/fields/registry.ts`). Never write `switch (field.type)` or `if (field.type === ...)` branches inside feature components.
- **Separation of Concerns**: Editor state (`selectedFieldId`, active tabs, hover drop targets) must never be stored inside `FormSchema` or mixed with runtime `FormValues`.
- **Timestamps**: All timestamps (`createdAt`, `updatedAt`, `expiresAt`, `submittedAt`) must be stored and handled as UTC ISO-8601 strings.
- **Optimistic UI with Rollback**: All client-side mutations must optimistically update local state with immediate rollback to a captured snapshot if the network/D1 request fails.
- **Visual Design Standard**: Strict adherence to `DESIGN.md` (neutral `zinc` token palette, 1px hairline borders, compact 36px `h-9` controls, uppercase monospace metadata badges, zero banned gradients/blobs/bubbly radii).
- **Hardened Session Security**: Zero authentication tokens in `localStorage`/`sessionStorage`. Sessions must use high-entropy CSPRNG IDs stored in `HttpOnly; Secure; SameSite=Lax` cookies. Constant-time comparisons for verification.
