-- Seed initial facilities and attach them to governorates and organizational units.

INSERT INTO facilities (
  name,
  facility_type,
  address,
  latitude,
  longitude,
  governorate_id,
  org_unit_id,
  responsible_dept,
  is_active
)
SELECT
  seed.name,
  seed.facility_type,
  seed.address,
  seed.latitude,
  seed.longitude,
  g.id,
  ou.id,
  seed.responsible_dept,
  seed.is_active
FROM (VALUES
  ('مستشفى النيل العام', 'H-GOV', 'القاهرة، المنيل', 30.0131, 31.2244, 'CAI', 'TH-GA-HOSPITALS', 'الإدارة العامة لشئون المستشفيات', TRUE),
  ('مستشفى الرحمة الخاصة', 'H-PRI', 'الجيزة، الدقي', 30.0407, 31.2082, 'GIZ', 'TH-GA-HOSPITALS', 'الإدارة العامة لشئون المستشفيات', TRUE),
  ('عيادة الأمل الخاصة', 'C-PRI', 'القاهرة، مدينة نصر', 30.0580, 31.3280, 'CAI', 'TH-CA-CURATIVE', 'الإدارة المركزية للشئون العلاجية', TRUE),
  ('معمل المختار للتحاليل', 'LAB', 'القاهرة، هليوبوليس', 30.0890, 31.3220, 'CAI', 'TH-CA-CURATIVE', 'الإدارة المركزية للشئون العلاجية', TRUE),
  ('مركز الأشعة التشخيصية', 'RAD', 'الجيزة، الهرم', 30.0131, 31.2025, 'GIZ', 'TH-GA-RADIOLOGY', 'الإدارة العامة للأشعة', TRUE),
  ('مركز غسيل الكلى الحديث', 'DIA', 'القاهرة، المعادي', 29.9580, 31.2580, 'CAI', 'TH-GA-HOSPITALS', 'الإدارة العامة لشئون المستشفيات', TRUE),
  ('صيدلية النور', 'PHM', 'القاهرة، شبرا', 30.0869, 31.2442, 'CAI', 'TH-GA-PHARMACEUTICAL-AFFAIRS', 'الإدارة العامة للشئون الصيدلية', TRUE)
) AS seed(name, facility_type, address, latitude, longitude, governorate_code, org_unit_code, responsible_dept, is_active)
JOIN governorates g ON g.code = seed.governorate_code
JOIN organizational_units ou ON ou.code = seed.org_unit_code
WHERE NOT EXISTS (
  SELECT 1
  FROM facilities f
  WHERE f.name = seed.name
);
