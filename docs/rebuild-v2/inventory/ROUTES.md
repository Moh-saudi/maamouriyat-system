# Inventory — Application Routes (`inventory/ROUTES.md`)
**Maamouriyat System — Rebuild V2 Inventory**
**Phase 0 — Deliverable 1/6**
*Status: Complete & Frozen*

---

## 1. Overview of Routing Architecture

The current application is built on Next.js 14+ using the App Router (`src/app`). Navigation is protected at the edge by `src/middleware.ts` and further governed inside layouts and page components using an organizational hierarchy system (Levels 1–7) mapped to role definitions in `src/lib/roles.ts`.

### Routing Map Summary:
- **Total Application Pages**: 16 routes
- **Public Routes**: 2 (`/`, `/login`)
- **Authenticated Dashboard Routes**: 14
- **Shared Layouts**: 2 (`src/app/layout.tsx`, `src/app/dashboard/layout.tsx`)

---

## 2. Complete Routes Inventory

### 2.1 Public & Authentication Routes

#### `GET /`
- **File**: `src/app/page.tsx`
- **Rendering**: Server Component
- **Auth Requirement**: Public / Conditional
- **Purpose**: Root landing page. Checks user authentication state; if authenticated, redirects to `/dashboard`, otherwise redirects to `/login`.
- **Key Dependencies**: `@/lib/supabase/server`

#### `GET /login`
- **File**: `src/app/login/page.tsx`
- **Rendering**: Client Component (`'use client'`)
- **Auth Requirement**: Public (Unauthenticated only). If authenticated, `middleware.ts` redirects to `/dashboard`.
- **Purpose**: User authentication portal. Handles email/password credentials, enforces default password detection (`123456`), presents compulsory password change dialog upon initial login, and manages session cookies.
- **Key Dependencies**: `@/lib/supabase/client`, `lucide-react`, `/api/user/change-password`

---

### 2.2 Core Operational & Dashboard Routes

#### `GET /dashboard`
- **File**: `src/app/dashboard/page.tsx`
- **Rendering**: Server Component wrapping `AnalyticsDashboard` (`analytics-dashboard.tsx`)
- **Auth Requirement**: Authenticated (All Levels 1–7).
- **Purpose**: Central executive and operational dashboard. Displays real-time KPI metrics, mission progress charts (completed, in-progress, delayed), compliance score distribution, violations by department, recent activities, and sector-scoped stats.
- **Scoping**:
  - Superadmin (Level 1): Nationwide aggregated statistics.
  - Sector (Level 2): Sector-specific facilities, missions, and violations.
  - Directorate (Level 5) & Admin (Level 6): Governorate/Admin-scoped telemetry.
  - Inspector (Level 7): Personal assigned missions and completion rate.
- **Key Dependencies**: `src/app/system-ui.tsx` (`DashboardShell`), `recharts`, `lucide-react`

#### `GET /dashboard/missions`
- **File**: `src/app/dashboard/missions/page.tsx`
- **Rendering**: Server Component wrapping `MissionsPortal` (`missions-portal.tsx`)
- **Auth Requirement**: Authenticated (All Levels 1–7).
- **Purpose**: Mission management portal. Features multi-tab filtering (All, Scheduled, In Progress, Completed, Delayed, Rejected), dual views (Data Table and Kanban Board), search by serial number/assignee/facility, quick action modal, and Excel/CSV export.
- **Key Dependencies**: `src/app/system-ui.tsx`, Supabase `missions`, `users`, `facilities`

#### `GET /dashboard/missions/new`
- **File**: `src/app/dashboard/missions/new/page.tsx`
- **Rendering**: Server Component wrapping `MissionCreateForm` (`mission-create-form.tsx`)
- **Auth Requirement**: Leadership and Administrative levels (Levels 1–6). Restricted for Level 7 (`inspector`) via `middleware.ts` and `canCreateMissions(level)`.
- **Purpose**: Mission creation and assignment wizard. Allows setting target facility, inspection checklist template, primary assignee, co-inspectors, scheduled date, priority, travel duration, overnight stay accommodation requirement, and scope notes.
- **Key Dependencies**: Supabase `facilities`, `checklists`, `users`, `organizations`

#### `GET /dashboard/missions/[id]/execute`
- **File**: `src/app/dashboard/missions/[id]/execute/page.tsx`
- **Rendering**: Server Component wrapping `MissionExecutionForm` (`mission-execution-form.tsx`)
- **Auth Requirement**: Assigned Inspector (Level 7) or Superadmin (Level 1).
- **Purpose**: Field mission execution interface. Features:
  - GPS check-in radius verification against facility coordinates (200m tolerance).
  - Dynamic interactive checklist evaluation (Compliant, Non-compliant, Not Applicable).
  - Photographic evidence capture and upload for non-compliant items.
  - Real-time compliance score computation.
  - Auto-generation of violation records upon submission.
  - GPS check-out verification and mission finalization.
- **Key Dependencies**: `/api/missions/results`, `/api/upload`, HTML5 Geolocation API, Supabase `missions`, `checklist_items`

#### `GET /dashboard/missions/[id]/print`
- **File**: `src/app/dashboard/missions/[id]/print/page.tsx`
- **Rendering**: Server Component wrapping `MissionPrintReport`
- **Auth Requirement**: Authenticated (Levels 1–7).
- **Purpose**: Official printable inspection report. Features official Egyptian Ministry of Health header, mission metadata, execution timestamps, GPS coordinates, checklist item breakdown, photo attachments, and signature blocks formatted for standard A4 printing and PDF generation.
- **Key Dependencies**: Print CSS stylesheets, Supabase `missions`, `mission_results`, `violations`

---

### 2.3 Regulatory, Organizational & User Governance Routes

#### `GET /dashboard/violations`
- **File**: `src/app/dashboard/violations/page.tsx`
- **Rendering**: Server Component wrapping `ViolationsPortal` (`violations-portal.tsx`)
- **Auth Requirement**: Authenticated (All Levels 1–7).
- **Purpose**: Comprehensive violation and non-compliance registry. Tracks detected deficiencies by priority (Critical, High, Medium, Low), status (New, Assigned, Under Correction, Corrected, Closed), facility type, and responsible department. Includes photo evidence viewer and correction verification actions.
- **Key Dependencies**: Supabase `violations`, `missions`, `facilities`

#### `GET /dashboard/facilities`
- **File**: `src/app/dashboard/facilities/page.tsx`
- **Rendering**: Server Component wrapping `FacilitiesPortal` (`facilities-portal.tsx`)
- **Auth Requirement**: Authenticated (Levels 1–6).
- **Purpose**: Healthcare facilities registry. Lists hospitals, primary healthcare units, family health centers, and medical supply warehouses. Includes GPS coordinate mapping, governorate filtering, sector affiliation links, and quick link to dispatch an inspection mission.
- **Key Dependencies**: Supabase `facilities`, `organizations`, `src/lib/real-facilities.ts`

#### `GET /dashboard/organizations`
- **File**: `src/app/dashboard/organizations/page.tsx`
- **Rendering**: Server Component wrapping `OrganizationsTablePortal` (`organizations-table-portal.tsx`)
- **Auth Requirement**: Administrative Levels (Levels 1–6). Scoped strictly to caller's sector/directorate.
- **Purpose**: Complete 7-level organizational structure directory. Displays sectors, central administrations, general administrations, directorates, and local health administrations. Features in-line editing, organizational code assignments, UTF-8 Excel export, and printable official directory.
- **Key Dependencies**: Supabase `organizations`, `/api/admin/organizations`

#### `GET /dashboard/users`
- **File**: `src/app/dashboard/users/page.tsx`
- **Rendering**: Server Component wrapping `UserPortal` (`user-portal.tsx`)
- **Auth Requirement**: Executive & Management Levels (Levels 1–4).
- **Purpose**: Personnel and workforce governance directory. Allows creating, editing, and scoping users, assigning organizational levels (1–7), intelligent level-based job title suggestions, auto-filtering affiliated departments, resetting credentials, and tracking real mission performance metrics.
- **Key Dependencies**: `/api/admin/create-user`, `/api/admin/update-user`, `/api/admin/reset-password`, Supabase `users`, `organizations`

---

### 2.4 Planning, Targets & Quality System Routes

#### `GET /dashboard/leadership-plan`
- **File**: `src/app/dashboard/leadership-plan/page.tsx`
- **Rendering**: Server Component wrapping `LeadershipPlanPortal` (`leadership-plan-portal.tsx`)
- **Auth Requirement**: Leadership Levels (Levels 1–5).
- **Purpose**: Periodic leadership inspection and supervision plan. Tracks targets assigned to Undersecretaries and Directorate heads, monitoring execution rates across governorates.
- **Key Dependencies**: `/api/admin/leadership-targets`, Supabase `users`, `missions`

#### `GET /dashboard/targets`
- **File**: `src/app/dashboard/targets/page.tsx`
- **Rendering**: Server Component wrapping `MissionTargetsPortal` (`mission-targets-portal.tsx`)
- **Auth Requirement**: Authenticated (Levels 1–6).
- **Purpose**: Periodic inspection targets management. Allows establishing monthly/quarterly mission quotas for sectors, directorates, or individual inspectors, with facility target lists.
- **Key Dependencies**: `/api/admin/mission-targets`

#### `GET /dashboard/targets/report`
- **File**: `src/app/dashboard/targets/report/page.tsx`
- **Rendering**: Server Component wrapping `TargetsReportPortal` (`targets-report-portal.tsx`)
- **Auth Requirement**: Authenticated (Levels 1–7).
- **Purpose**: Analytical targets performance report. Computes execution versus quota percentages, identifies lagging units, and generates executive variance charts.
- **Key Dependencies**: `/api/admin/mission-targets`, Supabase `missions`

#### `GET /dashboard/checklists`
- **File**: `src/app/dashboard/checklists/page.tsx`
- **Rendering**: Server Component wrapping `ChecklistsPortal` (`checklists-portal.tsx`)
- **Auth Requirement**: Superadmin (Level 1), Sector Head (Level 2), and Directorate (Level 5).
- **Purpose**: Quality evaluation checklist builder. Manages inspection evaluation forms, sections, and criteria per facility type and sector. Supports scoring weights, compliance definitions, and priority classifications.
- **Key Dependencies**: `/api/admin/checklists`, Supabase `checklists`, `checklist_sections`, `checklist_items`

#### `GET /dashboard/settings`
- **File**: `src/app/dashboard/settings/page.tsx`
- **Rendering**: Server Component wrapping `SettingsPortal` (`settings-portal.tsx`)
- **Auth Requirement**: Authenticated (Levels 1–7).
- **Purpose**: User preferences and security management. Allows updating phone number, display preferences, reviewing account permissions, and changing password.
- **Key Dependencies**: `/api/user/change-password`, Supabase `users`

---

## 3. Route Protection & Authorization Matrix

| Route Path | Min Level | Max Level | Allowed Roles | Middleware Enforced |
| :--- | :---: | :---: | :--- | :---: |
| `/` | - | - | Public (Auto-redirect) | No |
| `/login` | - | - | Unauthenticated only | Yes |
| `/dashboard` | 0 | 7 | All Roles (`superadmin`, `sector`, `central`, `generalmanager`, `directorate`, `creator`, `inspector`) | Yes |
| `/dashboard/missions` | 0 | 7 | All Roles | Yes |
| `/dashboard/missions/new` | 1 | 6 | `superadmin`, `sector`, `central`, `generalmanager`, `directorate`, `creator` | Yes |
| `/dashboard/missions/[id]/execute` | 0 | 7 | Assigned `inspector` or `superadmin` | Yes |
| `/dashboard/missions/[id]/print` | 0 | 7 | All Roles | Yes |
| `/dashboard/violations` | 0 | 7 | All Roles | Yes |
| `/dashboard/facilities` | 0 | 6 | `superadmin`, `techadmin`, `sector`, `central`, `generalmanager`, `directorate`, `creator` | Yes |
| `/dashboard/organizations` | 0 | 6 | `superadmin`, `techadmin`, `sector`, `central`, `generalmanager`, `directorate`, `creator` | Yes |
| `/dashboard/users` | 0 | 4 | `superadmin`, `techadmin`, `sector` (Level 3-4 via page check) | Yes |
| `/dashboard/leadership-plan` | 0 | 5 | `superadmin`, `techadmin`, `sector`, `central`, `generalmanager`, `directorate` | Yes |
| `/dashboard/targets` | 0 | 7 | All Roles | Yes |
| `/dashboard/targets/report` | 0 | 7 | All Roles | Yes |
| `/dashboard/checklists` | 0 | 2 | `superadmin`, `techadmin`, `sector` | Yes |
| `/dashboard/settings` | 0 | 7 | All Roles | Yes |
