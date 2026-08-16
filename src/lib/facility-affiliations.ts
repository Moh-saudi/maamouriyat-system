// ══════════════════════════════════════════════════════════════
// ملف التوافق المؤقت
// يُوفِّر الأنواع القديمة ريثما يُعاد بناء facilities-portal.tsx
// بالكامل ليعمل مع جدول organizations الجديد
// ══════════════════════════════════════════════════════════════

export type FacilityAffiliationType = 'directorate' | 'central_entity' | 'authority' | 'other'

export type FacilityAffiliationOption = {
  code?: string
  id?: string
  name: string
  type?: FacilityAffiliationType
  affiliation_type?: FacilityAffiliationType
}

// قوائم فارغة — البيانات الحقيقية تأتي من organizations في قاعدة البيانات
export const healthDirectorateAffiliations: string[] = []
export const centralHealthAffiliations: string[] = []
export const defaultFacilityAffiliations: string[] = []
