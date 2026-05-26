# Maamouriyat Roles And Workflow Plan

## Goal

Build the system around clear operational roles instead of one generic dashboard. Each role gets a focused dashboard, the right actions, and a workflow that matches its daily work.

## Demo Accounts

All temporary demo accounts use password `123456`.

| Role | Email | Main Responsibility |
| --- | --- | --- |
| System Admin | `admin@admin.com` | System setup, users, permissions, reference data, full oversight |
| Executive Director | `director@director.com` | Executive indicators, risks, governorate performance, approvals |
| Operations Supervisor | `supervisor@supervisor.com` | Assign missions, follow field teams, handle delayed missions |
| Inspector | `inspector@inspector.com` | Execute assigned missions, record results, submit violations |
| Corrections Officer | `corrections@corrections.com` | Follow violation correction, verify closure, escalate overdue items |

## Core Workflow

1. Admin prepares users, governorates, facilities, units, and permissions.
2. Supervisor creates and assigns missions to inspectors.
3. Inspector executes the mission and records visit results, facility status, notes, and violations.
4. Supervisor reviews mission execution and resolves operational issues.
5. Corrections officer follows violations until corrected or escalated.
6. Director monitors executive performance and risk indicators.
7. Admin audits system usage and maintains configuration.

## Dashboard Direction

| Role | Dashboard Focus |
| --- | --- |
| Admin | system health, users, inactive data, configuration gaps |
| Director | executive KPIs, high-risk violations, governorate comparison, overdue actions |
| Supervisor | daily missions, pending assignments, inspector workload, delayed missions |
| Inspector | my missions, today's route, pending execution, rejected or returned tasks |
| Corrections | open violations, due dates, overdue corrections, closure progress |

## Execution Phases

1. Stabilize demo authentication and role detection.
2. Split dashboard data by role and show role-specific indicators.
3. Apply permission gates to navigation and actions.
4. Complete mission creation, execution, review, and correction workflows.
5. Connect demo roles to real Supabase users when production credentials are ready.

## Current Implementation Status

| Phase | Status | Notes |
| --- | --- | --- |
| Demo authentication | Done | Demo role detection is centralized in `src/lib/roles.ts` and `src/lib/demo-session.ts`. |
| Role dashboards | In progress | Each demo account now receives role-specific dashboard metrics and a visible role context banner. |
| Navigation gates | In progress | Desktop and side-sheet navigation now read the role definition. Mobile logout clears the demo session before returning to login. |
| Workflow screens | Next | Mission assignment, execution review, and correction queues still need role-specific screens and actions. |
| Production users | Pending | Real Supabase user provisioning requires the service role key before final production testing. |

## Facility Affiliations

Facilities should keep two separate references:

- Geographic location: governorate.
- Administrative affiliation or owner: health directorate, ministry HQ, secretariat, authority, or other central entity.

Initial facility affiliation list:

- 27 Health Affairs Directorates for Egypt governorates.
- Ministry HQ.
- General Secretariat of Mental Health and Addiction Treatment.
- Secretariat of Specialized Medical Centers.
- Health Insurance Organization.
- Universal Health Insurance Authority.
- Egyptian Ambulance Organization.
- Curative Care Organization.

Current data direction:

- `facility_affiliations` is the central reference table.
- `facilities.affiliation_id` links each facility to its owning or affiliated entity.
- The table can be updated manually now and later synchronized with external systems.

## Correction Units

Correction responsibility is not a single person. It is a central list of specialized units. Inspectors choose from the list or type a new unit when recording a violation.

Initial examples:

- إدارة الصيدلة والمستلزمات
- إدارة صيانة الأجهزة الطبية
- إدارة صيانة التكييفات
- إدارة مكافحة العدوى
- إدارة متابعة غياب الموظفين
- إدارة الجودة
- إدارة التراخيص

Current UI direction:

- The mission execution form uses a writable searchable dropdown through `datalist`.
- The selected or typed unit is saved in `violations.assigned_to_dept`.
- Later, the same list should move from static config to a central settings table managed by admin.
