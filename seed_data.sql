-- ==========================================
-- نظام إدارة المأموريات - بيانات تجريبية (Seed Data)
-- ==========================================

-- أنواع المنشآت كمرجع
INSERT INTO facilities (name, facility_type, address, latitude, longitude) VALUES
('مستشفى النيل العام',          'H-GOV', 'القاهرة، المنيل',          30.0131, 31.2244),
('مستشفى الرحمة الخاصة',       'H-PRI', 'الجيزة، الدقي',            30.0407, 31.2082),
('عيادة الأمل الخاصة',          'C-PRI', 'القاهرة، مدينة نصر',       30.0580, 31.3280),
('معمل المختار للتحاليل',       'LAB',   'القاهرة، هليوبوليس',       30.0890, 31.3220),
('مركز الأشعة التشخيصية',      'RAD',   'الجيزة، الهرم',            30.0131, 31.2025),
('مركز غسيل الكلى الحديث',     'DIA',   'القاهرة، المعادي',         29.9580, 31.2580),
('صيدلية النور',                 'PHM',   'القاهرة، شبرا',            30.0869, 31.2442);

-- قائمة فحص نموذجية للمستشفى الحكومي
INSERT INTO checklists (name, facility_type, description) VALUES
('قائمة فحص المستشفيات الحكومية — النسخة الأولى', 'H-GOV',
 'قائمة الفحص الشاملة للمستشفيات الحكومية التابعة لقطاع الطب العلاجي');

-- قسم السلامة من الحرائق
INSERT INTO checklist_sections (checklist_id, name, sort_order)
SELECT id, 'السلامة من الحريق وطوارئ الإخلاء', 1 FROM checklists WHERE facility_type = 'H-GOV' LIMIT 1;

INSERT INTO checklist_sections (checklist_id, name, sort_order)
SELECT id, 'نظافة وتعقيم المرافق', 2 FROM checklists WHERE facility_type = 'H-GOV' LIMIT 1;

INSERT INTO checklist_sections (checklist_id, name, sort_order)
SELECT id, 'صلاحية الأجهزة الطبية', 3 FROM checklists WHERE facility_type = 'H-GOV' LIMIT 1;
