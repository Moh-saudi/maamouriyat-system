# Maamouriyat System — Rebuild V2 Master Plan

> هذا الملف هو المرجع الرئيسي لإعادة بناء المنظومة قبل الإنتاج.
> التنفيذ يتم على مراحل صغيرة، ولا يسمح لـ Antigravity بدمج مرحلتين في جلسة واحدة.

## 1. القرار

سنقوم بإعادة بناء **الواجهة، بنية التطبيق، طبقة البيانات، والمصادقة/الصلاحيات** بشكل منظم، مع الاحتفاظ بمنطق العمل والبيانات المفيدة الموجودة حاليًا.

لا يتم مسح المشروع القديم مباشرة. أثناء التطوير يبقى النظام الحالي مرجعًا للسلوك، ويتم بناء V2 بالتوازي ثم يتم القطع النهائي بعد اكتمال الاختبارات.

### لماذا؟

الوضع الحالي يحتوي على:

- ملف `src/app/system-ui.tsx` ضخم جدًا ويجمع مسؤوليات كثيرة في مكان واحد.
- تصميم Desktop وMobile غير موحد؛ القائمة الجانبية والـ bottom navigation يتداخلان على الهاتف.
- CSS مخصص يدويًا أكثر من اللازم، ولا توجد مكتبة UI مركزية.
- مكونات الصفحات كبيرة وغير قابلة لإعادة الاستخدام بسهولة.
- الصلاحيات مرتبطة في مواضع كثيرة بالمستويات 1–7 بدل محرك صلاحيات مركزي.
- الوصول إلى Supabase يتم في عدة أماكن من الواجهة مباشرة؛ وهذا سيصعب الانتقال لاحقًا إلى الخادم الحكومي.

## 2. ما الذي سنحتفظ به؟

نحتفظ بـ:

- فكرة الهيكل التنظيمي ومستوياته 1–7.
- نموذج الجهات والمنشآت والمأموريات والمخالفات والمستهدفات وقوائم الفحص.
- بيانات Supabase الحالية خلال مرحلة التطوير.
- منطق `must_change_password` مع تقويته Server-side.
- أي استعلامات/وظائف صحيحة بعد مراجعتها.
- الشعار والهوية الرسمية والألوان الحكومية المناسبة.

ولا ننقل تصميم الواجهة القديمة حرفيًا إلى V2.

## 3. التقنية القياسية المقترحة لـ V2

### Frontend

- Next.js App Router.
- TypeScript strict.
- React 19.
- Tailwind CSS v4.
- HeroUI v3 (`@heroui/react` + `@heroui/styles`).
- Lucide React للأيقونات.
- Recharts للرسوم الحالية، مع تغليفها داخل مكونات خاصة بالمنظومة.

> HeroUI v3 هو الخيار المقصود في V2، وليس نسخ Components يدويًا من النظام القديم.

### Backend / Data

خلال التطوير يبقى Supabase، لكن **لا يسمح لمكونات الواجهة بالتعامل المباشر مع Supabase** إلا داخل طبقة Adapter محددة.

المطلوب بنية قابلة لاستبدال Supabase لاحقًا بخادم الوزارة:

```text
UI / Features
    ↓
Application Services
    ↓
Repository Interfaces
    ↓
Supabase Adapter (الآن)
Government Server Adapter (لاحقًا)
```

أي Page أو Button لا يجب أن يعرف `supabase.from(...)` مباشرة.

## 4. هيكل المجلدات المستهدف

```text
src/
  app/
    v2/
      (auth)/
      (protected)/
        dashboard/
        missions/
        violations/
        facilities/
        organizations/
        users/
        targets/
        checklists/
        settings/
  components/
    ui/                 # wrappers / shared HeroUI components
    layout/             # app shell, sidebar, topbar, mobile nav
    feedback/           # empty/error/loading states
  features/
    auth/
    dashboard/
    missions/
    violations/
    facilities/
    organizations/
    users/
    targets/
    checklists/
  server/
    auth/
    authorization/
    repositories/
    services/
    supabase/
  domain/
    mission/
    violation/
    facility/
    organization/
    user/
    target/
  config/
    navigation.ts
    permissions.ts
    branding.ts
  lib/
    utils/
    validation/
```

أثناء إعادة البناء تكون مسارات V2 تحت `/v2` حتى لا نكسر النظام الحالي. القطع النهائي يتم في آخر مرحلة فقط.

## 5. تصميم Navigation الجديد

### Desktop >= 1024px

- Sidebar ثابت على اليمين RTL.
- عرض مفتوح تقريبًا 272–288px.
- يمكن Collapse إلى 72–80px.
- الشعار والاسم الرسمي أعلى القائمة بدون بطاقة ضخمة.
- العناصر مقسمة لمجموعات واضحة.
- العنصر النشط واضح بدون زحام borders.
- Sidebar له scroll مستقل فقط إذا لزم.
- المحتوى الرئيسي لا يتحرك أسفل sidebar ولا يحدث horizontal overflow.
- Topbar بسيط: عنوان الصفحة، breadcrumbs اختياري، إشعارات، حساب المستخدم.

### Tablet 768–1023px

- Sidebar collapsed أو Drawer حسب المساحة.
- لا نعرض Sidebar كامل + Bottom navigation معًا.

### Mobile < 768px

**ممنوع استخدام Sidebar دائم.**

- Top App Bar صغير.
- Bottom Navigation بحد أقصى 4 وجهات أساسية حسب صلاحيات المستخدم.
- العنصر الخامس: `المزيد` يفتح HeroUI Drawer/Modal/Sheet لباقي الصفحات.
- بيانات المستخدم تفتح في Drawer/Popover مناسب للهاتف ولا تحجب نصف الشاشة دون سبب.
- لا يوجد تكرار للـ navigation بين Drawer وBottom nav بشكل مربك.
- صفحات الجداول تتحول إلى Cards أو responsive table patterns.
- جميع الأزرار الأساسية touch-friendly.

## 6. Design System

نريد نظامًا حكوميًا هادئًا وليس Dashboard استعراضيًا.

### قواعد

- خلفية التطبيق محايدة فاتحة.
- اللون الأخضر/التركواز الرسمي Accent وليس خلفية لكل شيء.
- لون الخط الأساسي شديد الوضوح.
- Cards مسطحة نسبيًا، shadows خفيفة جدًا.
- Border radius موحد.
- spacing scale موحد.
- Status colors ثابتة: success/warning/danger/info/neutral.
- لا نستخدم inline styles إلا لحالة استثنائية موثقة.
- لا نكرر CSS لكل صفحة.
- RTL من الجذر.
- دعم 390px كحد أدنى للهاتف.

### Components التي يجب إنشاؤها مرة واحدة

- `AppShell`
- `DesktopSidebar`
- `MobileBottomNav`
- `MoreNavigationSheet`
- `Topbar`
- `UserMenu`
- `PageHeader`
- `SectionCard`
- `StatCard`
- `StatusChip`
- `DataTable`
- `MobileRecordCard`
- `EmptyState`
- `ErrorState`
- `LoadingState`
- `ConfirmDialog`
- `PermissionGate`

## 7. الصلاحيات في V2

المستوى التنظيمي لا يساوي Role.

يبقى `org_level` لوصف موقع الموظف في الهيكل، ويضاف RBAC ديناميكي:

- Roles ديناميكية.
- Fine-grained permissions مثل:
  - `missions.view`
  - `missions.create`
  - `missions.assign`
  - `missions.approve`
  - `missions.execute`
  - `violations.view`
  - `violations.create`
  - `violations.correct`
  - `violations.verify`
  - `facilities.view`
  - `facilities.edit`
  - `users.view`
  - `users.create`
  - `users.assign_role`
  - `checklists.design`
- Data scope:
  - `own`
  - `assigned`
  - `organization`
  - `organization_tree`
  - `governorate`
  - `sector`
  - `national`
- user allow/deny overrides.
- organization capabilities مثل `can_issue_missions` تظل قيدًا إضافيًا.

الـ Backend هو المرجع النهائي؛ إخفاء زر ليس حماية.

## 8. استراتيجية الانتقال إلى الخادم الحكومي

يجب أن تكون V2 جاهزة من البداية للاستبدال:

```text
Supabase Auth      -> Government Identity Provider / Internal Auth
Supabase Database  -> Government PostgreSQL / API
Supabase Storage   -> Government Storage
```

لذلك:

- ممنوع وضع `NEXT_PUBLIC_SUPABASE_*` داخل منطق feature.
- ممنوع استدعاء Supabase من component عشوائي.
- كل access عبر repository/service.
- أنواع Domain لا تعتمد على Supabase-generated types مباشرة.

## 9. مراحل التنفيذ

### Phase 0 — Inventory & Freeze

لا تعديل بصري.

- توثيق جميع routes الحالية.
- توثيق جميع الجداول والعلاقات.
- توثيق workflows: login, create mission, assign, inspect, violation, correction, targets.
- إنشاء قائمة Keep / Rewrite / Delete.

**Stop:** لا يبدأ Phase 1 قبل تسليم تقرير inventory.

### Phase 1 — Foundation

- React 19 + Tailwind v4 + HeroUI v3.
- Theme / RTL / fonts / tokens.
- `src/app/v2` skeleton.
- shared UI foundation.
- لا ربط Business Data.

### Phase 2 — Responsive App Shell

- Desktop sidebar.
- Tablet behavior.
- Mobile topbar + bottom nav + more sheet.
- User menu.
- Placeholder pages فقط.

**ممنوع:** نقل Dashboard القديم في هذه المرحلة.

### Phase 3 — Auth + Authorization + Data Access

- server auth context.
- forced-password Server gate.
- RBAC v2.
- repository interfaces.
- Supabase adapters.
- audit logging.

### Phase 4 — Read-only Modules

ترحيل القراءة أولًا:

1. Organizations
2. Facilities
3. Users directory
4. Dashboard metrics

لا editing في أول pass.

### Phase 5 — Core Mission Workflow

- mission list
- mission details
- create
- assign
- approval
- field execution
- results
- completion

كل Action مربوط Permission صريحًا.

### Phase 6 — Violations / Targets / Checklists

- violations workflow
- correction/verification
- targets
- leadership targets
- checklists builder/execution

### Phase 7 — Administration

- users management
- roles & permissions management
- organization capabilities
- settings
- audit viewer

### Phase 8 — Cutover

- regression tests.
- responsive screenshots.
- performance pass.
- accessibility pass.
- remove `/v2` prefix only after sign-off.
- archive old UI instead of deleting immediately.

## 10. طريقة العمل مع Antigravity

كل Phase يجب أن يكون Task منفصلًا.

في كل Task:

1. اقرأ هذا الملف.
2. اقرأ ملف المرحلة المحدد.
3. لا تعدل ملفات خارج النطاق دون ذكر سبب.
4. لا تبدأ المرحلة التالية.
5. شغّل build/typecheck/lint المتاح.
6. سلّم تقريرًا يحتوي:
   - الملفات التي عدلتها.
   - ما الذي أنجز.
   - ما الذي لم ينجز.
   - المشاكل المتبقية.
   - نتيجة build.
7. Commit واحد أو مجموعة Commits صغيرة باسم واضح.
8. توقف وانتظر المراجعة.

## 11. قواعد تمنع الانحراف

- لا تقم بإعادة تصميم Database أثناء مهمة UI.
- لا تصلح الصلاحيات أثناء مهمة App Shell.
- لا تنقل صفحة ضخمة بالكامل في Commit واحد.
- لا تنسخ `system-ui.tsx` إلى V2.
- لا تستخدم inline style لبناء design system جديد.
- لا تنشئ custom Button/Card/Input إذا HeroUI يغطي الحاجة إلا بسبب موثق.
- لا تستخدم localStorage/cookies كمصدر صلاحيات مركزي.
- لا تستخدم Level check جديدًا بدل Permission Engine.
- لا تستخدم mock data في مكان production data بدون وسم واضح.
- لا تحذف كود V1 قبل اكتمال القطع.

## 12. معايير النجاح النهائية

V2 لا تعتبر جاهزة إلا إذا:

- تعمل بشكل صحيح على 390, 768, 1366, 1920 px.
- لا يوجد horizontal overflow.
- لا يوجد Sidebar دائم على الهاتف.
- Navigation ناتج من permissions لا من hardcoded role names.
- المستخدم ذو صفحة واحدة يرى صفحة واحدة فقط.
- المستخدم متعدد الأدوار يحصل على union صحيح للصلاحيات.
- Deny override يمنع العملية في UI وAPI.
- تغيير كلمة المرور الإجباري يمنع APIs الحساسة Server-side.
- لا توجد Supabase calls مباشرة داخل Feature UI.
- كل العمليات الحساسة تسجل في Audit Log.
- Build ينجح قبل القطع النهائي.
