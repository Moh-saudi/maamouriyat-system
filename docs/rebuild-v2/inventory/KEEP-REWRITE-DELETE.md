# Maamouriyat System — Keep, Rewrite, Delete Inventory

> **Document Status**: Complete & Corrected (Phase 0.5)  
> **Phase**: Phase 0.5 — Normalize Documentation & Correct Inventory  
> **Date**: September 2026  
> **Target System**: Maamouriyat Monitoring & Inspection System (Egyptian Ministry of Health & Population)

---

## Architectural Transition Strategy

The Rebuild V2 follows a strict greenfield-beside-legacy strategy:
- V2 code is assembled cleanly under `src/app/v2` beside V1 until cutover.
- V1 files remain completely frozen during Phase 0 and 0.5 to preserve ongoing ministerial operations.
- **NO production logic is to be deleted at this time.**

---

## 1. KEEP / REFACTOR (Core Domains & Schemas)

These assets encapsulate essential Egyptian health governance rules, curated facility databases, domain models, and established database scripts:

| Domain / Asset | Classification | Rationale & Reuse Context in V2 |
|:---|:---:|:---|
| **Business Concepts & Rules** | KEEP | Egyptian Ministry inspection protocols, compliance scoring logic, mandatory recommendations sign-off, distance verification. |
| **Organization Hierarchy Concept** | KEEP | 7-tier organizational pyramid (1=Ministry, 2=Sector, 3=Central Admin, 4=General Admin, 5=Directorate, 6=Health Admin, 7=Field Unit). |
| **Missions Domain** | KEEP | Full lifecycle model: `draft` -> `scheduled` -> `in_progress` -> GPS check-in/out -> checklist evaluation -> `completed`. |
| **Violations Domain** | KEEP | 4-tier severity model (`critical`, `high`, `medium`, `low`), 5-stage rectification workflow (`new`, `in_progress`, `corrected`, `verified`, `closed`), and Arabic UTF-8 BOM CSV export. |
| **Targets Domain** | KEEP / REFACTOR | Periodic quotas (weekly, monthly, quarterly) vs actual mission completions calculation engine. |
| **Checklists Domain** | KEEP | Quality criteria models across departments (Infection Control, Pharmacy, Medical Equipment Maintenance). |
| **Existing SQL Migrations (01–16)** | KEEP (After Review) | Valuable schema foundations, performance indexes (`05_performance_indexes.sql`), concurrency-safe serial sequence (`15_enterprise_mission_serial_sequence.sql`), and storage rules. |
| **`leadership_targets` Table Base** | KEEP / REFACTOR | Authoritative table already defined in [`scripts/14-leadership-targets.sql`](file:///d:/Work%203lagy/maamouriyat-system/scripts/14-leadership-targets.sql). To be reviewed and adopted as the primary database store for leadership targets. |
| **Egyptian Health Facilities Seed** | KEEP | [`src/lib/real-facilities.ts`](file:///d:/Work%203lagy/maamouriyat-system/src/lib/real-facilities.ts) containing 77KB of curated Egyptian hospitals, clinics, and coordinates across 27 governorates. |
| **Print Layout & Official Format** | KEEP | Print CSS (`@media print`), official Egyptian Ministry watermarks, headers, and signature lines in `missions/[id]/print/page.tsx`. |

---

## 2. REWRITE (Obsolete & Monolithic Architectures)

These components violate modern Next.js architectural standards, create critical security risks, or bundle excessive responsibilities into monolithic files. They **MUST NOT** be copied into V2:

| Component / Layer | Current Problem | Target V2 Architecture |
|:---|:---|:---|
| **`system-ui.tsx` Architecture** | **4,397 lines** monolith combining DashboardShell, navigation, user state, modals, and cookie sync. | **Master Plan Rule 31**: Zero lines copied into V2. Rebuild cleanly using HeroUI v3 & Tailwind CSS v4 atomic layout components. |
| **Current Navigation Shell** | Fragmented navigation lacking cohesive responsive breakpoints (poor mobile/tablet experience). | Unified responsive shell: Desktop RTL sidebar (collapsible), Tablet collapsed rail/drawer, Mobile bottom nav (max 4 items) + "More" sheet. |
| **Client-Side Permission Cookie Logic** | Setting `document.cookie = "maamouriyat_user_role=..."` in browser JS, allowing role spoofing. | **Master Plan Rule 33**: Eliminate client permission cookies. Enforce server-side session validation via Next.js Middleware and Supabase Auth JWT. |
| **Direct Supabase Access in UI** | Client components (`missions-portal.tsx`, `violations-portal.tsx`) calling `supabase.from()` directly. | **Master Plan Rule 9**: UI must NOT call Supabase directly. All mutations route through typed Server Actions and backend Repository services. |
| **Mission Targets JSON Persistence** | Route handler writes to `src/data/mission-targets.json` via Node `fs.writeFileSync`. Ephemeral and lossy. | Rebuild with a formal PostgreSQL `mission_targets` schema in Phase 3. |
| **Leadership Targets JSON Persistence** | Route handler writes to `src/data/leadership-targets.json` via Node `fs.writeFileSync`, ignoring database table. | Bind the existing `leadership_targets` PostgreSQL table directly to the API, abandoning JSON storage. |
| **Fragmented Authorization Logic** | Inconsistent permission checks scattered across `src/lib/roles.ts`, integer levels (`level <= 2`), and static arrays. | Build centralized, dynamic database-driven RBAC: Roles + Granular Permissions + Data Scope + User Overrides. |
| **Mission Execution Form Monolith** | **3,653 lines** single client component (`mission-execution-form.tsx`) causing mobile browser crashes. | Modular 4-step wizard: (1) Facility & GPS, (2) Checklist, (3) Violations & Evidence, (4) Sign-off. |

---

## 3. DELETE LATER (Decommission at Cutover)

These assets represent temporary artifacts, duplicated documentation, or legacy scaffolding. They will be deleted in their appropriate lifecycle phases:

| Asset / Path | Deletion Phase | Condition for Safe Deletion |
|:---|:---:|:---|
| **Duplicated `inventory/` and `docs/` Folders** | **Phase 0.5 (Now)** | Once verified and consolidated under `docs/rebuild-v2/inventory/`. |
| **`v2/rebuild-v2-local-pack` Folder** | **Phase 0.5 (Now)** | Verified to contain only instruction/inventory duplicates with zero source code. |
| **Legacy JSON Storage Files** (`mission-targets.json`, `leadership-targets.json`) | **Phase 3 (Data Phase)** | After full data migration into PostgreSQL database tables. |
| **Legacy `organizational_units` Table & Foreign Keys** (`org_unit_id`) | **Phase 8 (Cutover)** | After ensuring zero remaining orphaned references in production. |
| **Legacy V1 UI Components & Pages** (`src/app/dashboard/...`, `system-ui.tsx`) | **Phase 8 (Cutover)** | Strictly at final cutover when V2 under `src/app/v2` is fully operational and approved. |

> [!IMPORTANT]
> **No Production Code Deleted in Phase 0.5**: Only duplicate documentation files and the temporary local instruction pack are cleaned up in this phase.
