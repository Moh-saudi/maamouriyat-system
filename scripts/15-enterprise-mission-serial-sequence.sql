-- ==============================================================================
-- 15. الحل المعياري لتوليد الأرقام التسلسلية للمأموريات (Enterprise PostgreSQL Standard)
-- متوافق 100% مع Supabase ومع أي سيرفر محلي أو خاص (Self-Hosted PostgreSQL)
-- ==============================================================================

-- 1. إنشاء تسلسل رسمي مستقل (PostgreSQL Sequence)
-- الـ Sequence يعمل على مستوى المحرك (In-Memory Atomic Counter) ولا يتأثر بالـ RLS
CREATE SEQUENCE IF NOT EXISTS mission_serial_seq START WITH 1;

-- 2. مزامنة بداية العداد مع أقصى عدد موجود حالياً في جدول المأموريات لتفادي أي تكرار مع القديم
DO $$
DECLARE
  v_max_count BIGINT;
BEGIN
  SELECT COALESCE(COUNT(*), 0) INTO v_max_count FROM public.missions;
  PERFORM setval('mission_serial_seq', v_max_count + 1, false);
END;
$$;

-- 3. دالة التوليد الذرية الآمنة مع حلقة تأكيد الفرادة (Atomic Generator)
CREATE OR REPLACE FUNCTION public.set_mission_serial_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_month TEXT := TO_CHAR(NOW(), 'MM');
  v_seq BIGINT;
  v_candidate TEXT;
  v_exists BOOLEAN;
BEGIN
  -- إذا لم يتم توفير رقم تسلسلي، أو إذا كان الرقم المقدم موجوداً بالفعل
  IF NEW.serial_number IS NULL OR NEW.serial_number = '' THEN
    LOOP
      v_seq := nextval('mission_serial_seq');
      v_candidate := 'MIS-' || v_year || '-' || v_month || '-' || LPAD(v_seq::TEXT, 5, '0') || '-MIS';
      
      SELECT EXISTS (SELECT 1 FROM public.missions WHERE serial_number = v_candidate) INTO v_exists;
      IF NOT v_exists THEN
        NEW.serial_number := v_candidate;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    -- فحص إضافي: إذا كان الرقم الممرر مكرراً، يتم استبداله فوراً برقم آمن من الـ Sequence لمنع خطأ 409
    SELECT EXISTS (SELECT 1 FROM public.missions WHERE serial_number = NEW.serial_number) INTO v_exists;
    IF v_exists THEN
      LOOP
        v_seq := nextval('mission_serial_seq');
        v_candidate := 'MIS-' || v_year || '-' || v_month || '-' || LPAD(v_seq::TEXT, 5, '0') || '-MIS';
        
        SELECT EXISTS (SELECT 1 FROM public.missions WHERE serial_number = v_candidate) INTO v_exists;
        IF NOT v_exists THEN
          NEW.serial_number := v_candidate;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. ربط المشغل التلقائي بجدول missions قبل كل عملية إدراج (BEFORE INSERT)
DROP TRIGGER IF EXISTS trg_set_mission_serial ON public.missions;

CREATE TRIGGER trg_set_mission_serial
BEFORE INSERT ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.set_mission_serial_trigger();

-- 5. تحديث دالة RPC القديمة إن وجدت لتعتمد على نفس الآلية
CREATE OR REPLACE FUNCTION public.generate_serial_number(dept_code TEXT DEFAULT 'GEN')
RETURNS TEXT AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_month TEXT := TO_CHAR(NOW(), 'MM');
  v_seq BIGINT;
  v_serial TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_seq := nextval('mission_serial_seq');
    v_serial := 'MIS-' || v_year || '-' || v_month || '-' || LPAD(v_seq::TEXT, 5, '0') || '-' || UPPER(COALESCE(dept_code, 'MIS'));
    
    SELECT EXISTS (SELECT 1 FROM public.missions WHERE serial_number = v_serial) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_serial;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- منح الصلاحيات اللازمة للتشغيل
GRANT USAGE, SELECT ON SEQUENCE mission_serial_seq TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_serial_number(TEXT) TO authenticated, anon, service_role;
