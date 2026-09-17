# خطة إعادة بناء الصلاحيات الديناميكية — Dynamic RBAC v2

> المستودع: `Moh-saudi/maamouriyat-system`
>
> الهدف: تحويل الصلاحيات من نموذج ثابت يعتمد على `level 1..7` إلى نموذج مؤسسي ديناميكي يدعم الأدوار القابلة للإنشاء من داخل المنظومة، الصلاحيات الدقيقة على مستوى العملية، نطاق البيانات، والاستثناءات الفردية، **بدون كسر المستخدمين الحاليين أو الهيكل التنظيمي الحالي**.

---

## 1) القرار المعماري الأساسي

### لا نحذف المستويات 1–7

المستويات `org_level / level` تبقى لأنها تصف **الموقع التنظيمي للموظف** داخل الوزارة:

- 1: الوزارة
- 2: القطاع
- 3: الإدارة المركزية
- 4: الإدارة العامة
- 5: المديرية
- 6: الإدارة الصحية
- 7: الوحدة / الموظف الميداني

لكن المستوى **لا يجب أن يكون هو مصدر الصلاحية النهائي**.

من الآن يصبح الفصل كالآتي:

- `org_level`: أين يقع الموظف في الهيكل؟
- `organization_id / sector_id`: إلى أي جهة يتبع؟
- `roles`: ما الوظائف التي يقوم بها داخل النظام؟
- `permissions`: ماذا يستطيع أن يفعل تحديدًا؟
- `scope`: على أي بيانات يستطيع فعل ذلك؟
- `organization capabilities`: ماذا تسمح الجهة نفسها بتنفيذه؟
- `user overrides`: استثناءات Allow/Deny لموظف بعينه.

القاعدة الذهبية:

> **Organization Hierarchy != Authorization Role**

المستوى التنظيمي ليس Role.

---

## 2) لماذا نحتاج هذا التغيير؟

الوضع الحالي يحتوي بالفعل أجزاء من النظام المطلوب، لكنها غير موحدة:

1. `src/lib/roles.ts` يربط المستوى مباشرة بدور ثابت وصفحات ثابتة.
2. `user_permissions` موجود ويحتوي `allowed_pages` لكل مستخدم.
3. `role_permissions` موجود ويحتوي صلاحيات صفحات للأدوار.
4. Settings تحتوي واجهة حوكمة وصلاحيات مستخدمين.
5. Middleware يحتوي `allowedPagesOverride` لكنه لا يحمّله فعليًا من قاعدة البيانات، فيرجع إلى الدور الثابت.
6. بعض تغييرات Role Permissions تحفظ في Cookie محلي بدل قاعدة البيانات.
7. الصلاحية الحالية غالبًا على مستوى **صفحة** فقط، بينما المطلوب صلاحية على مستوى **العملية داخل الصفحة**.
8. بعض API Routes تستخدم Service Role بعد تحقق ناقص، وبالتالي إخفاء الصفحة أو الزر لا يكفي أمنيًا.

الهدف من RBAC v2 هو توحيد كل ذلك في مصدر مركزي واحد.

---

## 3) المبادئ غير القابلة للتفاوض

### 3.1 Default Deny

إذا لم توجد صلاحية صريحة للعملية، فالنتيجة `DENY`.

لا يوجد افتراض Admin عند فشل قراءة Profile.

لا يوجد:

```ts
callerLevel = 1
```

كـ fallback لأي مستخدم غير معروف أو خطأ اتصال.

الفشل في التعرف على المستخدم = رفض العملية.

### 3.2 Backend is authoritative

إخفاء زر أو صفحة هو UX فقط.

كل عملية حساسة يجب أن يتم التحقق منها على الخادم قبل استخدام `SUPABASE_SERVICE_ROLE_KEY`.

### 3.3 لا يوجد Role جديد يحتاج Deploy

إنشاء Role أو تعديله أو تعطيله يتم من Settings ويخزن في قاعدة البيانات.

### 3.4 المستخدم يمكن أن يحمل أكثر من Role

مثال:

- مدير إدارة صحية
- + عضو لجنة اعتماد مخالفات

الصلاحيات الناتجة = مجموع صلاحيات الأدوار، مع تطبيق User Deny Overrides في النهاية.

### 3.5 لا Privilege Escalation

المستخدم الذي يملك صلاحية إدارة الأدوار لا يجوز أن يمنح Permission لا يمتلك حق منحها أو خارج نطاقه الإداري.

Superadmin فقط يستطيع منح صلاحيات وطنية غير مقيدة.

---

## 4) كلمة المرور الأولية الموحدة

الخطة الحالية مقبولة تشغيليًا لكثرة الموظفين بشرط تطبيق القاعدة التالية على الخادم:

إذا كان:

```ts
user.user_metadata.must_change_password === true
```

فيسمح فقط بالعمليات التالية:

- تسجيل الدخول
- `/api/user/change-password`
- تسجيل الخروج
- endpoint بسيط لقراءة حالة الجلسة إن لزم

وأي API آخر يعيد:

```json
{
  "error": "PASSWORD_CHANGE_REQUIRED"
}
```

مع HTTP `403`.

يجب ألا يعتمد المنع على الـ Overlay الموجود في الواجهة وحده.

### مطلوب إنشاء Helper مركزي

مثلاً:

```ts
requireAuthenticatedUser()
requirePasswordChanged()
```

ويستخدمان داخل Permission Engine.

> لا تغير حاليًا استراتيجية توزيع الحسابات ولا نظام الصور ضمن مشروع RBAC v2.

---

# 5) نموذج البيانات الجديد

## 5.1 جدول permissions

مصدر الحقيقة لكل العمليات التي يمكن منحها.

```sql
create table if not exists public.permissions (
  key text primary key,
  module text not null,
  action text not null,
  display_name_ar text not null,
  description_ar text,
  is_sensitive boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
```

أمثلة Key:

```text
missions.view
missions.create
missions.edit
missions.assign
missions.approve
missions.execute
missions.close
missions.delete
```

لا تخزن Permission Keys داخل TypeScript فقط. يمكن وجود Registry TypeScript للتطوير والـ typing، لكن قاعدة البيانات هي المصدر القابل للإدارة.

---

## 5.2 جدول roles

```sql
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  description_ar text,
  owner_organization_id uuid null references public.organizations(id) on delete set null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  priority integer not null default 100,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### معنى owner_organization_id

- `NULL`: Role مركزي/عام على مستوى المنظومة.
- Organization ID: Role محلي تابع لجهة بعينها.

هذا يسمح لاحقًا لمديرية أو قطاع بإنشاء Role محلي دون التأثير على بقية الوزارة، وفق صلاحيات الإدارة المفوضة.

---

## 5.3 Permission Scope

أنشئ Enum أو CHECK بالقيم التالية:

```text
self
assigned
organization
organization_tree
governorate
sector
national
```

المعنى:

- `self`: سجلات الموظف نفسه فقط.
- `assigned`: السجلات المسندة إليه فقط.
- `organization`: الجهة المباشرة فقط.
- `organization_tree`: الجهة وكل الجهات التابعة لها.
- `governorate`: المحافظة التابعة للمستخدم.
- `sector`: القطاع بالكامل.
- `national`: مستوى الجمهورية/الوزارة بالكامل.

---

## 5.4 role_permission_grants

```sql
create table if not exists public.role_permission_grants (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  scope_type text not null default 'organization',
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);
```

كل Permission داخل Role يمكن أن يكون لها Scope مستقل.

مثال:

Role: مدير مديرية

```text
missions.view       -> governorate
missions.create     -> governorate
missions.approve    -> governorate
users.view          -> governorate
users.edit          -> organization_tree
settings.roles.manage -> DENIED (غير موجودة أصلًا)
```

---

## 5.5 user_roles

```sql
create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assignment_org_id uuid null references public.organizations(id) on delete set null,
  valid_from timestamptz,
  valid_until timestamptz,
  assigned_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
```

`assignment_org_id` مفيد للجان أو المهام الخاصة التي تعطى لموظف خارج دوره الأساسي.

---

## 5.6 user_permission_overrides

```sql
create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.users(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  effect text not null check (effect in ('allow', 'deny')),
  scope_type text null,
  reason text,
  granted_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);
```

### أولوية Overrides

الترتيب:

1. User `deny` = يمنع العملية مهما كان الـ Role.
2. User `allow` = يسمح إذا كان المسؤول الذي منحه مخولًا بذلك.
3. Role Grants.
4. عدم وجود Grant = Deny.

---

## 5.7 Access Audit Log

ضروري للمنظومة الحكومية.

```sql
create table if not exists public.access_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  target_user_id uuid references public.users(id) on delete set null,
  target_role_id uuid references public.roles(id) on delete set null,
  details jsonb,
  created_at timestamptz not null default now()
);
```

يسجل على الأقل:

- إنشاء Role
- تعديل Role
- تعطيل Role
- منح Role لمستخدم
- سحب Role
- إضافة Override
- حذف Override
- تغيير Scope

---

# 6) Permission Registry المقترح

## Dashboard

```text
dashboard.view
```

## Missions

```text
missions.view
missions.create
missions.edit
missions.assign
missions.approve
missions.reject
missions.execute
missions.change_destination
missions.review
missions.close
missions.delete
missions.export
missions.view_all_details
```

## Mission Results

```text
mission_results.view
mission_results.write
mission_results.replace
mission_results.delete
```

`mission_results.write/replace/delete` يجب دائمًا أن تتحقق أيضًا من أن المأمورية داخل Scope المستخدم وأن حالة المأمورية تسمح بالتعديل.

## Violations

```text
violations.view
violations.create
violations.edit
violations.assign
violations.correct
violations.verify
violations.close
violations.delete
violations.export
```

## Facilities

```text
facilities.view
facilities.create
facilities.edit
facilities.deactivate
facilities.export
```

## Organizations

```text
organizations.view
organizations.create
organizations.edit
organizations.deactivate
organizations.manage_capabilities
```

## Users

```text
users.view
users.create
users.edit
users.deactivate
users.reset_password
users.assign_roles
users.manage_overrides
users.export
```

## Checklists

```text
checklists.view
checklists.use
checklists.create
checklists.edit
checklists.delete
checklists.publish
checklists.manage_weights
```

## Mission Targets

```text
targets.view
targets.create
targets.edit
targets.delete
targets.report
```

## Leadership Plan

```text
leadership_targets.view
leadership_targets.create
leadership_targets.edit
leadership_targets.delete
leadership_targets.report
```

## Settings / Security

```text
settings.view
settings.roles.view
settings.roles.manage
settings.permissions.view
settings.permissions.manage
settings.user_access.manage
settings.organization_structure.manage
settings.diagnostics.view
settings.audit.view
```

---

# 7) الصفحات لا تكفي — Action Level Permissions

مثال صفحة المأموريات:

لا تستخدم:

```ts
if (level <= 6) showCreateButton()
```

استخدم:

```tsx
<Can permission="missions.create">
  <CreateMissionButton />
</Can>
```

لكن هذا فقط للواجهة.

Endpoint إنشاء المأمورية يجب أيضًا أن يستدعي:

```ts
await requirePermission('missions.create', context)
```

وبالتالي حتى لو استدعى مستخدم API يدويًا فلن ينجح.

---

# 8) Organization Capabilities الحالية لا تُحذف

الحقول الحالية مثل:

```text
can_issue_missions
can_approve_missions
can_view_all_governorate
can_view_sector_facilities
```

تصف **قدرات الجهة التنظيمية نفسها** وليس Role المستخدم.

احتفظ بها.

ويصبح القرار النهائي مثلًا لإنشاء مأمورية:

```text
User has missions.create
AND
User resource scope includes target organization/facility
AND
User organization can_issue_missions = true
```

وللاعتماد:

```text
User has missions.approve
AND
Target mission is inside user scope
AND
Relevant organization can_approve_missions = true
```

هذا التصميم يسمح بأن يكون نفس Role موجودًا في جهتين، لكن جهة تسمح بالاعتماد والأخرى لا تسمح.

---

# 9) Permission Engine مركزي

أنشئ مجلدًا جديدًا:

```text
src/lib/authz/
```

والملفات:

```text
src/lib/authz/types.ts
src/lib/authz/permission-registry.ts
src/lib/authz/server-context.ts
src/lib/authz/authorize.ts
src/lib/authz/scope.ts
src/lib/authz/client.ts
```

## server-context.ts

مسؤول عن:

1. قراءة Supabase Auth user.
2. رفض المستخدم غير المسجل.
3. قراءة `users` profile.
4. رفض profile غير الموجود أو `is_active=false`.
5. تطبيق `must_change_password` gate.
6. تحميل Roles وPermissions وOverrides.
7. إرجاع Access Context موحد.

شكل مقترح:

```ts
type AccessContext = {
  authUserId: string
  userId: string
  email: string | null
  orgLevel: number
  organizationId: string | null
  sectorId: string | null
  governorate: string | null
  healthAdmin: string | null
  permissions: Map<string, EffectiveGrant>
}
```

## authorize.ts

يوفر:

```ts
requireAuthenticatedUser()
requirePermission(permissionKey, options?)
hasPermission(context, permissionKey)
```

مثال:

```ts
const ctx = await requirePermission('organizations.edit')
```

## scope.ts

يوفر دوال مثل:

```ts
isMissionInScope(ctx, mission)
isUserInScope(ctx, targetUser)
isFacilityInScope(ctx, facility)
isOrganizationInScope(ctx, organization)
```

ممنوع نسخ منطق Scope داخل كل Route.

---

# 10) Middleware الجديد

Middleware لا يجب أن يحمل كل منطق الأعمال.

وظيفته:

1. التحقق من Session.
2. إجبار تغيير كلمة المرور.
3. التحقق من Permission الخاصة بفتح الصفحة فقط.

مثال Mapping:

```ts
const routePermissions = {
  '/dashboard': 'dashboard.view',
  '/dashboard/missions': 'missions.view',
  '/dashboard/violations': 'violations.view',
  '/dashboard/facilities': 'facilities.view',
  '/dashboard/organizations': 'organizations.view',
  '/dashboard/users': 'users.view',
  '/dashboard/checklists': 'checklists.view',
  '/dashboard/targets': 'targets.view',
  '/dashboard/targets/report': 'targets.report',
  '/dashboard/leadership-plan': 'leadership_targets.view',
  '/dashboard/settings': 'settings.view',
}
```

### مهم

ألغِ الاعتماد على:

```ts
allowedPagesOverride = null
getRoleNavigation(role)
```

كمصدر نهائي للصلاحيات.

`getRoleNavigation()` يبقى فقط كـ Legacy Fallback أثناء مرحلة الانتقال، ثم يزال.

---

# 11) API Authorization

أنشئ قاعدة موحدة:

> لا يجوز إنشاء Service Role Client قبل التحقق من هوية المتصل وصلاحيته إلا إذا كان الكود داخليًا بحتًا ولا يعتمد على Request مستخدم.

النمط المطلوب:

```ts
export async function PUT(request: Request) {
  const ctx = await requirePermission('organizations.edit')
  const body = await request.json()

  const target = await loadOrganization(body.id)
  assertOrganizationScope(ctx, target)

  const admin = getServiceRoleClient()
  // perform mutation
}
```

وليس:

```ts
const admin = getServiceRoleClient()
// mutate by id
```

مع تحقق Session فقط.

---

# 12) أول Routes يجب تحويلها

ترتيب الأولوية:

## P0 — قبل أي تطوير إضافي

1. `src/app/api/missions/results/route.ts`
   - GET: `mission_results.view`
   - POST/PUT/replace: `mission_results.write` أو `mission_results.replace`
   - DELETE إن وجد: `mission_results.delete`
   - تحقق من Mission Scope قبل أي Service Role query/mutation.

2. `src/app/api/admin/organizations/route.ts`
   - GET: `organizations.view`
   - POST: `organizations.create`
   - PUT: `organizations.edit` أو `organizations.manage_capabilities` حسب الحقول.
   - DELETE: `organizations.deactivate`

3. `src/app/api/admin/checklists/route.ts`
   - GET: `checklists.view`
   - add criterion/section/template: `checklists.create` أو `checklists.edit`
   - delete: `checklists.delete`
   - auto balance: `checklists.manage_weights`

4. `src/app/api/admin/leadership-targets/route.ts`
   - GET: `leadership_targets.view`
   - POST: `leadership_targets.create`
   - PATCH: `leadership_targets.edit`
   - DELETE: `leadership_targets.delete`

5. `src/app/api/admin/mission-targets/route.ts`
   - GET: `targets.view`
   - POST: `targets.create`
   - PATCH: `targets.edit`
   - DELETE: `targets.delete`

## P1

6. `create-user`
   - `users.create`

7. `update-user`
   - `users.edit`
   - إذا تغيرت Roles/Overrides استخدم صلاحيات مستقلة.

8. `reset-password`
   - `users.reset_password`

---

# 13) شاشة Settings الجديدة

استبدل مفهوم "صلاحيات الصفحات" فقط بـ 4 تبويبات واضحة.

## 13.1 إدارة الأدوار

يعرض:

- اسم الدور
- الوصف
- Global / Local
- الجهة المالكة إن كان Local
- عدد المستخدمين
- حالة الدور

الأزرار:

- إنشاء Role
- نسخ Role
- تعديل
- تعطيل
- عرض الموظفين

لا يتم حذف Role عليه مستخدمون حذفًا نهائيًا. استخدم `is_active=false` أو اطلب نقل المستخدمين أولًا.

## 13.2 مصفوفة صلاحيات Role

التصميم:

```text
المأموريات
[✓] مشاهدة
[✓] إنشاء
[✓] إسناد
[ ] اعتماد
[ ] حذف

نطاق مشاهدة المأموريات: [الجهة وكل التابعين ▼]
نطاق إنشاء المأموريات: [المحافظة ▼]
```

## 13.3 صلاحيات الموظف

عند اختيار موظف، اعرض:

- المستوى التنظيمي
- الجهة
- Roles الحالية
- Effective Permissions
- Overrides

ويستطيع المسؤول:

- Assign Role
- Remove Role
- Add explicit Deny
- Add explicit Allow إذا كان مخولًا
- تحديد مدة Role مؤقتة `valid_until`

## 13.4 سجل الحوكمة

يعرض من `access_admin_audit`:

- من قام بالتغيير
- ماذا غيّر
- المستخدم/الدور المتأثر
- الوقت
- التفاصيل قبل/بعد إن أمكن

---

# 14) Effective Permissions Preview

هذه ميزة مهمة جدًا للمسؤول.

قبل حفظ تغييرات مستخدم، اعرض:

```text
المستخدم: أحمد محمد
المستوى التنظيمي: 6
الجهة: إدارة صحة ...

الأدوار:
- مدير إدارة صحية
- عضو لجنة تصويب

النتيجة النهائية:
✓ missions.view — organization_tree
✓ missions.create — organization
✓ violations.view — organization_tree
✓ violations.correct — organization_tree
✗ violations.delete
✗ users.create
```

هذا يمنع أخطاء توزيع الصلاحيات عند وجود آلاف المستخدمين.

---

# 15) Navigation ديناميكي

لا تخزن قائمة الصفحات في Cookie.

بعد تسجيل الدخول، تحمل الواجهة Effective Permissions من Endpoint مثل:

```text
GET /api/me/access
```

Response مثال:

```json
{
  "user": {
    "id": "...",
    "orgLevel": 6,
    "organizationId": "..."
  },
  "roles": [
    { "code": "health_admin_manager", "name": "مدير إدارة صحية" }
  ],
  "permissions": {
    "dashboard.view": { "scope": "organization" },
    "missions.view": { "scope": "organization_tree" },
    "missions.create": { "scope": "organization" }
  }
}
```

ومنها يتم بناء القائمة.

### Mapping Navigation

- Dashboard يظهر إذا `dashboard.view`
- Missions إذا `missions.view`
- Violations إذا `violations.view`
- Facilities إذا `facilities.view`
- Organizations إذا `organizations.view`
- Users إذا `users.view`
- Checklists إذا `checklists.view`
- Leadership Plan إذا `leadership_targets.view`
- Targets إذا `targets.view`
- Targets Report إذا `targets.report`
- Settings إذا `settings.view`

---

# 16) Client Component موحد

أنشئ:

```tsx
<Can permission="missions.approve">
  <ApproveButton />
</Can>
```

وHook:

```ts
const { can, scopeFor } = useAccess()

if (can('missions.create')) { ... }
```

لا تكرر Checks مثل:

```ts
level <= 4
role === 'superadmin'
role !== 'inspector'
```

في Components الجديدة.

---

# 17) ترحيل المستخدمين الحاليين بدون كسر النظام

## المرحلة A — Additive Migration فقط

لا تحذف:

- `level`
- `org_level`
- `role_permissions` القديمة
- `user_permissions` القديمة
- `roleDefinitions`

أنشئ جداول v2 وأدخل البيانات فقط.

## المرحلة B — Seed Default Roles

أنشئ Roles نظامية تعكس السلوك الحالي تقريبًا:

```text
system_superadmin
system_techadmin
sector_manager
central_admin_manager
general_admin_manager
directorate_manager
health_admin_manager
field_inspector
```

### Mapping مبدئي

```text
org_level 0 -> system_techadmin
org_level 1 -> system_superadmin
org_level 2 -> sector_manager
org_level 3 -> central_admin_manager
org_level 4 -> general_admin_manager
org_level 5 -> directorate_manager
org_level 6 -> health_admin_manager
org_level 7 -> field_inspector
```

هذا Mapping يستخدم **مرة واحدة للترحيل**، وليس مصدر الصلاحيات بعد ذلك.

## المرحلة C — user_permissions القديمة

إذا كان للمستخدم `allowed_pages` مخصصة، حولها إلى User Overrides.

قاعدة آمنة:

إذا تم استبعاد صفحة في Legacy Override، أنشئ `deny` لكل Permissions الخاصة بالموديول، وليس فقط `*.view`.

مثال المستخدم لا يحتوي `users` في allowed_pages:

```text
DENY users.view
DENY users.create
DENY users.edit
DENY users.deactivate
DENY users.reset_password
DENY users.assign_roles
DENY users.manage_overrides
DENY users.export
```

هذا يجعل السلوك الجديد أكثر أمانًا من مجرد إخفاء الصفحة.

---

# 18) التوافق أثناء الانتقال

استخدم Feature Flag:

```text
RBAC_V2_ENABLED=false
```

ثم:

```text
RBAC_V2_ENABLED=true
```

في Staging أولًا.

أثناء الانتقال:

```ts
if (RBAC_V2_ENABLED) {
  return v2PermissionEngine(...)
}
return legacyRoleCheck(...)
```

لكن لا تترك Dual Mode دائمًا. بعد نجاح الترحيل احذف Legacy Authorization Logic تدريجيًا.

---

# 19) Scope Resolver

لا تعتمد فقط على رقم المستوى.

اعتمد على حقائق المستخدم:

```text
user.organization_id
user.sector_id
organization.parent_id
organization.governorate
organization.health_admin
```

أنشئ Helper واحد لمسار الهيكل التنظيمي.

### مثال organization_tree

إذا كان المستخدم في إدارة صحية، يرى الجهة والوحدات التابعة لها.

إذا كان في قطاع، يرى القطاع وفروعه التنظيمية فقط.

استخدم Recursive CTE أو دالة PostgreSQL آمنة لاسترجاع descendants بدل كتابة شروط متفرقة في كل Route.

مثال دالة:

```sql
get_organization_descendants(root_org_id uuid)
```

---

# 20) قواعد منع التصعيد الإداري

عند Assign Role لمستخدم:

1. المسؤول يجب أن يملك `users.assign_roles`.
2. المستخدم الهدف يجب أن يكون داخل Scope المسؤول.
3. Role الهدف يجب أن يكون مسموحًا للمسؤول بمنحه.
4. Scope الناتج لا يجوز أن يكون أوسع من Scope المسؤول.
5. Local Role لا يعطى خارج `owner_organization_id` أو شجرتها إلا بواسطة Superadmin.
6. لا يستطيع مستخدم منح نفسه Role أعلى.
7. كل العملية تسجل في Audit Log.

---

# 21) RLS

RBAC v2 لا يعني إلغاء RLS.

استخدم طبقتين:

### Layer 1 — Application Authorization

`requirePermission()` في API.

### Layer 2 — Database RLS

لحماية Client Direct Access وأخطاء البرمجة.

### مهم جدًا

Service Role يتجاوز RLS، لذلك أي Route يستخدمه يجب أن ينفذ Permission + Scope check قبل query/mutation الحساسة.

### SECURITY DEFINER

إذا أنشأت Functions مثل:

```text
has_permission(permission_key)
```

يجب:

- تحديد `search_path` بشكل صريح.
- عدم بناء SQL من نص المستخدم.
- عدم السماح للمستخدم بتغيير الجداول المصدر.
- استخدام owner آمن.

---

# 22) التخلص من Cookies الخاصة بالصلاحيات

احذف تدريجيًا الاعتماد على:

```text
maamouriyat_dynamic_permissions
maamouriyat_user_permissions
maamouriyat_user_role
```

Cookies ليست مصدر الصلاحيات.

المصدر: قاعدة البيانات + Supabase Auth Session.

يمكن Cache النتيجة في الواجهة للسرعة، لكن لا تُعتبر Authority.

---

# 23) Performance مع آلاف الموظفين

لا تحمل جميع Roles/Permissions لجميع المستخدمين في كل Request.

Request خاص بمستخدم واحد فقط يحتاج:

- Profile واحد
- user_roles الخاصة به
- role grants الخاصة بأدواره
- user overrides الخاصة به

أضف Indexes:

```sql
create index on user_roles(user_id);
create index on role_permission_grants(role_id);
create index on role_permission_grants(permission_key);
create index on user_permission_overrides(user_id);
create index on roles(owner_organization_id);
```

يمكن لاحقًا إضافة Cache قصير أو View/RPC، لكن لا تبدأ بنظام Cache معقد قبل قياس الأداء.

---

# 24) الملفات الموجودة التي يجب تعديلها

أولوية مباشرة:

```text
src/lib/roles.ts
src/middleware.ts
src/components/system-ui.tsx
src/app/dashboard/settings/settings-portal.tsx
src/app/dashboard/users/user-portal.tsx
src/app/api/admin/checklists/route.ts
src/app/api/admin/organizations/route.ts
src/app/api/admin/mission-targets/route.ts
src/app/api/admin/leadership-targets/route.ts
src/app/api/admin/create-user/route.ts
src/app/api/admin/update-user/route.ts
src/app/api/admin/reset-password/route.ts
src/app/api/missions/results/route.ts
src/app/api/user/change-password/route.ts
```

بالإضافة إلى Migration SQL جديدة مستقلة.

لا تعدّل `schema.sql` القديم فقط بدون Migration؛ النظام الحالي لديه تاريخ migrations وبيئة قائمة بالفعل.

أنشئ ملفًا مثل:

```text
scripts/17-dynamic-rbac-v2.sql
```

وإن احتاج مرحلة ثانية:

```text
scripts/18-rbac-v2-migrate-users.sql
scripts/19-rbac-v2-rls.sql
```

---

# 25) لا تعيد كتابة Settings بالكامل دفعة واحدة

نفذ بالتدرج:

### المرحلة 1

Backend + DB فقط.

### المرحلة 2

اجعل Navigation يقرأ v2.

### المرحلة 3

أضف `<Can>` للأزرار الحساسة.

### المرحلة 4

أضف Role Manager الجديد.

### المرحلة 5

أزل Legacy permissions/cookies.

هذا يقلل احتمال كسر واجهة ضخمة مثل Settings Portal.

---

# 26) مثال Roles حقيقية يمكن إنشاؤها من داخل المنظومة

بعد التنفيذ لا نحتاج تعديل كود لإنشاء:

### مسؤول تصويب مخالفات

```text
violations.view
violations.correct
```

Scope: `organization_tree`

### عضو لجنة اعتماد

```text
missions.view
missions.review
missions.approve
violations.view
violations.verify
```

### مدخل بيانات منشآت

```text
facilities.view
facilities.create
facilities.edit
```

بدون:

```text
missions.*
users.*
settings.*
```

### مراقب قراءة فقط

```text
dashboard.view
missions.view
violations.view
facilities.view
targets.view
targets.report
```

ولا يملك أي Create/Edit/Delete.

### مسؤول مستهدفات

```text
targets.view
targets.create
targets.edit
targets.report
```

### مراجع مالي

يمكن إنشاء Role مستقل تمامًا عن المستوى التنظيمي وإسناده لمن يحتاجه.

---

# 27) اختبار إلزامي قبل تفعيل RBAC v2

أنشئ Integration Tests أو E2E Tests للحالات التالية:

1. مستخدمان بنفس `org_level=6` لكن Role مختلف -> تظهر لهما صفحات وعمليات مختلفة.
2. مستخدم Role يسمح `violations.view` فقط -> لا يستطيع POST/PUT/Delete حتى لو استدعى API يدويًا.
3. مستخدم يحمل Roleين -> يحصل على Union للصلاحيات.
4. User DENY Override يتغلب على Role Allow.
5. مستخدم `must_change_password=true` -> كل API حساس يعيد 403.
6. Inspector لا يستطيع قراءة/تعديل Mission خارج Scope حتى لو عرف UUID.
7. مسؤول مديرية لا يستطيع تعديل مستخدم في محافظة أخرى.
8. مسؤول قطاع لا يستطيع إنشاء Local Role في قطاع آخر.
9. Role جديد يتم إنشاؤه من Settings ويعمل بدون Deploy.
10. تعطيل Role يمنع أثره فورًا على المستخدمين.
11. UI يخفي زر العملية وAPI يرفضها أيضًا.
12. فشل قراءة Profile لا يجعل المستخدم Admin.
13. Organization capability=false تمنع العملية حتى لو المستخدم يمتلك Permission.
14. تغيير Role أو Override ينشئ Audit record.

---

# 28) Definition of Done

لا تعتبر المهمة مكتملة إلا إذا تحقق التالي:

- [ ] Level 1–7 أصبح Organizational Context فقط، وليس المصدر الوحيد للصلاحيات.
- [ ] يمكن إنشاء Role جديد من المنظومة بدون تعديل كود.
- [ ] يمكن تعديل Permissions وScope لأي Role.
- [ ] يمكن Assign أكثر من Role لمستخدم.
- [ ] يمكن عمل Allow/Deny Override لمستخدم.
- [ ] Navigation يعتمد على Effective Permissions.
- [ ] الأزرار الحساسة تعتمد على Permissions.
- [ ] كل API حساس يطبق Permission + Scope.
- [ ] Service Role لا يستخدم قبل Authorization مناسب في Routes الحساسة.
- [ ] `must_change_password` enforced server-side.
- [ ] Cookies ليست Authority للصلاحيات.
- [ ] Organization Capabilities تعمل بالتقاطع مع User Permissions.
- [ ] Audit Log يعمل.
- [ ] المستخدمون الحاليون تم ترحيلهم تلقائيًا ولا يفقدون وصولهم المتوقع.
- [ ] يوجد Rollback/Feature Flag قبل إزالة Legacy.
- [ ] اختبارات حالات التصعيد والصلاحيات تمر بنجاح.

---

# 29) ترتيب التنفيذ المطلوب من Antigravity

نفذ بالترتيب التالي **ولا تبدأ من الواجهة**:

1. قراءة المشروع كاملًا وفهم جداول `users`, `organizations`, `user_permissions`, `role_permissions` الحالية.
2. إنشاء Migration RBAC v2 additive فقط.
3. Seed Permission Registry.
4. Seed System Roles المكافئة للسلوك الحالي.
5. Migration المستخدمين الحاليين إلى `user_roles`.
6. Migration `user_permissions.allowed_pages` القديمة إلى Overrides آمنة.
7. إنشاء `src/lib/authz/*` Permission Engine.
8. إضافة Server-side password-change gate.
9. تحويل Routes P0 إلى `requirePermission + scope check`.
10. إنشاء `/api/me/access`.
11. ربط Navigation بـ Effective Permissions.
12. إنشاء `<Can>` و`useAccess`.
13. تحديث Settings إلى Role Manager + User Access Manager.
14. تحويل باقي APIs.
15. إضافة Audit UI.
16. كتابة Tests.
17. تفعيل `RBAC_V2_ENABLED` في بيئة اختبار.
18. اختبار حسابات حقيقية من Levels مختلفة.
19. بعد النجاح فقط إزالة Legacy Cookies والمنطق الثابت تدريجيًا.

---

# 30) تعليمات مهمة لـ Antigravity

- لا تحذف أو تغير بيانات المستخدمين الحالية.
- لا تغير البريد أو طريقة إنشاء الحسابات الآن.
- لا تغير نظام الصور/storage ضمن هذه المهمة.
- لا تستبدل الهيكل التنظيمي الحالي.
- لا تعيد بناء النظام من الصفر.
- لا تعتمد على الواجهة للحماية.
- لا تجعل أي Auth/Profile failure يعود بصلاحية أعلى.
- لا تستخدم level checks جديدة إذا كان يمكن التعبير عنها Permission.
- Level يمكن استخدامه في Migration أو تحديد الهيكل/Scope، وليس كـ authorization shortcut جديد.
- لا تنفذ تغييرات destructive قبل وجود migration/rollback واضح.
- نفذ Commits صغيرة حسب المرحلة، مع وصف ما تم اختباره في كل Commit.

---

## النتيجة المستهدفة

بعد اكتمال هذه الخطة، يصبح بالإمكان من داخل النظام إنشاء Role مثل:

> **مراجع المخالفات — مديرية القاهرة**

ومنحه فقط:

```text
violations.view
violations.correct
```

بنطاق:

```text
governorate
```

ثم إسناده لأي موظف مناسب مهما كان مستواه التنظيمي، بدون تعديل TypeScript أو نشر نسخة جديدة من البرنامج.

وفي نفس الوقت يظل المستوى التنظيمي للموظف محفوظًا ويستمر في تحديد موضعه الإداري ونطاق البيانات الممكن منحه له.

هذا هو النموذج المستهدف: **Dynamic RBAC + Fine-Grained Permissions + Data Scope + Organization Capabilities + User Overrides + Audit**.
