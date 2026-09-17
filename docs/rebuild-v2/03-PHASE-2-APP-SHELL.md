# Phase 2 — Responsive App Shell

## شرط البدء

لا تبدأ إلا بعد اعتماد Phase 1.

## الهدف

بناء الهيكل البصري العام للمنظومة على Desktop / Tablet / Mobile بدون نقل صفحات العمل الفعلية.

## المطلوب

أنشئ/أكمل المكونات التالية:

- `AppShell`
- `DesktopSidebar`
- `Topbar`
- `UserMenu`
- `MobileBottomNav`
- `MoreNavigationSheet`
- `PageHeader`

## Desktop >= 1024px

- Sidebar RTL ثابت على اليمين.
- عرض مفتوح 272–288px تقريبًا.
- Collapsed 72–80px تقريبًا.
- أقسام Navigation واضحة.
- Active state بسيط وواضح.
- عدم تكرار اسم الوزارة/المستخدم في بطاقات كبيرة.
- Topbar نظيف.
- محتوى الصفحة يأخذ المساحة المتبقية بلا horizontal overflow.

## Tablet 768–1023px

- لا تعرض Sidebar كامل إذا سبب ضغطًا للمحتوى.
- استخدم collapsed rail أو drawer حسب النتيجة الأفضل.

## Mobile < 768px

- لا يوجد Sidebar دائم.
- Topbar صغير.
- Bottom navigation بحد أقصى 4 عناصر رئيسية حسب navigation config.
- عنصر `المزيد` يفتح Sheet/Drawer لبقية العناصر.
- User menu منفصل وواضح.
- القائمة لا تغطي الصفحة افتراضيًا.
- لا تجمع Bottom nav وSidebar في الوقت نفسه.

## Responsive acceptance sizes

اختبر يدويًا على الأقل:

- 390x844
- 768x1024
- 1366x768
- 1920x1080

## Accessibility

- keyboard navigation.
- aria labels للأيقونات غير النصية.
- focus visible.
- tap targets مناسبة للموبايل.

## ممنوع

- لا تنقل Dashboard القديم.
- لا تعمل على charts.
- لا تغير قاعدة البيانات.
- لا تغير APIs.
- لا تبني الصلاحيات في هذه المرحلة.
- استخدم navigation placeholder/config فقط.

## التسليم

- Screenshots للأحجام الأربعة إن كانت البيئة تسمح.
- نتيجة build/typecheck.
- قائمة الملفات المعدلة.
- STOP قبل Phase 3.
