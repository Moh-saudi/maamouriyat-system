# Inventory — Database Schema & Data Models (`inventory/DATABASE.md`)

> **Document Status**: Complete & Corrected (Phase 0.5)  
> **Phase**: Phase 0.5 — Normalize Documentation & Correct Inventory  
> **Date**: September 2026  
> **Target System**: Maamouriyat Monitoring & Inspection System (Egyptian Ministry of Health & Population)

---

## 1. Overview of Database Architecture

The database layer utilizes PostgreSQL hosted on Supabase (`upxmlpiemqdfbhyipihh.supabase.co`). It combines relational entities, database triggers for automated serial numbers and duration calculations, and Supabase Storage for photographic evidence.

---

## 2. Table Catalog & Active Data Models

### 2.1 `public.users`
User profile entity linked 1-to-1 with Supabase Auth (`auth.users`).
- `id` (UUID, PK): System internal identifier.
- `auth_id` (UUID, FK -> `auth.users.id` ON DELETE CASCADE): Authentication linkage.
- `full_name` (TEXT, NOT NULL): Official name.
- `job_title` (TEXT): Functional position/title.
- `level` (INTEGER, 1–7): Original authority level (*Legacy / Compatibility*).
- `org_level` (INTEGER, 1–7): Standardized organizational hierarchy tier (*Current*).
- `department` (TEXT): Human-readable department name.
- `organization_id` (UUID, FK -> `organizations.id`): Active organizational unit reference (*Current*).
- `org_unit_id` (UUID, FK -> `organizational_units.id`): Legacy organizational unit reference (*Legacy*).
- `sector_id` (UUID, FK -> `organizations.id`): Central Sector affiliation (*Current*).
- `facility_id` (UUID, FK -> `facilities.id`): Primary assigned health facility (for stationed staff).
- `email` (TEXT): Normalized email address.
- `phone` (TEXT): Mobile phone number.
- `financial_code` (TEXT): Government financial registry code.
- `direct_manager_id` (UUID, FK -> `users.id`): Reporting hierarchy.
- `can_inspect` (BOOLEAN, DEFAULT true): Field inspection eligibility.
- `is_active` (BOOLEAN, DEFAULT true): Account active status.
- `created_at`, `updated_at` (TIMESTAMPTZ).

### 2.2 `public.facilities`
Egyptian healthcare facilities directory.
- `id` (UUID, PK): Facility identifier.
- `name` (TEXT, NOT NULL): Official facility name.
- `facility_type` (TEXT, NOT NULL): General Hospital, Primary Health Unit, Family Center, Warehouse, etc.
- `address` (TEXT, NOT NULL): Street/city address.
- `governorate` (TEXT): Governorate name.
- `governorate_id` (UUID, FK -> `governorates.id`): Standard governorate reference.
- `health_admin` (TEXT): Center / Health Administration name.
- `village_city` (TEXT): Village / district location.
- `organization_id` (UUID, FK -> `organizations.id`): Parent organizational unit (*Current*).
- `sector_id` (UUID, FK -> `organizations.id`): Managing Central Sector (*Current*).
- `latitude`, `longitude` (DECIMAL(10,8), DECIMAL(11,8)): Verified GPS coordinates.
- `gps_radius_meters` (INTEGER, DEFAULT 200): Geofence tolerance for check-in.
- `phone`, `responsible_dept`, `notes` (TEXT).
- `is_active` (BOOLEAN, DEFAULT true).
- `created_at`, `updated_at` (TIMESTAMPTZ).

### 2.3 `public.organizations` (Primary 7-Level Structure — Current)
Authoritative organizational hierarchy table representing the Egyptian health pyramid.
- `id` (UUID, PK): Unique organizational unit ID.
- `name` (TEXT, NOT NULL): Official name.
- `code` (TEXT, UNIQUE): Official code (e.g. `SEC-CUR-01`, `GEN-HOSP-02`).
- `level` (INTEGER, 1–7): Level (1: Ministry, 2: Sector, 3: Central Admin, 4: General Admin, 5: Directorate, 6: Health Admin, 7: Field/Unit).
- `level_label` (TEXT): Level description in Arabic.
- `parent_id` (UUID, FK -> `organizations.id`): Direct parent organization.
- `parent_name` (TEXT): Cached parent organization name.
- `sector_id` (UUID, FK -> `organizations.id`): Central sector root.
- `governorate` (TEXT): Geographic location.
- `health_admin` (TEXT): Health administration location.
- `manager_name`, `manager_id` (TEXT, UUID): Appointed head/director.
- `can_issue_missions` (BOOLEAN, DEFAULT true).
- `can_approve_missions` (BOOLEAN, DEFAULT false).
- `is_active` (BOOLEAN, DEFAULT true).
- `created_at`, `updated_at` (TIMESTAMPTZ).

### 2.4 `public.organizational_units` (Legacy Table — Compatibility / Pending Decision)
Precursor table to `organizations` introduced in early Phase 1 migration.
- Columns: `id`, `code`, `name`, `unit_type`, `parent_id`, `level`, `sort_order`, `is_active`.
- Status: **Legacy**. Still referenced by old foreign key columns (`users.org_unit_id`, `missions.org_unit_id`). Must NOT be dropped in Phase 0.

### 2.5 `public.governorates`
Standard administrative governorate lookup (27 Egyptian governorates).
- `id` (UUID, PK), `code` (TEXT, UNIQUE), `name` (TEXT, UNIQUE), `region` (TEXT), `is_active` (BOOLEAN).

### 2.6 `public.checklists`
Quality and compliance checklist templates.
- `id` (UUID, PK), `name` (TEXT, NOT NULL), `facility_type` (TEXT, NOT NULL), `description` (TEXT), `sector_id` (UUID), `org_unit_id` (UUID), `is_active` (BOOLEAN), `created_by` (UUID, FK -> `users.id`).

### 2.7 `public.checklist_sections`
Sections grouping criteria within a checklist.
- `id` (UUID, PK), `checklist_id` (UUID, FK -> `checklists.id` ON DELETE CASCADE), `name` (TEXT, NOT NULL), `sort_order` (INTEGER).

### 2.8 `public.checklist_items`
Individual checklist questions / evaluation criteria.
- `id` (UUID, PK), `checklist_id` (UUID, FK), `section_id` (UUID, FK), `text` (TEXT, NOT NULL), `answer_type` (TEXT: `yes_no`, `score`, `text`), `is_required` (BOOLEAN), `violation_priority` (TEXT: `critical`, `high`, `medium`, `low`), `correction_dept` (TEXT), `sort_order` (INTEGER).

### 2.9 `public.missions`
Central operational mission entity.
- `id` (UUID, PK): Mission UUID.
- `serial_number` (TEXT, UNIQUE): Concurrency-safe serial sequence (e.g. `MOH-2026-00042`).
- `facility_id` (UUID, FK -> `facilities.id`): Target healthcare facility.
- `checklist_id` (UUID, FK -> `checklists.id`): Assigned inspection form.
- `assigned_user_id` (UUID, FK -> `users.id`): Primary inspector.
- `created_by` (UUID, FK -> `users.id`): Mission creator/issuer.
- `approved_by` (UUID, FK -> `users.id`): Reviewing authority.
- `status` (TEXT): `draft`, `scheduled`, `in_progress`, `completed`, `delayed`, `rejected`, `closed`.
- `priority` (TEXT): `urgent`, `high`, `normal`, `low`.
- `scheduled_date` (DATE, NOT NULL): Planned execution date.
- `expected_end_date` (DATE): Planned completion date.
- `duration_days` (INTEGER, DEFAULT 1): Mission duration in days.
- `is_overnight` (BOOLEAN, DEFAULT false): Overnight accommodation required.
- `hotel_booking_status` (TEXT): Hotel reservation workflow tracking.
- `checkin_lat`, `checkin_lng`, `checkin_time` (DECIMAL, TIMESTAMPTZ): Start GPS & time.
- `checkout_lat`, `checkout_lng`, `checkout_time` (DECIMAL, TIMESTAMPTZ): End GPS & time.
- `gps_verified` (BOOLEAN, DEFAULT false): Checkin within geofence radius.
- `duration_minutes` (INTEGER): Total executed duration.
- `total_items`, `compliant_items`, `violation_count` (INTEGER): Summary evaluation counts.
- `compliance_percentage` (DECIMAL(5,2)): Real-time computed score.
- `organization_id` (UUID, FK -> `organizations.id`): Issuing organization (*Current*).
- `org_unit_id` (UUID, FK -> `organizational_units.id`): Legacy organizational unit reference (*Legacy*).
- `notes`, `rejection_reason` (TEXT).
- `created_at`, `updated_at` (TIMESTAMPTZ).

### 2.10 `public.leadership_targets` (Existing Table in Schema)
> **IMPORTANT ARCHITECTURAL CORRECTION**:  
> Table `public.leadership_targets` **ALREADY EXISTS** in the schema scripts via [`scripts/14-leadership-targets.sql`](file:///d:/Work%203lagy/maamouriyat-system/scripts/14-leadership-targets.sql).  
> **V2 does NOT need to create this table from scratch.**  
> What V2 must do: review the existing schema, verify if additional columns are required, bind the API to this table, stop writing to `leadership-targets.json`, and avoid creating a duplicate table under a new name.
- `id` (UUID, PK, DEFAULT `gen_random_uuid()`)
- `title` (VARCHAR(255), NOT NULL)
- `sector_head_id` (UUID, FK -> `users.id` ON DELETE SET NULL)
- `sector_name` (VARCHAR(255), DEFAULT 'قطاع الطب العلاجي')
- `undersecretary_id` (UUID, FK -> `users.id` ON DELETE CASCADE)
- `undersecretary_name` (VARCHAR(255), NOT NULL)
- `governorate` (VARCHAR(100), NOT NULL)
- `target_missions` (INT, NOT NULL DEFAULT 15)
- `start_date` (DATE, NOT NULL)
- `end_date` (DATE, NOT NULL)
- `status` (VARCHAR(50), DEFAULT 'active')
- `instructions` (TEXT)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- Indexes: `idx_leadership_targets_undersecretary`, `idx_leadership_targets_dates`.

### 2.11 `mission_targets` (Pending Formal Database Schema)
- **Current Status**: Does **NOT** exist as an independent PostgreSQL table in `scripts/` or `schema.sql`. Currently exists only as an ephemeral local JSON structure (`src/data/mission-targets.json`).
- **V2 Directive**: Needs a formal relational schema design in **Phase 3 (Data Access / RBAC)**. Do NOT create this table now in Phase 0/0.5.

### 2.12 `public.mission_results`
Recorded evaluation responses for each checklist item during execution.
- `id` (UUID, PK), `mission_id` (UUID, FK -> `missions.id` ON DELETE CASCADE), `checklist_item_id` (UUID, FK -> `checklist_items.id`), `answer` (TEXT: `yes`, `no`, `na`), `notes` (TEXT), `photo_url` (TEXT), `recorded_at` (TIMESTAMPTZ).

### 2.13 `public.violations`
Recorded deficiencies requiring corrective action.
- `id` (UUID, PK), `mission_id` (UUID, FK -> `missions.id`), `checklist_item_id` (UUID, FK), `facility_id` (UUID, FK -> `facilities.id`), `description` (TEXT), `priority` (`critical`, `high`, `medium`, `low`), `status` (`new`, `assigned`, `under_correction`, `corrected`, `verified`, `closed`), `assigned_to_dept` (TEXT), `assigned_to_user_id` (UUID, FK), `correction_deadline` (TIMESTAMPTZ), `correction_notes` (TEXT), `corrected_at` (TIMESTAMPTZ), `corrected_by` (UUID), `verified_by` (UUID), `verified_at` (TIMESTAMPTZ), `violation_photo_url`, `correction_photo_url` (TEXT).

---

## 3. Database Drift & Field Redundancy Analysis

To ensure complete clarity without performing premature schema drops, all duplicated or overlapping fields are classified below:

| Entity / Field | Classification | Context & Usage in Codebase | Action Plan for V2 |
|:---|:---:|:---|:---|
| `organizations` | **Current** | Authoritative 7-level organizational structure used across UI, routes, and `src/lib/organizations.ts`. | Primary target structure for all hierarchy relations. |
| `organizational_units` | **Legacy** | Initial 5-level table created in `01_initial_schema.sql`. Superseded by `organizations`. | Retain in Phase 0/0.5. Assess orphaned rows before migration in later phases. |
| `organization_id` | **Current** | Primary foreign key linking `users`, `facilities`, and `missions` to `organizations`. | Maintain as the sole authoritative organizational foreign key. |
| `org_unit_id` | **Legacy** | Foreign key linking entities to the older `organizational_units` table. | Audit for records where `organization_id IS NULL AND org_unit_id IS NOT NULL` before deprecating. |
| `org_level` | **Current** | Explicit integer representing the 7-tier organizational pyramid (1=Ministry to 7=Field Unit). | Use strictly as **Organizational Hierarchy** tier, decoupled from RBAC permissions. |
| `level` (in `users`) | **Compatibility** | Legacy integer column. Synchronized via triggers or fallback code (`profile.org_level ?? profile.level`). | Retain for backward compatibility with older UI queries until cutover. |
| `sector_id` | **Current** | Central sector affiliation column present on `users`, `facilities`, and `organizations`. | Critical for data scoping and multi-tenant sector boundaries. |

> [!CAUTION]
> **Zero Schema Changes in Phase 0 / 0.5**: No columns or tables may be dropped (`DROP TABLE`, `DROP COLUMN`) at this stage. All legacy elements remain frozen in place.

---

## 4. Separation of Organizational Hierarchy vs. Authorization Roles

A fundamental architectural principle of V2 is the strict separation between:
1. **Organizational Hierarchy (`level` / `org_level`)**:
   - Denotes *where* the employee sits within the Egyptian administrative structure (Ministry, Sector, Central Admin, General Admin, Directorate, District, Facility).
   - Governs *geographic and organizational data scope* (e.g., a Directorate head only sees their governorate).
   - Is NOT the ultimate determinant of functional capabilities.
2. **Authorization Roles & Granular Permissions**:
   - V1 currently suffers from fragmented and hardcoded authorization checks scattered across:
     - `src/lib/roles.ts` (`orgLevelToRole`)
     - `user_permissions` table / `role_permissions` scripts
     - `allowed_pages` arrays
     - Client cookies (`maamouriyat_user_role`)
     - Hardcoded `level <= 2` checks in API routes
   - V2 will replace this with a centralized, dynamic model evaluated strictly on the server:
     $$\text{Effective Access} = \text{Dynamic Role} + \text{Fine-Grained Permissions} + \text{Data Scope} + \text{User Overrides} + \text{Org Capabilities}$$

---

## 5. Migrations & Script Chronology (01–16)

1. `scripts/01-reset-and-tables.sql`: Base tables DDL (`users`, `facilities`, `checklists`, `missions`, `results`, `violations`, `notifications`, `events`).
2. `scripts/02-functions-and-triggers.sql`: Stored functions for serial generation, duration calculation, deadlines.
3. `scripts/03-rls-policies.sql`: Row Level Security policies per role.
4. `scripts/04-storage-policies.sql`: Bucket configurations and upload rules.
5. `scripts/05-organization-mission-migration.sql`: Introduction of `organizational_units`, `governorates`, and mission destination extensions.
6. `scripts/06-seed-facilities.sql`: Seed data for 51 real Egyptian hospitals, primary clinics, and medical warehouses.
7. `scripts/07-facility-affiliations.sql`: Linked facilities to organizational sectors and health administrations.
8. `scripts/08-mission-assignees.sql`: Multi-inspector support table.
9. `scripts/09-mission-expected-end-date.sql`: Multi-day mission extensions.
10. `scripts/10-notification-delivery.sql`: Automated notification triggers on mission assignment.
11. `scripts/11-mission-duration-overnight.sql`: Overnight accommodation fields.
12. `scripts/12-mission-hotel-booking.sql`: Hotel reservation state machine.
13. `scripts/13-add-user-fields.sql`: Financial code, phone, facility linkage, and email columns.
14. `scripts/14-leadership-targets.sql`: **Authoritative DDL for `public.leadership_targets` table**.
15. `scripts/15-enterprise-mission-serial-sequence.sql`: Atomic sequence for concurrency-safe serial numbers.
16. `scripts/16-cleanup-test-missions.sql`: Cleanup of development testing records.
