# Maamouriyat System — Rebuild V2 Master Plan

Antigravity works on the local project folder. The local files are the source of truth.

## Architecture
- Keep organization levels 1–7 as organizational context.
- Build dynamic RBAC for roles/permissions.
- Build V2 beside V1 under `/v2` until cutover.
- UI must not call Supabase directly; use services/repositories/adapters.
- Target stack: Next.js App Router, TypeScript strict, Tailwind CSS v4, HeroUI v3, Lucide, Recharts.

## Responsive design
Desktop: RTL right sidebar, collapsible.
Tablet: collapsed rail or drawer.
Mobile: no permanent sidebar; small topbar + bottom navigation (max 4) + "More" sheet.

## Phases
0. Inventory & Freeze
1. Foundation
2. Responsive App Shell
3. Auth + Authorization + Data Access
4. Read-only Modules
5. Core Mission Workflow
6. Violations / Targets / Checklists
7. Administration
8. Cutover

## Rules
- One phase per task/session.
- Do not start the next phase automatically.
- Do not copy `system-ui.tsx` into V2.
- Do not create new level-based authorization checks.
- Do not use cookies/localStorage as the central permission source.
- Run build/typecheck/lint after each implementation phase.
