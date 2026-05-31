export const roleDefinitions = {
  superadmin: {
    department: 'ديوان عام وزارة الصحة والسكان',
    email: 'superadmin@mohp.gov.eg',
    homeLabel: 'لوحة التحكم الكبرى',
    jobTitle: 'سوبر أدمن المنظومة',
    name: 'سوبر أدمن',
    navigation: ['dashboard', 'missions', 'violations', 'facilities', 'users', 'settings', 'checklists'],
  },
  techadmin: {
    department: 'الإدارة العامة لنظم المعلومات والتحول الرقمي',
    email: 'techadmin@mohp.gov.eg',
    homeLabel: 'لوحة التحكم التقنية',
    jobTitle: 'مدير الإدارة التقنية والدعم الفني',
    name: 'الدعم الفني',
    navigation: ['dashboard', 'facilities', 'users', 'checklists', 'settings'],
  },
  central: {
    department: 'الإدارة المركزية للطب العلاجي',
    email: 'central@mohp.gov.eg',
    homeLabel: 'لوحة الإدارة المركزية',
    jobTitle: 'رئيس إدارة مركزية',
    name: 'رئيس إدارة مركزية',
    navigation: ['dashboard', 'missions', 'violations', 'facilities'],
  },
  generalmanager: {
    department: 'الإدارة العامة للمستشفيات',
    email: 'generalmanager@mohp.gov.eg',
    homeLabel: 'لوحة الإدارة العامة',
    jobTitle: 'مدير عام المستشفيات',
    name: 'مدير عام',
    navigation: ['dashboard', 'missions', 'violations', 'facilities'],
  },
  creator: {
    department: 'قسم التشغيل والتكليف',
    email: 'creator@mohp.gov.eg',
    homeLabel: 'منشئ التكليفات والموظفين',
    jobTitle: 'موظف مختص',
    name: 'موظف مختص',
    navigation: ['dashboard', 'missions'],
  },
  financial: {
    department: 'الإدارة الشؤون المالية والإدارية',
    email: 'financial@mohp.gov.eg',
    homeLabel: 'لوحة المراجعة المالية',
    jobTitle: 'مستخدم مالي',
    name: 'مستخدم مالي',
    navigation: ['dashboard', 'missions'],
  },
  inspector: {
    department: 'إدارة التفتيش الميداني',
    email: 'inspector@mohp.gov.eg',
    homeLabel: 'مأمورياتي الميدانية',
    jobTitle: 'القائم بالمرور',
    name: 'القائم بالمرور',
    navigation: ['dashboard', 'missions', 'violations'],
  },
} as const

export type UserRole = keyof typeof roleDefinitions
export type NavigationKey = (typeof roleDefinitions)[UserRole]['navigation'][number]

export const allNavigationKeys: readonly NavigationKey[] = [
  'dashboard',
  'missions',
  'violations',
  'facilities',
  'users',
  'settings',
  'checklists',
]

/** Convert a numeric user level from Supabase to a role key */
export function levelToRole(level: number): UserRole {
  if (level === 0) return 'techadmin'
  if (level === 1) return 'superadmin'
  if (level === 2) return 'central'
  if (level === 3) return 'generalmanager'
  if (level === 4) return 'creator'
  if (level === 5) return 'financial'
  return 'inspector'
}

export function getRoleDefinition(role: UserRole | null | undefined) {
  return roleDefinitions[role ?? 'inspector']
}

export function getRoleNavigation(role: UserRole): readonly NavigationKey[] {
  return roleDefinitions[role].navigation
}

export function normalizeNavigationKeys(pages: string[] | null | undefined): NavigationKey[] {
  if (!Array.isArray(pages)) return []
  const allowed = new Set(pages)
  return allNavigationKeys.filter((key) => allowed.has(key))
}
