-- إضافة عمود org_unit_id إلى جدول الاستمارات (checklists) لربط كل استمارة بإدارة معينة
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES public.organizational_units(id) ON DELETE SET NULL;

-- إنشاء كشاف (Index) لتسريع عمليات الفلترة والبحث بالوحدات التنظيمية
CREATE INDEX IF NOT EXISTS idx_checklists_org_unit ON public.checklists(org_unit_id);
