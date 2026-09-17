# Phase 1 — V2 Foundation

Start only after Phase 0 is reviewed.

Do:
- verify React/Next compatibility before upgrading anything
- add Tailwind CSS v4
- add official HeroUI v3 packages
- central RTL government theme
- create `src/app/v2`
- create `src/components/ui`, `src/components/layout`, `src/components/feedback`
- create `src/config/branding.ts`, `navigation.ts`
- placeholder routes for dashboard, missions, violations, facilities, organizations, users, targets, checklists, settings

Forbidden:
- no DB/API/RBAC changes
- no business logic migration
- no V1 deletion
- no copying old CSS/system-ui

Build/typecheck must pass, then STOP.
