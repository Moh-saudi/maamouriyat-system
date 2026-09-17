# Phase 3C — Central Permission Engine

> Branch: `rebuild/v2-permission-engine`
>
> Status: server-side authorization foundation implemented. No UI filtering, business API enforcement, or resource scope filtering is enabled yet.

## 1. Purpose

Phase 3C introduces the canonical server-only authorization engine for V2.

The engine deliberately separates:

- verified authentication,
- role assignments,
- permission grants,
- user overrides,
- data-scope resolution.

It does not use `org_level` as a role or permission source.

## 2. Entry point

`getV2AccessState()` is the canonical V2 auth + authorization resolver.

Flow:

1. Verify identity through `getV2AuthState()`.
2. Reject unauthenticated/missing/inactive profiles.
3. Return `password_change_required` when the account is still under the forced-password gate.
4. Load RBAC data for the verified `profileId` only.
5. Evaluate effective permissions.
6. Fail closed as `authorization_unavailable` on RBAC storage/query errors.

No profile/user ID is accepted from a browser argument.

## 3. Current-user-only repository

`loadV2AuthorizationSnapshot(profileId)` uses the server-only Supabase Admin client after identity has already been verified.

It loads only:

- active and currently-valid role assignments for the current profile,
- active role definitions referenced by those assignments,
- grants belonging to those active roles,
- active user overrides for the current profile.

It does not scan every user's assignments.

## 3.1. Active permission registry enforcement

Grants and user overrides are evaluated only when their permission key still exists in `public.permissions` with `is_active = true`.

Inactive permission registry entries are ignored fail-closed, even if historical role grants or overrides still reference them.

## 4. Evaluation semantics

Multiple roles are combined as a union.

For each permission:

- every role grant contributes its explicit `scope_type`,
- a user `allow` override adds its explicit scope,
- a user `deny` override clears all grants/scopes and wins absolutely.

The result retains all granted scopes as a set/list rather than collapsing them to a single artificial rank.

This is intentional because `self`, `assigned`, `organization_tree`, `sector`, etc. are authorization domains, not a universally safe numeric ordering.

## 5. Scope boundary

Phase 3C answers:

> Does the user have this permission, and through which scope ceilings?

It does **not** yet answer:

> Does this concrete mission/facility/violation belong inside those scopes?

That resource membership filtering belongs to Phase 3D.

## 6. Password-change gate

A verified user with `mustChangePassword = true` does not receive an application authorization snapshot.

The access state becomes:

`password_change_required`

This is the server-side primitive that later V2 services and APIs will use to prevent forced-password bypass.

## 7. Database state entering Phase 3C

The production/development Supabase project has successfully applied the reviewed RBAC migration set and post-apply hardening.

Verified canonical state:

- 6 RBAC tables,
- 52 active permissions,
- 8 active system roles,
- 197 role-permission grants,
- 15 migrated user-role assignments,
- 0 active profiles without an active role,
- 0 scoped assignments without organization anchor,
- 0 invalid override scopes,
- RLS enabled on all 6 RBAC tables,
- 0 browser-facing RBAC policies,
- immutable access audit trigger present.

Current migrated assignment distribution:

- 1 `system_superadmin`
- 9 `sector_manager`
- 2 `directorate_manager`
- 2 `health_admin_manager`
- 1 `field_inspector`

## 8. Advisor hardening

Post-apply Supabase advisors identified two issues in newly-created RBAC objects:

- mutable function `search_path` on RBAC helper functions,
- uncovered foreign keys.

These were resolved by `scripts/23-rbac-v2-post-apply-hardening.sql`.

The remaining advisor findings belong to legacy tables/functions and are not caused by the new RBAC model.

The `RLS enabled, no policy` information finding on RBAC tables is intentional: V2 RBAC tables remain default-deny to browser/authenticated clients and are consumed through verified Next.js server code only.

## 9. Not implemented yet

Phase 3C does not yet:

- filter navigation,
- modify AppShell,
- expose `/api/me/access`,
- protect business APIs,
- evaluate organization tree membership,
- evaluate mission assignment membership,
- replace V1 middleware,
- delete legacy role/page-permission code.

Those proceed after this engine passes build review.
