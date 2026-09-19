export const FACILITY_TYPE_LABELS: Readonly<Record<string, string>> = {
  health_unit: 'وحدة صحية',
  family_medicine_center: 'مركز طب أسرة',
  health_office: 'مكتب صحة',
  child_care: 'مركز رعاية طفل',
}

export function getFacilityTypeLabel(value: string | null | undefined): string {
  if (!value) return 'غير مصنف'
  return FACILITY_TYPE_LABELS[value] ?? 'نوع منشأة غير مصنف'
}
