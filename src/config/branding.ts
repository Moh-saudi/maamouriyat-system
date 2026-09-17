// ══════════════════════════════════════════════════════════════
// منظومة حوكمة ومتابعة المأموريات الميدانية — الهوية الرسمية V2
// Central Government Branding Constants
// ══════════════════════════════════════════════════════════════

export const BRANDING = {
  country: 'جمهورية مصر العربية',
  ministry: 'وزارة الصحة والسكان',
  systemName: 'منظومة حوكمة ومتابعة المأموريات الميدانية',
  shortName: 'مأموريات',
  subTitle: 'الإدارة المركزية للرعاية الحرجة والعاجلة والطب العلاجي',
  version: '2.0.0-foundation',
  year: '2026',
  logos: {
    primary: '/mohp-logo.png',
    favicon: '/favicon.ico',
    eagle: '/eagle.png',
  },
  contact: {
    supportEmail: 'support.maamouriyat@mohp.gov.eg',
    emergencyHotline: '105',
  },
} as const

export type BrandingConfig = typeof BRANDING
