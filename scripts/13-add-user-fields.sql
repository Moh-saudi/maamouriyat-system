-- ========================================================
-- إضافة حقول المستخدمين الجديدة - كود النظام المالي، الهاتف، البريد الإلكتروني، والربط بالمنشأة
-- ========================================================

-- إضافة الأعمدة إلى جدول المستخدمين (users)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS financial_code TEXT;

-- تحديث الفهارس (Indexes) لسرعة البحث
CREATE INDEX IF NOT EXISTS idx_users_facility ON public.users(facility_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_financial_code ON public.users(financial_code);

-- التعليقات للتوضيح في قاعدة البيانات
COMMENT ON COLUMN public.users.email IS 'البريد الإلكتروني للموظف لتسجيل الدخول وتلقي التنبيهات';
COMMENT ON COLUMN public.users.phone IS 'رقم الهاتف المحمول للتواصل المباشر';
COMMENT ON COLUMN public.users.facility_id IS 'المنشأة الصحية أو الإدارة التي تم تسكين الموظف عليها بشكل رئيسي';
COMMENT ON COLUMN public.users.financial_code IS 'كود الموظف المسجل بنظام النظام المالي الموحد بديوان عام الوزارة';
