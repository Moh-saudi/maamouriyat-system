# Phase 3B.1 — RBAC Database Preflight, Apply Order, and Verification

> **Branch:** `rebuild/v2-rbac-preflight`  
> **Purpose:** move from reviewed SQL design to a controlled database application.  
> **Rule:** no RBAC migration is applied until the read-only preflight result is reviewed.

## 1. Current approved artifacts

The reviewed RBAC migration set is:

1. `scripts/17-dynamic-rbac-v2-schema.sql`
2. `scripts/18-rbac-v2-permission-registry.sql`
3. `scripts/19-rbac-v2-system-roles.sql`
4. `scripts/20-rbac-v2-legacy-migration.sql`

External GitHub review also added:

- strict `updated_at` schema correction,
- fail-closed handling for legacy `allowed_pages = NULL`,
- page restriction migration across all related module actions rather than `*.view` only,
- seed-completeness preflight before user migration.

No SQL has been applied to Supabase yet.

## 2. Step A — Read-only real-database preflight

Run:

`scripts/21-rbac-v2-preflight-readonly.sql`

This script runs inside a read-only transaction and finishes with `ROLLBACK`.

### Hard blockers

Do **not** run scripts 17–20 if any of the following is true:

- a required legacy table is missing,
- any V2 RBAC target table already exists,
- an active scoped user (effective level 2–7) has no `organization_id`,
- an effective hierarchy level is outside 0–7,
- a populated `users.organization_id` cannot resolve to `organizations.id`,
- duplicate non-null `auth_id` values exist,
- any legacy `user_permissions.allowed_pages` value is `NULL`.

### Mandatory review items

These do not automatically block, but require an explicit decision before migration:

- profiles where both `org_level` and `level` are null,
- rows where `org_level` and `level` conflict,
- profiles with no `auth_id`,
- empty `allowed_pages = '{}'`,
- unknown legacy page keys.

## 3. Step B — Apply migrations in one controlled maintenance window

Only after Step A is accepted, run **in this exact order**:

1. Script 17 — core normalized schema.
2. Script 18 — 52 canonical permissions.
3. Script 19 — 8 canonical system roles and 197 reviewed grants.
4. Script 20 — one-time legacy assignments and DENY overrides.

Do not reorder them.

Do not run Script 20 alone.

Script 20 contains its own fail-fast checks for seed completeness and legacy data integrity.

## 4. Step C — Read-only post-apply verification

Immediately after successful application run:

`scripts/22-rbac-v2-post-apply-verification.sql`

Expected canonical seed counts:

- **52** permissions,
- **8** system roles,
- **197** role-permission grants.

All six RBAC tables must have RLS enabled and must have no browser-facing policies at this stage.

All active profiles must resolve to at least one active role assignment after migration.

Scoped assignments must have a trustworthy organization anchor through either the assignment or the user profile.

## 5. Rollback philosophy

Before Phase 3C, V1 remains the active authorization model.

Therefore database application does **not** immediately switch user traffic to V2 RBAC.

If migration application fails:

- the transaction of the failing numbered script should roll back,
- do not manually patch half-applied rows,
- capture the exact SQL error,
- fix the reviewed migration file,
- re-run only after confirming the database state.

Do not drop legacy authorization tables.

## 6. What Phase 3B.1 does not do

It does not:

- filter V2 navigation by permissions,
- protect business APIs with RBAC,
- implement `hasPermission`,
- implement scope filtering,
- remove `src/lib/roles.ts`,
- remove legacy `user_permissions`,
- change the V1 middleware authorization behavior.

Those belong to Phase 3C/3D and later cutover stages.

## 7. Required evidence before Phase 3C

Keep the result sets from Script 21 and Script 22.

Phase 3C begins only after the reviewer has confirmed:

- preflight blockers are zero/resolved,
- scripts 17–20 completed in order,
- canonical counts match,
- RLS/default-deny posture is intact,
- role assignment integrity checks pass.
