-- ==========================================
-- الخطوة 4: سياسات Storage (الصور)
-- ==========================================

CREATE POLICY "upload_violation_photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'violation-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "upload_correction_photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'correction-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "view_photos"
ON storage.objects FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND bucket_id IN ('violation-photos', 'correction-photos', 'mission-attachments')
);
