-- Link Supabase Auth users to public.users
-- Run this after schema.sql has created public.users.
BEGIN;

INSERT INTO users (auth_id, full_name, job_title, level, department, is_lateral, lateral_type, is_active)
SELECT 'c5d5bc06-c3af-4b24-a2c6-faf5c50bb090'::uuid, 'مدير النظام', 'مدير عام المتابعة', 1, 'الإدارة المركزية', FALSE, NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE auth_id = 'c5d5bc06-c3af-4b24-a2c6-faf5c50bb090'::uuid);

INSERT INTO users (auth_id, full_name, job_title, level, department, is_lateral, lateral_type, is_active)
SELECT 'e4f00ec4-5659-4c8d-a2ec-353ecbf9aa6b'::uuid, 'مدير التفتيش', 'مدير إدارة التفتيش', 3, 'التفتيش والمتابعة', FALSE, NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE auth_id = 'e4f00ec4-5659-4c8d-a2ec-353ecbf9aa6b'::uuid);

INSERT INTO users (auth_id, full_name, job_title, level, department, is_lateral, lateral_type, is_active)
SELECT '0f387416-44de-4899-b802-b829c85d1227'::uuid, 'مشرف المأموريات', 'مشرف ميداني', 5, 'التفتيش والمتابعة', FALSE, NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE auth_id = '0f387416-44de-4899-b802-b829c85d1227'::uuid);

INSERT INTO users (auth_id, full_name, job_title, level, department, is_lateral, lateral_type, is_active)
SELECT '7d9e834d-8fde-4d36-877c-ffd2d8cb743d'::uuid, 'مفتش صحي', 'مفتش منشآت صحية', 7, 'التفتيش والمتابعة', FALSE, NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE auth_id = '7d9e834d-8fde-4d36-877c-ffd2d8cb743d'::uuid);

INSERT INTO users (auth_id, full_name, job_title, level, department, is_lateral, lateral_type, is_active)
SELECT '8a16ac2e-6f84-499d-8a52-58475708a43f'::uuid, 'مسؤول التصحيح', 'منسق تصحيح المخالفات', 6, 'إدارة التصحيح', TRUE, 'إدارة التصحيح', TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE auth_id = '8a16ac2e-6f84-499d-8a52-58475708a43f'::uuid);

UPDATE users
SET direct_manager_id = (SELECT id FROM users WHERE auth_id = 'c5d5bc06-c3af-4b24-a2c6-faf5c50bb090'::uuid)
WHERE auth_id = 'e4f00ec4-5659-4c8d-a2ec-353ecbf9aa6b'::uuid;

UPDATE users
SET direct_manager_id = (SELECT id FROM users WHERE auth_id = 'e4f00ec4-5659-4c8d-a2ec-353ecbf9aa6b'::uuid)
WHERE auth_id = '0f387416-44de-4899-b802-b829c85d1227'::uuid;

UPDATE users
SET direct_manager_id = (SELECT id FROM users WHERE auth_id = '0f387416-44de-4899-b802-b829c85d1227'::uuid)
WHERE auth_id = '7d9e834d-8fde-4d36-877c-ffd2d8cb743d'::uuid;

UPDATE users
SET direct_manager_id = (SELECT id FROM users WHERE auth_id = 'e4f00ec4-5659-4c8d-a2ec-353ecbf9aa6b'::uuid)
WHERE auth_id = '8a16ac2e-6f84-499d-8a52-58475708a43f'::uuid;

COMMIT;

SELECT auth_id, full_name, level, department, direct_manager_id FROM users ORDER BY level, full_name;