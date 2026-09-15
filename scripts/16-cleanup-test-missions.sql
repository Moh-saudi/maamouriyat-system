-- ==============================================================================
-- 16. تنظيف كافة سجلات المأموريات والمستهدفات التجريبية وتصفير العدادات
-- ==============================================================================

BEGIN;

-- 1. حذف تفاصيل الفحص والمخالفات وسجلات التتبع المرتبطة بالمأموريات
DELETE FROM public.mission_destination_changes;
DELETE FROM public.mission_results;
DELETE FROM public.violations WHERE mission_id IS NOT NULL;
DELETE FROM public.mission_events;

-- 2. حذف أعضاء الفرق والمكلفين (إن وجدت الجداول)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mission_assignees') THEN
    DELETE FROM public.mission_assignees;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mission_team') THEN
    DELETE FROM public.mission_team;
  END IF;
END $$;

-- 3. حذف إشعارات التكليف التجريبية
DELETE FROM public.notifications WHERE mission_id IS NOT NULL;

-- 4. حذف سجلات المأموريات بالكامل
DELETE FROM public.missions;

-- 5. حذف مستهدفات القيادات التجريبية (إن وجدت في قاعدة البيانات)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leadership_targets') THEN
    DELETE FROM public.leadership_targets;
  END IF;
END $$;

-- 6. تصفير العداد التسلسلي للمأموريات ليبدأ العمل الفعلي النظيف من الرقم 1
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'mission_serial_seq') THEN
    ALTER SEQUENCE mission_serial_seq RESTART WITH 1;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'serial_counters') THEN
    DELETE FROM public.serial_counters;
  END IF;
END $$;

COMMIT;
