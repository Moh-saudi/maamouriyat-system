# Phase 0 — Inventory & Freeze

Read `docs/rebuild-v2/00-MASTER-PLAN.md` first.

Create documentation only:
- `inventory/ROUTES.md`: all app routes and purpose.
- `inventory/API.md`: every API route, methods, auth, service-role usage, tables, checks.
- `inventory/DATABASE.md`: tables, relations, migrations/scripts, duplicates/legacy.
- `inventory/WORKFLOWS.md`: login/password-change, users, mission lifecycle, results, violations, targets, checklists.
- `inventory/KEEP-REWRITE-DELETE.md`: KEEP / REFACTOR / REWRITE / DELETE LATER.
- `inventory/RISKS.md`: top 20 pre-production risks ranked P0/P1/P2.

Forbidden in Phase 0:
- no HeroUI install
- no React changes
- no CSS/design changes
- no schema changes
- no bug fixing unless absolutely required for inspection

Deliver a short report and STOP. Do not begin Phase 1.
