// ══════════════════════════════════════════════════════════════
// دليل تصنيفات وأنواع المنشآت الصحية
// لتسهيل إضافة أو تعديل أي نوع مستقبلاً في ملف مركزي واحد
// ══════════════════════════════════════════════════════════════

export type FacilityTypeDefinition = {
  key: string
  label: string
  category?: string
  color?: string
}

export const STANDARD_FACILITY_TYPES: FacilityTypeDefinition[] = [
  // ── مراكز ووحدات الرعاية الأولية
  { key: 'family_medicine_center', label: 'مركز طب أسرة', category: 'رعاية أولية', color: '#1abc9c' },
  { key: 'health_unit', label: 'وحدة صحية', category: 'رعاية أولية', color: '#16a085' },
  { key: 'health_office', label: 'مكتب صحة', category: 'رعاية أولية', color: '#27ae60' },
  { key: 'child_care', label: 'رعاية طفل وأمومة', category: 'رعاية أولية', color: '#2ecc71' },
  { key: 'womens_health', label: 'مركز صحة المرأة', category: 'رعاية أولية', color: '#e91e63' },
  { key: 'rural_clinic', label: 'عيادة ريفية', category: 'رعاية أولية', color: '#009688' },

  // ── المراكز التخصصية والمستشفيات
  { key: 'specialized_medical_centers', label: 'أمانة المراكز الطبية المتخصصة', category: 'مراكز تخصصية', color: '#8e44ad' },
  { key: 'mental_health_hospitals', label: 'مستشفيات الصحة النفسية', category: 'صحة نفسية', color: '#9b59b6' },
  { key: 'autism_centers', label: 'مراكز التوحد', category: 'تأهيل وتوحد', color: '#3f51b5' },
  { key: 'private_mental_health', label: 'مستشفيات الصحة النفسية الخاصة', category: 'قطاع خاص', color: '#673ab7' },
  { key: 'radiology_centers', label: 'مراكز أشعة', category: 'تشخيص وأشعة', color: '#ff9800' },
  { key: 'hospital', label: 'مستشفى عام / مركزي', category: 'علاجي', color: '#2980b9' },
  { key: 'specialized_center', label: 'مركز تخصصي', category: 'علاجي', color: '#3498db' },
  { key: 'teaching_hospital', label: 'مستشفى تعليمي', category: 'علاجي', color: '#e67e22' },
  { key: 'insurance_hospital', label: 'مستشفى تأمين صحي', category: 'تأمين صحي', color: '#00bcd4' },
  { key: 'medical_supply_warehouse', label: 'مخزن تموين طبي وإمداد دوائي', category: 'إمداد وتموين', color: '#e74c3c' },
  { key: 'other', label: 'أخرى / منشأة صحية متنوعة', category: 'عام', color: '#78909c' },
]

/** قاموس المسميات العربية */
const typeMap = new Map<string, string>()
for (const item of STANDARD_FACILITY_TYPES) {
  typeMap.set(item.key, item.label)
  typeMap.set(item.label, item.label) // دعم الحفظ بالاسم العربي أو الإنجليزي
}

/** تحويل كود المنشأة إلى الاسم العربي الرسمي */
export function formatFacilityType(type: string | null | undefined): string {
  if (!type) return 'منشأة صحية'
  return typeMap.get(type) || type
}

/** جلب لون المنشأة للخريطة */
export function getFacilityTypeColor(type: string | null | undefined): string {
  if (!type) return '#2ecc71'
  const matched = STANDARD_FACILITY_TYPES.find(
    (t) => t.key === type || t.label === type
  )
  return matched?.color || '#2ecc71'
}
