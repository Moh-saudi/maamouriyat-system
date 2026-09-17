# Phase 2 — Responsive App Shell

Start only after Phase 1 approval.

Build:
- AppShell
- DesktopSidebar
- Topbar
- UserMenu
- MobileBottomNav
- MoreNavigationSheet
- PageHeader

Desktop >=1024:
- RTL right sidebar 272–288px, collapsed 72–80px
- clean grouped nav
- no horizontal overflow

Tablet 768–1023:
- collapsed rail or drawer

Mobile <768:
- no permanent sidebar
- small topbar
- bottom nav max 4 items
- fifth item "More" opens sheet/drawer
- never show sidebar + bottom nav together

Test: 390x844, 768x1024, 1366x768, 1920x1080.

No DB/API/RBAC/dashboard migration in this phase. STOP after completion.
