# Phase 1 — V2 Foundation

## شرط البدء

لا تبدأ إلا بعد مراجعة واعتماد مخرجات Phase 0.

اقرأ:

- `docs/rebuild-v2/00-MASTER-PLAN.md`
- ملفات `docs/rebuild-v2/inventory/*`

## الهدف

إنشاء أساس V2 فقط، بدون نقل Business Screens.

## المطلوب

1. ترقية/مواءمة React للإصدار المطلوب المتوافق مع Next الحالي بعد التحقق من compatibility.
2. إضافة Tailwind CSS v4.
3. إضافة HeroUI v3 بالحزم الرسمية اللازمة.
4. إنشاء Theme مركزي يدعم RTL والهوية الحكومية.
5. إنشاء skeleton تحت `src/app/v2`.
6. إنشاء:
   - `src/components/ui`
   - `src/components/layout`
   - `src/components/feedback`
   - `src/config/branding.ts`
   - `src/config/navigation.ts`
7. إنشاء صفحات placeholder فقط لـ:
   - `/v2/dashboard`
   - `/v2/missions`
   - `/v2/violations`
   - `/v2/facilities`
   - `/v2/organizations`
   - `/v2/users`
   - `/v2/targets`
   - `/v2/checklists`
   - `/v2/settings`

## قواعد التصميم

- RTL من الجذر في V2.
- لا inline styles لبناء الواجهة الأساسية.
- استخدم HeroUI للمكونات الأساسية قدر الإمكان.
- لا تنسخ CSS من `system-ui.tsx` أو الواجهة القديمة.
- لا تنقل dashboard الحالي.

## ممنوع

- لا تغير قاعدة البيانات.
- لا تغير APIs.
- لا تغير RBAC.
- لا تنقل business logic.
- لا تحذف V1.

## التحقق

- Build ناجح.
- TypeScript ناجح.
- `/v2/*` يعمل مع placeholders.
- لا تتأثر `/dashboard/*` الحالية.

## التسليم

Commits صغيرة:

1. dependencies/tooling
2. theme/config
3. v2 route skeleton

ثم STOP.
