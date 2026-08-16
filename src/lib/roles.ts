// ══════════════════════════════════════════════════════════════
// نظام الأدوار والصلاحيات
// متوافق مع هيكل organizations (7 مستويات) الجديد
// ══════════════════════════════════════════════════════════════

/** مستويات الهيكل التنظيمي */
export const ORG_LEVELS = {
  MINISTRY:       1,  // وزارة الصحة والسكان
  SECTOR:         2,  // قطاع مركزي (رعاية أساسية / علاجي / وقائي ...)
  CENTRAL_ADMIN:  3,  // إدارة مركزية
  GENERAL_ADMIN:  4,  // إدارة عامة
  DIRECTORATE:    5,  // مديرية شئون صحية (27 محافظة)
  HEALTH_ADMIN:   6,  // إدارة صحية (داخل المديرية)
  UNIT:           7,  // وحدة / مفتش ميداني
  TECH:           0,  // دعم فني (خارج الهرم)
} as const

export type OrgLevel = typeof ORG_LEVELS[keyof typeof ORG_LEVELS]

/** تسميات المستويات */
export const ORG_LEVEL_LABELS: Record<number, string> = {
  0: 'دعم فني',
  1: 'الوزارة',
  2: 'قطاع مركزي',
  3: 'إدارة مركزية',
  4: 'إدارة عامة',
  5: 'مديرية شئون صحية',
  6: 'إدارة صحية',
  7: 'وحدة / ميداني',
}

export const roleDefinitions = {
  superadmin: {
    department: 'ديوان عام وزارة الصحة والسكان',
    homeLabel: 'لوحة التحكم الكبرى',
    jobTitle: 'مشرف عام المنظومة',
    name: 'مشرف عام',
    navigation: ['dashboard', 'missions', 'violations', 'facilities', 'users', 'settings', 'checklists'] as const,
    minLevel: 1,
    maxLevel: 1,
  },
  techadmin: {
    department: 'الإدارة العامة لنظم المعلومات والتحول الرقمي',
    homeLabel: 'لوحة التحكم التقنية',
    jobTitle: 'مدير الدعم الفني',
    name: 'الدعم الفني',
    navigation: ['dashboard', 'facilities', 'users', 'checklists', 'settings'] as const,
    minLevel: 0,
    maxLevel: 0,
  },
  sector: {
    department: 'قطاع مركزي',
    homeLabel: 'لوحة القطاع المركزي',
    jobTitle: 'مسؤول القطاع',
    name: 'مسؤول قطاع',
    navigation: ['dashboard', 'missions', 'violations', 'facilities', 'users'] as const,
    minLevel: 2,
    maxLevel: 2,
  },
  central: {
    department: 'إدارة مركزية',
    homeLabel: 'لوحة الإدارة المركزية',
    jobTitle: 'رئيس إدارة مركزية',
    name: 'رئيس إدارة مركزية',
    navigation: ['dashboard', 'missions', 'violations', 'facilities'] as const,
    minLevel: 3,
    maxLevel: 3,
  },
  generalmanager: {
    department: 'إدارة عامة',
    homeLabel: 'لوحة الإدارة العامة',
    jobTitle: 'مدير عام',
    name: 'مدير عام',
    navigation: ['dashboard', 'missions', 'violations', 'facilities'] as const,
    minLevel: 4,
    maxLevel: 4,
  },
  directorate: {
    department: 'مديرية الشئون الصحية',
    homeLabel: 'لوحة المديرية',
    jobTitle: 'مدير المديرية',
    name: 'مدير مديرية',
    navigation: ['dashboard', 'missions', 'violations', 'facilities'] as const,
    minLevel: 5,
    maxLevel: 5,
  },
  creator: {
    department: 'إدارة صحية',
    homeLabel: 'لوحة الإدارة الصحية',
    jobTitle: 'مدير الإدارة الصحية',
    name: 'مدير إدارة صحية',
    navigation: ['dashboard', 'missions', 'violations'] as const,
    minLevel: 6,
    maxLevel: 6,
  },
  inspector: {
    department: 'وحدة ميدانية',
    homeLabel: 'مأمورياتي الميدانية',
    jobTitle: 'القائم بالمرور',
    name: 'القائم بالمرور',
    navigation: ['dashboard', 'missions', 'violations'] as const,
    minLevel: 7,
    maxLevel: 7,
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

/**
 * تحويل مستوى الجهة التنظيمية إلى دور في النظام
 * يعمل مع هيكل organizations الجديد (7 مستويات)
 */
export function orgLevelToRole(orgLevel: number, jobTitle?: string | null): UserRole {
  if (jobTitle && (jobTitle.includes('مفتش') || jobTitle.includes('قائم بالمرور'))) {
    return 'inspector'
  }
  if (orgLevel <= 0) return 'techadmin'
  if (orgLevel === 1) return 'superadmin'
  if (orgLevel === 2) return 'sector'
  if (orgLevel === 3) return 'central'
  if (orgLevel === 4) return 'generalmanager'
  if (orgLevel === 5) return 'directorate'
  if (orgLevel === 6) return 'creator'
  return 'inspector' // المستوى 7
}

/**
 * متوافق مع الكود القديم — يستخدم orgLevelToRole داخلياً
 * @deprecated استخدم orgLevelToRole بدلاً منها
 */
export function levelToRole(level: number, jobTitle?: string | null): UserRole {
  return orgLevelToRole(level, jobTitle)
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

/** هل لهذا الدور صلاحية إنشاء مأموريات؟ */
export function canCreateMissions(orgLevel: number): boolean {
  return orgLevel >= 1 && orgLevel <= 6
}

/** هل لهذا الدور صلاحية التفتيش الميداني؟ */
export function canInspect(orgLevel: number): boolean {
  return orgLevel >= 5
}

/** هل لهذا الدور صلاحية إدارة المستخدمين؟ */
export function canManageUsers(orgLevel: number): boolean {
  return orgLevel <= 2
}

/** هل يمكنه رؤية كل المحافظات؟ */
export function hasNationalScope(orgLevel: number): boolean {
  return orgLevel <= 4
}

/** هل يمكنه رؤية كل المحافظة؟ */
export function hasGovernorateScope(orgLevel: number): boolean {
  return orgLevel === 5
}
