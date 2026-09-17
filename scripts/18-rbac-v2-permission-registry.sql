-- ==============================================================================
-- Script 18: Dynamic RBAC V2 Central Permission Registry Seed
-- Phase: Phase 3B — Dynamic RBAC Database Schema DESIGN ONLY
-- Target Engine: PostgreSQL 15+ / Supabase
--
-- IMPORTANT SAFETY NOTICE:
-- This script contains seed definitions for the canonical permissions registry.
-- It is designed for offline review and MUST NOT be executed against the production
-- database until authorized in Phase 3B.1.
--
-- Features:
-- 1. Idempotent insertion using INSERT ... ON CONFLICT (key) DO UPDATE.
-- 2. Clear, administrative Arabic display names and descriptions.
-- 3. Strict sensitivity classification (is_sensitive = TRUE for destructive/critical ops).
-- 4. Consistent key formatting: lowercase module.action.
-- ==============================================================================

BEGIN;

INSERT INTO public.permissions (
  key,
  module,
  action,
  display_name_ar,
  description_ar,
  is_sensitive,
  is_active,
  sort_order
)
VALUES
  -- ----------------------------------------------------------------------------
  -- Module: Dashboard
  -- ----------------------------------------------------------------------------
  (
    'dashboard.view',
    'dashboard',
    'view',
    'عرض لوحة المؤشرات',
    'السماح بالوصول إلى لوحة المؤشرات والإحصائيات التجميعية العامة',
    FALSE,
    TRUE,
    100
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Missions (المأموريات)
  -- ----------------------------------------------------------------------------
  (
    'missions.view',
    'missions',
    'view',
    'عرض المأموريات',
    'السماح باستعراض سجلات المأموريات وبياناتها الأساسية في نطاق الصلاحية',
    FALSE,
    TRUE,
    200
  ),
  (
    'missions.create',
    'missions',
    'create',
    'إنشاء مأمورية',
    'السماح بإنشاء طلب مأمورية ميدانية جديدة',
    FALSE,
    TRUE,
    210
  ),
  (
    'missions.edit',
    'missions',
    'edit',
    'تعديل المأمورية',
    'السماح بتعديل مسار أو جدول أو تفاصيل مأمورية غير معتمدة',
    FALSE,
    TRUE,
    220
  ),
  (
    'missions.delete',
    'missions',
    'delete',
    'حذف مأمورية',
    'السماح بالحذف النهائي لسجل مأمورية مسودة أو ملغاة',
    TRUE,
    TRUE,
    230
  ),
  (
    'missions.assign',
    'missions',
    'assign',
    'إسناد وتكليف المأمورية',
    'السماح بتكليف وتوزيع أعضاء فرق المرور الميداني على المأموريات',
    FALSE,
    TRUE,
    240
  ),
  (
    'missions.review',
    'missions',
    'review',
    'مراجعة المأموريات',
    'السماح بمراجعة تقارير وبيانات المأموريات قبل أو بعد تنفيذها',
    FALSE,
    TRUE,
    250
  ),
  (
    'missions.approve',
    'missions',
    'approve',
    'اعتماد المأموريات',
    'السماح بالموافقة الرسمية على خطط وأوامر المأموريات قبل انطلاقها',
    FALSE,
    TRUE,
    260
  ),
  (
    'missions.execute',
    'missions',
    'execute',
    'تنفيذ المأمورية ميدانياً',
    'السماح لبدء المرور الميداني وإثبات التواجد وتعبئة الاستبيانات',
    FALSE,
    TRUE,
    270
  ),
  (
    'missions.close',
    'missions',
    'close',
    'إغلاق وإنهاء المأمورية',
    'السماح بالإغلاق الإداري النهائي للمأمورية بعد استيفاء جميع إجراءاتها',
    FALSE,
    TRUE,
    280
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Mission Results (نتائج وتقارير المأموريات)
  -- ----------------------------------------------------------------------------
  (
    'mission_results.view',
    'mission_results',
    'view',
    'عرض نتائج المرور',
    'السماح بالاطلاع على تفاصيل نتائج واستبيانات الزيارات الميدانية',
    FALSE,
    TRUE,
    300
  ),
  (
    'mission_results.record',
    'mission_results',
    'record',
    'تسجيل نتائج المرور',
    'السماح بتسجيل تقرير الزيارة وإجابات بطاقات التقييم والملاحظات',
    FALSE,
    TRUE,
    310
  ),
  (
    'mission_results.edit',
    'mission_results',
    'edit',
    'تعديل نتائج المرور',
    'السماح بتعديل نتائج وملاحظات المرور قبل اعتمادها النهائي',
    FALSE,
    TRUE,
    320
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Violations (المخالفات والسلبيات)
  -- ----------------------------------------------------------------------------
  (
    'violations.view',
    'violations',
    'view',
    'عرض المخالفات',
    'السماح باستعراض سجل المخالفات والسلبيات المرصودة',
    FALSE,
    TRUE,
    400
  ),
  (
    'violations.create',
    'violations',
    'create',
    'رصد مخالفة جديدة',
    'السماح بتسجيل مخالفة أو سلبية ميدانية أثناء أو بعد المرور',
    FALSE,
    TRUE,
    410
  ),
  (
    'violations.assign',
    'violations',
    'assign',
    'إسناد متابعة المخالفة',
    'السماح بتوجيه المخالفة وإسنادها إلى جهة أو مفتش للمتابعة وتلافي السلبية',
    FALSE,
    TRUE,
    420
  ),
  (
    'violations.correct',
    'violations',
    'correct',
    'تسجيل تلافي السلبية',
    'السماح بتسجيل إجراءات تصحيح وتلافي المخالفة ومرفقات الإثبات',
    FALSE,
    TRUE,
    430
  ),
  (
    'violations.verify',
    'violations',
    'verify',
    'التحقق من تلافي المخالفة',
    'السماح للمفتش أو المسؤول بالتحقق الميداني أو المستندي من إزالة السلبية',
    FALSE,
    TRUE,
    440
  ),
  (
    'violations.close',
    'violations',
    'close',
    'إغلاق المخالفة رسمياً',
    'السماح بالاعتماد والإغلاق النهائي لسجل المخالفة بعد تصحيحها',
    FALSE,
    TRUE,
    450
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Facilities (المنشآت الصحية ومنافذ الخدمة)
  -- ----------------------------------------------------------------------------
  (
    'facilities.view',
    'facilities',
    'view',
    'عرض المنشآت الصحية',
    'السماح بالاطلاع على دليل المنشآت الصحية وبياناتها الجغرافية والخدمية',
    FALSE,
    TRUE,
    500
  ),
  (
    'facilities.create',
    'facilities',
    'create',
    'إضافة منشأة صحية',
    'السماح بإضافة منشأة صحية جديدة إلى دليل المنظومة',
    FALSE,
    TRUE,
    510
  ),
  (
    'facilities.edit',
    'facilities',
    'edit',
    'تعديل بيانات المنشأة',
    'السماح بتحديث بيانات المنشأة الصحية (الموقع، المستوى، الخدمات)',
    FALSE,
    TRUE,
    520
  ),
  (
    'facilities.delete',
    'facilities',
    'delete',
    'حذف منشأة صحية',
    'السماح بالحذف النهائي لسجل المنشأة الصحية من المنظومة',
    TRUE,
    TRUE,
    530
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Organizations (الهيكل التنظيمي والجهات)
  -- ----------------------------------------------------------------------------
  (
    'organizations.view',
    'organizations',
    'view',
    'عرض الهيكل التنظيمي',
    'السماح باستعراض شجرة الجهات والإدارات والمديريات الصحية',
    FALSE,
    TRUE,
    600
  ),
  (
    'organizations.create',
    'organizations',
    'create',
    'إضافة جهة تنظيمية',
    'السماح بإنشاء إدارة أو مديرية أو وحدة تنظيمية جديدة في الهيكل',
    FALSE,
    TRUE,
    610
  ),
  (
    'organizations.edit',
    'organizations',
    'edit',
    'تعديل بيانات جهة تنظيمية',
    'السماح بتعديل مسميات وبيانات وتبعية الجهات في الهيكل التنظيمي',
    FALSE,
    TRUE,
    620
  ),
  (
    'organizations.delete',
    'organizations',
    'delete',
    'حذف جهة تنظيمية',
    'السماح بحذف وحدة تنظيمية من الهيكل الإداري',
    TRUE,
    TRUE,
    630
  ),
  (
    'organizations.manage_capabilities',
    'organizations',
    'manage_capabilities',
    'إدارة قدرات وصلاحيات الجهة',
    'السماح بتعديل قدرات الجهة التنظيمية مثل صلاحية إصدار المأموريات أو اعتمادها',
    TRUE,
    TRUE,
    640
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Users (المستخدمين وإدارة الهويات)
  -- ----------------------------------------------------------------------------
  (
    'users.view',
    'users',
    'view',
    'عرض سجلات المستخدمين',
    'السماح باستعراض قائمة المستخدمين والملفات الشخصية الأساسية',
    FALSE,
    TRUE,
    700
  ),
  (
    'users.create',
    'users',
    'create',
    'إنشاء مستخدم جديد',
    'السماح بإنشاء حسابات مستخدمين وموظفين جدد في المنظومة',
    TRUE,
    TRUE,
    710
  ),
  (
    'users.edit',
    'users',
    'edit',
    'تعديل بيانات المستخدم',
    'السماح بتعديل البيانات الوظيفية والبيانات الشخصية للمستخدمين',
    TRUE,
    TRUE,
    720
  ),
  (
    'users.deactivate',
    'users',
    'deactivate',
    'تعطيل وتنشيط الحسابات',
    'السماح بتعطيل حساب مستخدم أو إعادة تفعيله لمنع أو منح الوصول',
    TRUE,
    TRUE,
    730
  ),
  (
    'users.reset_password',
    'users',
    'reset_password',
    'إعادة تعيين كلمة المرور',
    'السماح بإعادة تعيين كلمات مرور المستخدمين وفرض التغيير الإلزامي',
    TRUE,
    TRUE,
    740
  ),
  (
    'users.assign_role',
    'users',
    'assign_role',
    'إسناد الأدوار للمستخدمين',
    'السماح بإسناد وتعديل الأدوار الوظيفية (Roles) للمستخدمين',
    TRUE,
    TRUE,
    750
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Checklists (نماذج واستبيانات التقييم)
  -- ----------------------------------------------------------------------------
  (
    'checklists.view',
    'checklists',
    'view',
    'عرض نماذج التقييم',
    'السماح بالاطلاع على قوائم ونماذج بطاقات المرور المعتمدة',
    FALSE,
    TRUE,
    800
  ),
  (
    'checklists.execute',
    'checklists',
    'execute',
    'تعبئة قوائم المرور',
    'السماح بتعبئة واستيفاء بنود بطاقة المرور أثناء التفتيش الميداني',
    FALSE,
    TRUE,
    810
  ),
  (
    'checklists.design',
    'checklists',
    'design',
    'تصميم وتعديل النماذج',
    'السماح بإنشاء وتصميم وتعديل بنود ومعايير بطاقات التقييم والملاحظات',
    FALSE,
    TRUE,
    820
  ),
  (
    'checklists.publish',
    'checklists',
    'publish',
    'اعتماد ونشر النماذج',
    'السماح باعتماد ونشر الإصدارات الرسمية لنماذج التقييم للعمل الميداني',
    FALSE,
    TRUE,
    830
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Targets (المستهدفات والخطط الدورية)
  -- ----------------------------------------------------------------------------
  (
    'targets.view',
    'targets',
    'view',
    'عرض الخطط والمستهدفات',
    'السماح بالاطلاع على الخطط التشغيلية ومستهدفات المرور الميداني',
    FALSE,
    TRUE,
    900
  ),
  (
    'targets.create',
    'targets',
    'create',
    'إنشاء مستهدفات المرور',
    'السماح بإنشاء خطط ومستهدفات مرور دورية للفرق والجهات',
    FALSE,
    TRUE,
    910
  ),
  (
    'targets.edit',
    'targets',
    'edit',
    'تعديل المستهدفات',
    'السماح بتعديل الخطط التشغيلية للمرور قبل اعتمادها',
    FALSE,
    TRUE,
    920
  ),
  (
    'targets.delete',
    'targets',
    'delete',
    'حذف مستهدفات المرور',
    'السماح بحذف خطة أو مستهدف غير ساري المفعول',
    TRUE,
    TRUE,
    930
  ),
  (
    'targets.approve',
    'targets',
    'approve',
    'اعتماد خطط المستهدفات',
    'السماح بالاعتماد الرسمي لخطط ومستهدفات التغطية الميدانية الدورية',
    FALSE,
    TRUE,
    940
  ),
  (
    'targets.report',
    'targets',
    'report',
    'استخراج تقارير المستهدفات',
    'السماح باستخراج وتصدير تقارير الإنجاز ونسب تغطية المستهدفات',
    FALSE,
    TRUE,
    950
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Leadership Targets (مستهدفات القيادات)
  -- ----------------------------------------------------------------------------
  (
    'leadership_targets.view',
    'leadership_targets',
    'view',
    'عرض خطط القيادات',
    'السماح بالاطلاع على خطط ومستهدفات نزول ومتابعة القيادات',
    FALSE,
    TRUE,
    1000
  ),
  (
    'leadership_targets.create',
    'leadership_targets',
    'create',
    'إنشاء مستهدف قيادي',
    'السماح بإدراج خطط وزيارات القيادات الإشرافية',
    FALSE,
    TRUE,
    1010
  ),
  (
    'leadership_targets.edit',
    'leadership_targets',
    'edit',
    'تعديل خطط القيادات',
    'السماح بتعديل بيانات ومواعيد ومسارات خطط القيادات',
    FALSE,
    TRUE,
    1020
  ),
  (
    'leadership_targets.delete',
    'leadership_targets',
    'delete',
    'حذف خطط القيادات',
    'السماح بحذف مسودات أو سجلات ملغاة من خطط القيادات',
    TRUE,
    TRUE,
    1030
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Settings (إعدادات النظام والأمان)
  -- ----------------------------------------------------------------------------
  (
    'settings.view',
    'settings',
    'view',
    'عرض إعدادات النظام',
    'السماح بالوصول إلى لوحة الإعدادات والتهيئات العامة للنظام',
    FALSE,
    TRUE,
    1100
  ),
  (
    'settings.manage_roles',
    'settings',
    'manage_roles',
    'إدارة الأدوار والصلاحيات',
    'السماح بإنشاء وتعديل وحذف الأدوار وإسناد الصلاحيات ونطاقات البيانات',
    TRUE,
    TRUE,
    1110
  ),
  (
    'settings.manage_permissions',
    'settings',
    'manage_permissions',
    'إدارة قاموس الصلاحيات',
    'السماح بتعديل وتحديث سجل الصلاحيات ومحدداتها الأمنية',
    TRUE,
    TRUE,
    1120
  ),

  -- ----------------------------------------------------------------------------
  -- Module: Audit (سجلات التدقيق الأمني والعمليات)
  -- ----------------------------------------------------------------------------
  (
    'audit.view',
    'audit',
    'view',
    'عرض سجلات التدقيق الأمني',
    'السماح بالاطلاع على سجلات التتبع الأمني والرقابة وتعديلات الصلاحيات',
    TRUE,
    TRUE,
    1200
  )

ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  display_name_ar = EXCLUDED.display_name_ar,
  description_ar = EXCLUDED.description_ar,
  is_sensitive = EXCLUDED.is_sensitive,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

COMMIT;
