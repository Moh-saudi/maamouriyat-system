# Phase 0 — Inventory & Freeze

## الهدف

فهم النظام الحالي بالكامل قبل كتابة V2. هذه المرحلة **قراءة وتوثيق فقط** قدر الإمكان.

## تعليمات Antigravity

اقرأ أولاً:

- `docs/rebuild-v2/00-MASTER-PLAN.md`

ثم نفذ هذه المرحلة فقط.

## المطلوب

1. أنشئ `docs/rebuild-v2/inventory/ROUTES.md`
   - كل Route داخل `src/app`.
   - هل هو Server Component أم Client Component إن أمكن.
   - الصفحة/الوظيفة التي يخدمها.

2. أنشئ `docs/rebuild-v2/inventory/API.md`
   - كل API route.
   - Methods.
   - Authentication المستخدمة.
   - هل يستخدم Service Role.
   - ما الجداول التي يقرأ/يعدل عليها.
   - أي level checks أو permission checks موجودة.

3. أنشئ `docs/rebuild-v2/inventory/DATABASE.md`
   - الجداول الحالية.
   - العلاقات المهمة.
   - الجداول المكررة/القديمة المحتملة.
   - migrations/scripts المؤثرة.

4. أنشئ `docs/rebuild-v2/inventory/WORKFLOWS.md`
   وثق بالتسلسل:
   - Login + must_change_password.
   - إنشاء مستخدم.
   - إنشاء مأمورية.
   - إسناد مأمورية.
   - تنفيذ مأمورية ميدانية.
   - تسجيل النتائج.
   - المخالفات والتصويب.
   - المستهدفات.
   - قوائم الفحص.

5. أنشئ `docs/rebuild-v2/inventory/KEEP-REWRITE-DELETE.md`
   وصنف أهم الملفات/features إلى:
   - KEEP
   - REFACTOR
   - REWRITE
   - DELETE LATER

6. أنشئ `docs/rebuild-v2/inventory/RISKS.md`
   - أكبر 20 مخاطرة تقنية قبل الإنتاج.
   - رتبها P0 / P1 / P2.

## ممنوع

- لا تثبت HeroUI.
- لا تغير React.
- لا تغير CSS.
- لا تعيد تصميم صفحة.
- لا تغير schema.
- لا تصلح bug إلا إذا كان يمنعك من قراءة المشروع، وسجل ذلك بوضوح.

## التسليم

Commit documentation only.

في نهاية العمل اطبع تقرير قصير:

- الملفات التي أنشأتها.
- أهم 10 نتائج.
- أي أجزاء لم تستطع تحديدها بثقة.
- STOP. لا تبدأ Phase 1.
