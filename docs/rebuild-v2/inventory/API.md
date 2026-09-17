# Inventory — API Routes & Endpoints (`inventory/API.md`)

> **Document Status**: Complete & Corrected (Phase 0.5)  
> **Phase**: Phase 0.5 — Normalize Documentation & Correct Inventory  
> **Date**: September 2026  
> **Target System**: Maamouriyat Monitoring & Inspection System (Egyptian Ministry of Health & Population)

---

## 1. Overview of Backend API Architecture

The application hosts 10 API route handlers located under `src/app/api/`. These endpoints handle administrative operations, user management, file uploads, mission results synchronization, and target tracking.

### Critical Vulnerabilities & Anti-Patterns:
1. **Fail-Open Security Defaults**:
   - `/api/admin/mission-targets` defaults unresolved callers to `callerLevel = 1` (Superadmin/Ministry Level).
   - `/api/admin/leadership-targets` defaults failed authentication to `level: 1, isSectorHeadOrAbove: true` ("defaulting to admin").
   - `/api/admin/leadership-targets` exposes `POST` and `DELETE` without ANY authentication or authorization verification.
2. **Ephemeral Local Filesystem Writes**:
   - `mission-targets` and `leadership-targets` read and write to local JSON files (`src/data/*.json`) via Node.js `fs.writeFileSync`, which causes immediate data loss in serverless or container deployments.
3. **Hardcoded Level-Based Authorization**:
   - Endpoints rely on brittle integer level checks (`callerLevel <= 4`, `level <= 2`, `level === 1`) rather than granular, dynamic permissions.
4. **Unsafe Service-Role Fallbacks**:
   - Endpoints fall back from `SUPABASE_SERVICE_ROLE_KEY` to anonymous or public keys, causing silent failures under RLS.

---

## 2. Comprehensive Catalog of All 10 API Routes

### 2.1 `/api/admin/mission-targets`
- **Location**: `src/app/api/admin/mission-targets/route.ts`
- **HTTP Methods**: `GET`, `POST`
- **Authentication Method**: 
  - `GET`: Attempts `createServerSupabaseClient()` session resolution. If session is absent, it proceeds anyway.
  - `POST`: Requires `createServerSupabaseClient()` session token via `serverClient.auth.getUser()`.
- **Authorization Method**: 
  - `GET`: Reads `org_level` / `level` from caller's `users` record.
  - `POST`: Hardcoded level check: `if (callerLevel > 6) return 403 Forbidden`.
- **Service Role Usage**: Yes (`getAdminClient()` with fallback to publishable/anon key).
- **Tables & Files Accessed**:
  - Files: Reads and writes `src/data/mission-targets.json` via Node.js `fs`.
  - Tables: `missions` (for dynamic count aggregation of executed missions), `facilities` (for specific facility target enrichment), `users` (caller profile and candidate lists), `organizations`.
- **Fail-Open Risks**:
  - **CRITICAL P0**: In `GET`, caller hierarchy variables are initialized with `let callerLevel = 1`. If user session resolution fails or errors out, the catch block returns `callerLevel: 1` with HTTP 200, effectively granting unauthenticated callers full Ministry Superadmin visibility.
- **Level-Based Checks**: `callerLevel = profile.org_level ?? profile.level ?? 7`; `callerLevel > 6` restricts creation.
- **Missing Permission Checks**: No fine-grained permission token checks (`targets:read`, `targets:create`, `targets:manage`).

---

### 2.2 `/api/admin/leadership-targets`
- **Location**: `src/app/api/admin/leadership-targets/route.ts`
- **HTTP Methods**: `GET`, `POST`, `DELETE`
- **Authentication Method**:
  - `GET`: Attempts session resolution via `createServerSupabaseClient()`.
  - `POST`: **NONE**. No session resolution or JWT validation.
  - `DELETE`: **NONE**. No session resolution or JWT validation.
- **Authorization Method**:
  - `GET`: Evaluates `isSectorHeadOrAbove: level <= 2`.
  - `POST`: **NONE**. Anyone can post target payloads.
  - `DELETE`: **NONE**. Anyone with a target ID can delete records.
- **Service Role Usage**: Yes (`getAdminClient()` with fallback).
- **Tables & Files Accessed**:
  - Files: Reads and writes `src/data/leadership-targets.json` via Node.js `fs`.
  - Tables: `users` (queries undersecretaries with level 5 and 6), `missions` (aggregates actual completions).
  - Database Schema Base: `public.leadership_targets` already exists in `scripts/14-leadership-targets.sql` but is ignored by this route.
- **Fail-Open Risks**:
  - **CRITICAL P0**: In `GET`, caller context defaults to `{ level: 1, isSectorHeadOrAbove: true }`. On auth failure, the catch block logs `"defaulting to admin"` and returns national targets.
  - **CRITICAL P0**: `POST` and `DELETE` mutate target data without any server-side authentication, permission, or organizational scope checks.
- **Level-Based Checks**: Hardcoded `level <= 2` for sector head access; `level IN (5, 6)` for candidate undersecretaries.
- **Missing Permission Checks**: Completely lacks `leadership_targets:create`, `leadership_targets:delete`, and scope boundary enforcement.

---

### 2.3 `/api/admin/checklists`
- **Location**: `src/app/api/admin/checklists/route.ts`
- **HTTP Methods**: `GET`, `POST`, `PUT`, `DELETE`
- **Authentication Method**: Next.js Server Client session cookie (`createServerSupabaseClient()`).
- **Authorization Method**: Hardcoded level checks:
  - `POST`: Level 1–2 (Ministry/Sector) can create base templates; Level 5 (Directorate) can create localized sections.
  - `PUT`, `DELETE`: Level 1–2 only.
- **Service Role Usage**: Yes (`SUPABASE_SERVICE_ROLE_KEY` with fallback).
- **Tables & Files Accessed**: `checklists`, `checklist_sections`, `checklist_items`, `organizations`, `users`.
- **Fail-Open Risks**: If session resolution fails in `GET`, route defaults to un-scoped sector fetching instead of failing closed with `401 Unauthorized`.
- **Level-Based Checks**: `profile.org_level ?? profile.level <= 2`.
- **Missing Permission Checks**: Lacks granular capability checks such as `checklists:edit`, `checklists:delete`.

---

### 2.4 `/api/admin/organizations`
- **Location**: `src/app/api/admin/organizations/route.ts`
- **HTTP Methods**: `GET`, `POST`, `PUT`, `DELETE`
- **Authentication Method**: Server session cookie (`createServerSupabaseClient()`).
- **Authorization Method**: Hardcoded level thresholds (`callerLevel <= 3` for mutations).
- **Service Role Usage**: Yes (`SUPABASE_SERVICE_ROLE_KEY` with fallback).
- **Tables & Files Accessed**: `organizations`, `users` (caller profile and dependency verification).
- **Fail-Open Risks**: `GET` returns full organizational hierarchy without multi-tenant sector boundaries, allowing callers to inspect other sectors.
- **Level-Based Checks**: `callerLevel <= 3` (Ministry, Sector, Central Admin allowed to mutate).
- **Missing Permission Checks**: Lacks explicit permissions (`organizations:create`, `organizations:update`, `organizations:delete`).

---

### 2.5 `/api/admin/create-user`
- **Location**: `src/app/api/admin/create-user/route.ts`
- **HTTP Methods**: `POST`
- **Authentication Method**: Server session cookie (`createServerSupabaseClient()`).
- **Authorization Method**: Hardcoded caller level comparison (`callerLevel <= 4` and `userLevel >= callerLevel`).
- **Service Role Usage**: Yes (`SUPABASE_SERVICE_ROLE_KEY`).
- **Tables & Files Accessed**: `auth.users` (admin user provisioning), `public.users` (profile insertion), `public.organizations` (organization validation).
- **Fail-Open Risks**: Low (returns 401 if unauthenticated), but caller level checks are strictly integer-based.
- **Level-Based Checks**:
  - `callerLevel <= 4` required to create users.
  - `userLevel >= callerLevel` prevents privilege escalation (cannot create user above self).
  - Sector scoping: Callers at levels 2–4 cannot create users outside their `sector_id`.
- **Missing Permission Checks**: No dynamic permission check (`users:create`); relies purely on integer level arithmetic.

---

### 2.6 `/api/admin/update-user`
- **Location**: `src/app/api/admin/update-user/route.ts`
- **HTTP Methods**: `POST`
- **Authentication Method**: Server session cookie (`createServerSupabaseClient()`).
- **Authorization Method**: Integer level comparison (`callerLevel <= 4` and `finalLevel >= callerLevel`).
- **Service Role Usage**: Yes (`SUPABASE_SERVICE_ROLE_KEY`).
- **Tables & Files Accessed**: `auth.users`, `public.users`, `public.organizations`.
- **Fail-Open Risks**: If target user belongs to another sector, security relies on an explicit application check rather than database RLS.
- **Level-Based Checks**: Caller level threshold (`<= 4`) and elevation barrier (`finalLevel >= callerLevel`).
- **Missing Permission Checks**: No `users:edit` or `users:assign_role` granular permissions.

---

### 2.7 `/api/admin/reset-password`
- **Location**: `src/app/api/admin/reset-password/route.ts`
- **HTTP Methods**: `POST`
- **Authentication Method**: Server session cookie (`createServerSupabaseClient()`).
- **Authorization Method**: Hardcoded level check: `level <= 1` (Superadmin or Techadmin only).
- **Service Role Usage**: Yes (`SUPABASE_SERVICE_ROLE_KEY`).
- **Tables & Files Accessed**: `public.users` (caller check), `auth.users` (password reset and `must_change_password` flag).
- **Fail-Open Risks**: Low (returns 401/403 on missing session or invalid level).
- **Level-Based Checks**: `profile.level <= 1 || profile.org_level <= 1`.
- **Missing Permission Checks**: No `users:reset_password` capability token.

---

### 2.8 `/api/missions/results`
- **Location**: `src/app/api/missions/results/route.ts`
- **HTTP Methods**: `GET`, `POST`
- **Authentication Method**: Server session cookie (`createServerSupabaseClient()`).
- **Authorization Method**: Validates active session, but does NOT verify that the caller is an assigned inspector or supervisor of the specific mission.
- **Service Role Usage**: Yes (`SUPABASE_SERVICE_ROLE_KEY`).
- **Tables & Files Accessed**: `mission_results`, `missions`, `checklist_items`.
- **Fail-Open Risks**: Any authenticated user possessing a valid `mission_id` can overwrite results for that mission, even if not assigned to it.
- **Level-Based Checks**: None.
- **Missing Permission Checks**: Lacks assignment check (`mission_assignees` or `assigned_user_id === caller.id`), missing `missions:record_results` capability.
- **Data Serialization Anomaly**: Packs and unpacks checklist item IDs into the `notes` column (`__item_id__:`, `__static_id__:`).

---

### 2.9 `/api/user/change-password`
- **Location**: `src/app/api/user/change-password/route.ts`
- **HTTP Methods**: `POST`
- **Authentication Method**: Bearer JWT token in HTTP `Authorization` header (`Bearer <access_token>`).
- **Authorization Method**: Validates JWT token against `supabaseAdmin.auth.getUser(accessToken)`.
- **Service Role Usage**: Yes (`SUPABASE_SERVICE_ROLE_KEY`).
- **Tables & Files Accessed**: `auth.users` (`updateUserById`).
- **Fail-Open Risks**: Low (requires valid Bearer token).
- **Level-Based Checks**: None (applicable to all authenticated users).
- **Missing Permission Checks**: None (self-service password update).

---

### 2.10 `/api/upload`
- **Location**: `src/app/api/upload/route.ts`
- **HTTP Methods**: `POST`
- **Authentication Method**: Server session cookie (`createServerSupabaseClient()`).
- **Authorization Method**: Requires authenticated session.
- **Service Role Usage**: Yes (`SUPABASE_SERVICE_ROLE_KEY` with fallback).
- **Tables & Files Accessed**: Supabase Storage Bucket `violation-photos`.
- **Fail-Open Risks**: MIME type validation relies on client-provided content type without inspecting magic numbers. Storage operations fall back to anon key if service key is missing.
- **Level-Based Checks**: None.
- **Missing Permission Checks**: Lacks fine-grained upload authorization (`missions:upload_photos`).

---

## 3. API Security & Architecture Comparison Matrix

| # | Endpoint | Methods | Auth Mechanism | Authz Mechanism | Fail-Open Risk | Service Role Fallback | Tables / Files Accessed |
|:---:|:---|:---:|:---|:---|:---:|:---:|:---|
| **01** | `/api/admin/mission-targets` | GET, POST | Session Cookie | Level check (`> 6` blocked) | **P0 (Defaults to Level 1)** | Yes (Insecure) | `missions`, `mission-targets.json` (FS) |
| **02** | `/api/admin/leadership-targets` | GET, POST, DELETE | Session Cookie (GET) / **NONE (POST/DEL)** | Level check (`<= 2`) / **NONE (POST/DEL)** | **P0 (Defaults to admin / No Auth on POST/DEL)** | Yes (Insecure) | `users`, `missions`, `leadership-targets.json` (FS) |
| **03** | `/api/admin/checklists` | GET, POST, PUT, DELETE | Session Cookie | Level check (`<= 2`, Level 5) | Medium (Unscoped GET fallback) | Yes (Insecure) | `checklists`, `checklist_sections`, `checklist_items` |
| **04** | `/api/admin/organizations` | GET, POST, PUT, DELETE | Session Cookie | Level check (`<= 3`) | Medium (Cross-sector read) | Yes (Insecure) | `organizations`, `users` |
| **05** | `/api/admin/create-user` | POST | Session Cookie | Level comparison (`user >= caller`) | Low (Strict validation) | No (Requires service key) | `auth.users`, `public.users`, `organizations` |
| **06** | `/api/admin/update-user` | POST | Session Cookie | Level comparison (`final >= caller`) | Low (Strict validation) | No (Requires service key) | `auth.users`, `public.users`, `organizations` |
| **07** | `/api/admin/reset-password` | POST | Session Cookie | Level check (`<= 1`) | Low (Superadmin only) | No (Requires service key) | `auth.users`, `public.users` |
| **08** | `/api/missions/results` | GET, POST | Session Cookie | Any authenticated user | **High (Unassigned user overwrite)** | No (Requires service key) | `mission_results`, `missions` |
| **09** | `/api/user/change-password` | POST | Bearer JWT | Self-service JWT match | Low (Strict token check) | No (Requires service key) | `auth.users` |
| **10** | `/api/upload` | POST | Session Cookie | Any authenticated user | Medium (Client MIME check) | Yes (Insecure) | Supabase Storage (`violation-photos`) |
