-- ==========================================
-- نظام إدارة المأموريات - الاستعلامات (Dashboard)
-- ==========================================

-- 1. إحصاءات الشهر الحالي (KPIs)
SELECT
  COUNT(*) FILTER (WHERE status IN ('completed','under_correction','closed')) AS executed_missions,
  COUNT(*) FILTER (WHERE status IN ('pending_approval','approved','in_progress','under_correction')) AS pending_missions,
  COUNT(*) FILTER (WHERE scheduled_date < CURRENT_DATE AND status NOT IN ('completed','closed','cancelled')) AS overdue_missions,
  COUNT(*) AS total_missions
FROM missions
WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());

-- 2. توزيع المخالفات حسب الأولوية
SELECT
  priority,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'verified') AS closed,
  COUNT(*) FILTER (WHERE status NOT IN ('verified','corrected')) AS active
FROM violations
GROUP BY priority
ORDER BY
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high'     THEN 2
    WHEN 'medium'   THEN 3
    WHEN 'low'      THEN 4
  END;

-- 3. Top 10 منشآت بأكبر عدد مخالفات نشطة
SELECT
  f.name AS facility_name,
  f.facility_type,
  COUNT(v.id) AS active_violations,
  COUNT(v.id) FILTER (WHERE v.priority = 'critical') AS critical_count
FROM facilities f
LEFT JOIN violations v ON v.facility_id = f.id
  AND v.status NOT IN ('verified', 'corrected')
GROUP BY f.id, f.name, f.facility_type
HAVING COUNT(v.id) > 0
ORDER BY active_violations DESC
LIMIT 10;

-- 4. مقارنة المأموريات المخططة والمنفذة — آخر 6 أشهر
SELECT
  TO_CHAR(DATE_TRUNC('month', scheduled_date), 'YYYY-MM') AS month_label,
  COUNT(*) AS total_planned,
  COUNT(*) FILTER (WHERE status IN ('completed','under_correction','closed')) AS executed,
  ROUND(
    COUNT(*) FILTER (WHERE status IN ('completed','under_correction','closed'))::DECIMAL
    / NULLIF(COUNT(*), 0) * 100, 1
  ) AS execution_rate_pct
FROM missions
WHERE scheduled_date >= NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', scheduled_date)
ORDER BY month_label;

-- 5. متوسط أيام التصويب حسب الأولوية
SELECT
  priority,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (corrected_at - created_at)) / 86400
  ), 1) AS avg_days_to_correct
FROM violations
WHERE corrected_at IS NOT NULL
GROUP BY priority;

-- 6. آخر 20 مأمورية مع تفاصيلها
SELECT
  m.serial_number,
  m.status,
  m.scheduled_date,
  m.violation_count,
  m.gps_verified,
  m.duration_minutes,
  f.name AS facility_name,
  f.facility_type,
  u.full_name AS employee_name,
  u.job_title
FROM missions m
JOIN facilities f ON f.id = m.facility_id
JOIN users u ON u.id = m.assigned_user_id
ORDER BY m.created_at DESC
LIMIT 20;

-- 7. مخالفات تجاوزت الموعد النهائي ولم تُصوَّب
SELECT
  v.id,
  v.description,
  v.priority,
  v.correction_deadline,
  DATE_PART('day', NOW() - v.correction_deadline) AS overdue_days,
  f.name AS facility_name,
  m.serial_number
FROM violations v
JOIN missions m ON m.id = v.mission_id
JOIN facilities f ON f.id = v.facility_id
WHERE v.correction_deadline < NOW()
  AND v.status NOT IN ('corrected', 'verified')
ORDER BY v.priority, overdue_days DESC;
