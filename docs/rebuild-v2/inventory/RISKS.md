# Maamouriyat System — Pre-Production Risk Matrix (Top 22)

> **Document Status**: Complete & Authoritative (Updated Phase 0.5)  
> **Phase**: Phase 0.5 — Normalize Documentation & Correct Inventory  
> **Date**: September 2026  
> **Target System**: Maamouriyat Monitoring & Inspection System (Egyptian Ministry of Health & Population)

---

## Risk Severity Classification

- **P0 (Critical / Blocker)**: Catastrophic data loss, total security bypass, unviable deployment architecture, Fail-Open authentication flaws, or regulatory compliance failure. Must be resolved before any production deployment.
- **P1 (High / Integrity)**: Security vulnerabilities, organizational scope leaks, maintainability bottlenecks, or analytical corruption. Must be resolved during Core Rebuild phases.
- **P2 (Medium / UX & Resilience)**: Performance degradation, edge-case offline sync failures, UI unresponsiveness, or operational inconvenience. To be addressed prior to final cutover.

---

## Risk Summary Matrix

| # | Rank | Category | Risk Title | Primary File / Location |
|:---:|:---:|:---|:---|:---|
| **01** | **P0** | Security / Auth | mission-targets defaults unresolved caller to privileged level (Fail Open) | `src/app/api/admin/mission-targets/route.ts` (L195, L391) |
| **02** | **P0** | Security / Auth | leadership-targets defaults failed auth to admin-like context (Fail Open) | `src/app/api/admin/leadership-targets/route.ts` (L53–60, L91) |
| **03** | **P0** | Security / RBAC | leadership-targets POST / DELETE mutate data without proper authorization | `src/app/api/admin/leadership-targets/route.ts` (L176, L213) |
| **04** | **P0** | Storage / Infra | Ephemeral Local JSON File Writes for Targets (`fs.writeFileSync`) | `api/admin/mission-targets`, `leadership-targets` |
| **05** | **P0** | Security / Auth | Unsafe Service-Role Key Fallback Pattern | `lib/supabase/client.ts`, `api/checklists/route.ts` |
| **06** | **P0** | Security / RBAC | Client-Side Role Spoofing via Browser Cookies | `src/app/system-ui.tsx` (L444) |
| **07** | **P0** | Data Integrity | Dual Organization Tables & Schema Drift | `organizations` vs `organizational_units` |
| **08** | **P0** | Data Integrity | Serialized Item IDs Packed into Freeform Text | `api/missions/results/route.ts` |
| **09** | **P0** | Security / Auth | Client-Only Password Reset Enforcement | `system-ui.tsx` (L428) & API endpoints |
| **10** | **P0** | Architecture | Direct Supabase Client Invocations from UI | `missions-portal.tsx`, `violations-portal.tsx` |
| **11** | **P1** | Scoping / RBAC | Sector Head Scope Leakage across Ministry Entities | `organizations.ts`, `users-management.tsx` |
| **12** | **P1** | Maintainability| 4,397-Line Monolithic `system-ui.tsx` Component | `src/app/system-ui.tsx` |
| **13** | **P1** | Reliability | 3,653-Line Monolithic Mission Execution Form | `missions/[id]/execute/mission-execution-form.tsx` |
| **14** | **P1** | Architecture | Rigid Hardcoded Level-to-Role Mapping Engine | `src/lib/roles.ts` (`orgLevelToRole`) |
| **15** | **P1** | API / Standards| Inconsistent API Response Contracts & Errors | `src/app/api/**/route.ts` |
| **16** | **P1** | Security / Files| Permissive File Upload Endpoint without MIME checks | `src/app/api/upload/route.ts` |
| **17** | **P1** | Data Integrity | Mutable Checklist Templates Corrupting History | `checklists`, `checklist_items` |
| **18** | **P2** | Performance | In-Memory Organization Cache Invalidation Race | `src/lib/organizations.ts` |
| **19** | **P2** | Reliability | Absence of Resilient IndexedDB Offline Storage | `system-ui.tsx` (LocalStorage fallback) |
| **20** | **P2** | Performance | Unbounded Database Queries on National Dashboards | `src/app/dashboard/page.tsx` |
| **21** | **P2** | UX / Scale | Client-Side Memory Exhaustion during Large CSV Export | `violations-portal.tsx`, `missions-portal.tsx` |
| **22** | **P2** | Usability / GPS| False Positive Geofencing Warnings in Basements | `mission-execution-form.tsx` (L930) |

---

## Detailed Risk Assessments & Mitigation Plans

### Risk 01: mission-targets defaults unresolved caller to privileged level (Fail Open)
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `src/app/api/admin/mission-targets/route.ts` (Lines 195 & 391)
- **Description**: 
  In the `GET` handler, the route initializes caller hierarchy variables with privileged defaults:
  ```typescript
  // Line 195:
  let callerLevel = 1 // Defaults to Ministry Level!
  ```
  And in the catch block:
  ```typescript
  // Line 391:
  return NextResponse.json({
    targets: readTargets(),
    callerLevel: 1,
    ...
  }, { status: 200 })
  ```
  If user session resolution fails or throws an unhandled error, the API returns data and scopes the user as `callerLevel = 1` (Ministry Superadmin). This is a textbook **Fail Open** vulnerability.
- **Blast Radius**: Unauthenticated or low-privilege field users can access national targets and ministry-level analytical summaries simply by triggering a session error or hitting the endpoint without session cookies.
- **V2 Mitigation**: Implement strict **Fail Closed** behavior across all V2 Route Handlers:
  - If user identity cannot be unequivocally verified via Supabase Auth JWT, immediately abort and return `401 Unauthorized`.
  - If profile or role resolution fails, abort with `403 Forbidden`.
  - Never default `callerLevel` to `1` or assume admin privileges.

---

### Risk 02: leadership-targets defaults failed auth to admin-like context (Fail Open)
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `src/app/api/admin/leadership-targets/route.ts` (Lines 53–60 & 91)
- **Description**: 
  The `GET` handler initializes the current user context as follows:
  ```typescript
  let currentUser = {
    level: 1,
    id: '',
    email: '',
    governorate: '',
    isSectorHeadOrAbove: true
  }
  // Line 91:
  } catch (e) {
    console.warn('Could not resolve user auth in leadership-targets, defaulting to admin:', e)
  }
  ```
  When authentication resolution fails, it explicitly logs `"defaulting to admin"` and proceeds to treat the request as a Sector Head or Ministry Admin (`isSectorHeadOrAbove: true`), returning all targets nationwide.
- **Blast Radius**: Bypasses all geographic and sectoral boundaries. Field-level or unauthorized callers are granted sector-head visibility over ministry leadership inspection plans.
- **V2 Mitigation**: Fail Closed. Every leadership target query must require a cryptographically validated JWT session. If resolution fails, return `401 Unauthorized`. Do not provide fallback dummy admin contexts.

---

### Risk 03: leadership-targets POST / DELETE mutate data without proper server-side authorization
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `src/app/api/admin/leadership-targets/route.ts` (Lines 176–229)
- **Description**: 
  The `POST` and `DELETE` route handlers in `leadership-targets` perform direct data mutations without ANY authentication or authorization checks:
  - Line 176 (`POST`): Reads JSON body and immediately prepends to stored targets array without checking who the caller is.
  - Line 213 (`DELETE`): Reads `?id=` query parameter and immediately removes the target from storage.
- **Blast Radius**: Any unauthenticated client or external entity capable of reaching `/api/admin/leadership-targets` can inject fictitious leadership targets or wipe out valid ministerial inspection plans with a single HTTP request.
- **V2 Mitigation**: In V2, all mutating operations (`POST`, `PUT`, `DELETE`, Server Actions) must enforce a mandatory three-tier gate:
  1. **Authentication Gate**: Valid server session via `supabase.auth.getUser()`.
  2. **Permission Check**: Dynamic RBAC check (`hasPermission('targets:manage')`).
  3. **Scope Check**: Validate that the target being mutated falls strictly within the caller's organizational authority (e.g., Sector Head only creating targets for their subordinate Directorates).

---

### Risk 04: Ephemeral Local JSON File Writes for Targets (`fs.writeFileSync`)
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `src/app/api/admin/mission-targets/route.ts` & `leadership-targets/route.ts`
- **Description**: Route handlers use Node.js `fs.writeFileSync` to write target data directly to local disk paths (`src/data/mission-targets.json` and `src/data/leadership-targets.json`).
- **Blast Radius**: In serverless platforms (Vercel, AWS Lambda) or ephemeral container deployments (Docker, Kubernetes), local disk writes are wiped out on container recycling or pod restarts. Data saved by ministry leadership vanishes unpredictably.
- **Status in Database**:
  - `leadership_targets` **already exists** as a table definition in `scripts/14-leadership-targets.sql`! The legacy API simply ignored it and wrote to JSON.
  - `mission_targets` does **not yet exist** as a database table.
- **V2 Mitigation**:
  - Review and unify the existing `leadership_targets` database schema, stopping all JSON writes.
  - Design a formal `mission_targets` PostgreSQL schema in Phase 3.
  - Route all CRUD operations through transactional PostgreSQL operations.

---

### Risk 05: Unsafe Service-Role Key Fallback Pattern
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `src/app/api/admin/checklists/route.ts`, `src/app/api/upload/route.ts`, `src/lib/supabase/client.ts`
- **Description**: Code frequently contains `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Blast Radius**: If the service role key environment variable is misconfigured or missing in staging/production, the code silently falls back to the anonymous key without failing fast. Administrative write operations fail silently under RLS or succeed insecurely if RLS is absent.
- **V2 Mitigation**: Strictly separate client and server factory instances. Require `SUPABASE_SERVICE_ROLE_KEY` in server-only repositories and fail loudly at boot if missing. Never expose or fallback service role keys to client code.

---

### Risk 06: Client-Side Role Spoofing via Browser Cookies
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `src/app/system-ui.tsx` (Line 444: `document.cookie = "maamouriyat_user_role=..."`)
- **Description**: The active role of the logged-in user is written into an unauthenticated client-accessible cookie (`maamouriyat_user_role`) from the browser.
- **Blast Radius**: Any user can open Chrome DevTools, modify `document.cookie = "maamouriyat_user_role=superadmin"`, and unlock restricted UI elements and navigation routes.
- **V2 Mitigation**: Comply with **Master Plan Rule 33**: Never use cookies or localStorage as the central permission source. Authorize every route and action on the server via verified Supabase Auth JWT tokens and database-backed dynamic RBAC roles.

---

### Risk 07: Dual Organization Tables & Schema Drift
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: Database schema (`organizations` vs `organizational_units`, dual foreign keys in `users` and `missions`)
- **Description**: The database has two parallel organizational hierarchies: the legacy 5-tier `organizational_units` (from migration 01) and the active 7-tier `organizations` (from migration 09/10). Tables contain both `organization_id` and `org_unit_id`.
- **Blast Radius**: Discrepancies between legacy foreign keys lead to orphaned records, join failures in analytical reports, and conflicting permissions across modules.
- **V2 Mitigation**: Standardize on `organizations` (7 levels). Classify legacy fields for safe data migration, drop `org_unit_id` columns, and deprecate `organizational_units`.

---

### Risk 08: Serialized Item IDs Packed into Freeform Text
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `src/app/api/missions/results/route.ts` (Lines 60–80)
- **Description**: The results submission endpoint encodes checklist item identifiers as string prefixes inside the freeform `notes` column: `__item_id__:<uuid>` or `__static_id__:<id>`.
- **Blast Radius**: Renders relational integrity, SQL joins, foreign key cascade operations, and database-level aggregate metrics impossible. If an inspector includes specific special characters in their notes, parsing breaks.
- **V2 Mitigation**: Normalize the `mission_results` table to include a dedicated foreign key `checklist_item_id UUID REFERENCES checklist_items(id)` with a clean index.

---

### Risk 09: Client-Only Password Reset Enforcement
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `src/app/system-ui.tsx` (Line 428) & API route handlers
- **Description**: When `user.user_metadata.must_change_password === true`, a React state flag `setMustChangePassword(true)` displays an overlay modal. However, Next.js API route handlers do not check this flag before executing requests.
- **Blast Radius**: A malicious or non-compliant user can bypass the modal via browser DevTools or direct curl/Postman API calls, operating permanently with default temporary passwords.
- **V2 Mitigation**: Enforce `must_change_password` verification in Next.js Server Middleware and the API repository gateway, returning `403 Forbidden` on all operational endpoints until the password is changed.

---

### Risk 10: Direct Supabase Client Invocations from UI
- **Rank**: **P0 (Critical / Blocker)**
- **Location**: `missions-portal.tsx`, `violations-portal.tsx`, `mission-execution-form.tsx`
- **Description**: Frontend client components directly initialize Supabase browser clients and execute arbitrary `supabase.from('...').insert(...)` and `.update(...)` operations.
- **Blast Radius**: Bypasses server-side validation, exposes database table structures to client manipulation, and violates **Master Plan Rule 9** ("UI must not call Supabase directly; use services/repositories/adapters").
- **V2 Mitigation**: Encapsulate all database mutations inside typed Server Actions and backend service classes. The frontend UI communicates exclusively with these abstractions.

---

### Risk 11: Sector Head Scope Leakage across Ministry Entities
- **Rank**: **P1 (High / Integrity)**
- **Location**: `src/lib/organizations.ts` & `src/app/dashboard/users/users-management.tsx`
- **Description**: In user creation and organizational dropdowns, selecting top-level entities (ديوان الوزارة) allows Level 2 (Sector) administrators to view and assign entities that do not belong to their specific sector branch.
- **Blast Radius**: Violates multi-tenant organizational boundaries. A sector chief could inadvertently reassign or access records belonging to a different medical sector.
- **V2 Mitigation**: Enforce hierarchical PostgreSQL Recursive CTE queries on the server that filter child organizations strictly based on `sector_id` and the user's root scope.

---

### Risk 12: 4,397-Line Monolithic `system-ui.tsx` Component
- **Rank**: **P1 (High / Maintainability)**
- **Location**: `src/app/system-ui.tsx`
- **Description**: A massive single file bundling layouts, sidebars, navigation tabs, user state, password modals, notification drawers, and cookie sync logic.
- **Blast Radius**: Extreme maintenance bottleneck. High re-render overhead degrades browser performance.
- **V2 Mitigation**: Enforce **Master Plan Rule 31**: Zero lines of `system-ui.tsx` copied into V2. Rebuild cleanly using HeroUI v3 modular components and atomic React layout primitives.

---

### Risk 13: 3,653-Line Monolithic Mission Execution Form
- **Rank**: **P1 (High / Reliability)**
- **Location**: `src/app/dashboard/missions/[id]/execute/mission-execution-form.tsx`
- **Description**: Monolithic client form holding GPS polling, unregistered facility creation, image compression, section expanders, auto-violation prompts, and submission validation.
- **Blast Radius**: High memory consumption causes browser tab crashes on mid-range Android mobile devices used by field inspectors, resulting in lost inspection reports midway through field visits.
- **V2 Mitigation**: Re-architect as a step-by-step wizard (`WizardShell`, `StepLocation`, `StepChecklist`, `StepViolations`, `StepSignoff`) powered by React Hook Form, state persistence, and modular components.

---

### Risk 14: Rigid Hardcoded Level-to-Role Mapping Engine
- **Rank**: **P1 (High / Architecture)**
- **Location**: `src/lib/roles.ts` (`orgLevelToRole`, `roleDefinitions`)
- **Description**: Authorization relies on static integer comparisons (`level <= 2`, `level === 5`) and hardcoded role keys (`superadmin`, `sector`, `creator`).
- **Blast Radius**: Cannot accommodate hybrid roles, administrative delegations, temporary audit teams, or ministry restructuring without code edits and deployments.
- **V2 Mitigation**: Separate Organizational Hierarchy (`level` / `org_level`) from Authorization Roles. Implement dynamic Database-driven RBAC as mandated by **Master Plan Rule 7**: tables `roles`, `permissions`, `user_roles`, and `role_permissions` evaluated via typed permission checks.

---

### Risk 15: Inconsistent API Response Contracts & Errors
- **Rank**: **P1 (High / API Standards)**
- **Location**: `src/app/api/**/route.ts`
- **Description**: Route handlers return inconsistent responses (raw data arrays, `{ success: true, count }`, or `{ error: err.message }` with varied HTTP status codes).
- **Blast Radius**: Frontend client code suffers from brittle error handling, unhandled rejections, and confusing error states.
- **V2 Mitigation**: Establish a strict TypeScript-enforced API envelope (`ApiResponse<T>`) across all V2 endpoints.

---

### Risk 16: Permissive File Upload Endpoint without MIME checks
- **Rank**: **P1 (High / Security)**
- **Location**: `src/app/api/upload/route.ts`
- **Description**: Accepts uploads with minimal client-provided content-type inspection and writes directly to Supabase Storage.
- **Blast Radius**: Potential vector for malicious file execution, storage exhaustion, or unauthenticated image overwrites if bucket policies are loose.
- **V2 Mitigation**: Implement magic-number binary inspection for image MIME types (JPEG/PNG/WEBP only), strict 5MB maximum file limits, and sanitized file key generation.

---

### Risk 17: Mutable Checklist Templates Corrupting History
- **Rank**: **P1 (High / Data Integrity)**
- **Location**: `checklists`, `checklist_items`, `mission-execution-form.tsx`
- **Description**: If an administrator edits an existing checklist item or section in `/dashboard/checklists`, historical completed missions referencing that item may display altered questions or incorrect compliance criteria.
- **Blast Radius**: Legal and audit liability if historical inspection records are modified retroactively.
- **V2 Mitigation**: Implement checklist versioning or snapshotting: when a mission is completed, store an immutable JSON snapshot of the checklist criteria and answers at the exact time of sign-off.

---

### Risk 18: In-Memory Organization Cache Invalidation Race
- **Rank**: **P2 (Medium / Performance)**
- **Location**: `src/lib/organizations.ts` (Lines 36–43)
- **Description**: A global `_cache` variable stores organization arrays for 5 minutes. If an organization is created or updated in another tab or user session, the cache remains stale.
- **Blast Radius**: Newly registered facilities or health administrations do not appear immediately in field inspector dropdowns.
- **V2 Mitigation**: Leverage Next.js Server Components with tag-based caching (`revalidateTag('organizations')`) or SWR/React Query cache invalidation triggers.

---

### Risk 19: Absence of Resilient IndexedDB Offline Storage
- **Rank**: **P2 (Medium / Reliability)**
- **Location**: `src/app/system-ui.tsx` & `mission-execution-form.tsx`
- **Description**: The current offline implementation relies on LocalStorage strings to hold draft mission data. LocalStorage is synchronous, limited to 5MB, and easily evicted by mobile operating systems under storage pressure.
- **Blast Radius**: Field inspectors in rural Egyptian clinics with weak connectivity risk losing large checklists with attached photographic evidence.
- **V2 Mitigation**: Implement an offline-first storage adapter using **IndexedDB** with background synchronization via Service Worker upon reconnection.

---

### Risk 20: Unbounded Database Queries on National Dashboards
- **Rank**: **P2 (Medium / Performance)**
- **Location**: `src/app/dashboard/page.tsx`
- **Description**: National dashboard queries fetch entire tables (`missions`, `facilities`, `violations`) into browser memory to calculate summary cards and charts.
- **Blast Radius**: As the system grows to tens of thousands of missions across Egypt's 27 governorates, page load times will degrade significantly.
- **V2 Mitigation**: Move aggregations into PostgreSQL SQL views and RPC functions (`COUNT(*)`, `AVG(compliance_rate)` grouped by governorate/sector) so the frontend receives only aggregated summary rows.

---

### Risk 21: Client-Side Memory Exhaustion during Large CSV Export
- **Rank**: **P2 (Medium / UX & Scale)**
- **Location**: `violations-portal.tsx` & `missions-portal.tsx`
- **Description**: CSV export compiles the entire active dataset into an in-memory string and creates a Blob in browser memory.
- **Blast Radius**: Exporting $> 10,000$ violation records freezes the browser tab or crashes low-memory devices.
- **V2 Mitigation**: For datasets exceeding 1,000 records, stream exports from a dedicated server route using HTTP chunked transfer encoding.

---

### Risk 22: False Positive Geofencing Warnings in Basements
- **Rank**: **P2 (Medium / Usability & GPS)**
- **Location**: `mission-execution-form.tsx` (Line 930)
- **Description**: GPS accuracy in dense urban areas or inside shielded hospital basements (radiology/operating wings) frequently degrades beyond 500 meters.
- **Blast Radius**: Field inspectors receive recurring location mismatch warnings, leading to frustration and potential distrust in the system's accuracy.
- **V2 Mitigation**: Allow the inspector to capture location at the facility gate prior to entry, display an accuracy radius indicator ($\pm X$ meters), and log the calculated confidence interval alongside coordinates.
