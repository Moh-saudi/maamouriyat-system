// ══════════════════════════════════════════════════════════════
// هيكل التنقل المركزي لمنظومة V2 (مستقل عن الصلاحيات القديمة)
// Central Structural Navigation Definitions for V2 App Shell
// ══════════════════════════════════════════════════════════════

export type NavGroupKey = 'main' | 'operations' | 'admin'

export type NavItem = {
  id: string
  label: string
  href: string
  iconName: string
  group: NavGroupKey
  mobilePriority: number // 1 to 4: Primary bottom bar; > 4: In "More" sheet
  description?: string
}

export const V2_NAV_GROUPS: Record<NavGroupKey, string> = {
  main: 'الرئيسية',
  operations: 'العمل الميداني والرقابة',
  admin: 'إدارة المنظومة',
} as const

export const V2_NAVIGATION_ITEMS: readonly NavItem[] = [
  // ── المجموعة الأولى: الرئيسية
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    href: '/v2/dashboard',
    iconName: 'LayoutDashboard',
    group: 'main',
    mobilePriority: 1,
    description: 'المؤشرات العامة ونسب الإنجاز والتغطية الجغرافية',
  },
  // ── المجموعة الثانية: العمل الميداني والرقابة
  {
    id: 'missions',
    label: 'المأموريات الميدانية',
    href: '/v2/missions',
    iconName: 'ClipboardList',
    group: 'operations',
    mobilePriority: 2,
    description: 'إدارة وجدولة وتنفيذ ومتابعة زيارات المرور الميداني',
  },
  {
    id: 'violations',
    label: 'سجل المخالفات',
    href: '/v2/violations',
    iconName: 'AlertTriangle',
    group: 'operations',
    mobilePriority: 3,
    description: 'رصد وتصعيد ومعالجة المخالفات الطبية والإدارية',
  },
  {
    id: 'facilities',
    label: 'المنشآت الصحية',
    href: '/v2/facilities',
    iconName: 'Building2',
    group: 'operations',
    mobilePriority: 4,
    description: 'دليل المستشفيات والمراكز ووحدات الرعاية الأولية',
  },
  {
    id: 'targets',
    label: 'المستهدفات',
    href: '/v2/targets',
    iconName: 'Target',
    group: 'operations',
    mobilePriority: 5,
    description: 'مستهدفات القيادات وخطط المرور الدورية',
  },
  {
    id: 'checklists',
    label: 'نماذج التقييم',
    href: '/v2/checklists',
    iconName: 'CheckSquare',
    group: 'operations',
    mobilePriority: 6,
    description: 'القوائم المرجعية ومعايير التفتيش الفنية',
  },
  // ── المجموعة الثالثة: الإدارة والنظام
  {
    id: 'organizations',
    label: 'الهيكل التنظيمي',
    href: '/v2/organizations',
    iconName: 'Network',
    group: 'admin',
    mobilePriority: 7,
    description: 'قطاعات وإدارات ومديريات الشئون الصحية',
  },
  {
    id: 'users',
    label: 'المستخدمون',
    href: '/v2/users',
    iconName: 'Users',
    group: 'admin',
    mobilePriority: 8,
    description: 'إدارة حسابات القيادات والمفتشين الميدانيين',
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    href: '/v2/settings',
    iconName: 'Settings',
    group: 'admin',
    mobilePriority: 9,
    description: 'إعدادات المنظومة وسجلات التدقيق والأمان',
  },
] as const

/**
 * فلترة العناصر الأساسية للشريط السفلي للهواتف المحمولة (أعلى 4 عناصر كحد أقصى)
 */
export function getMobilePrimaryNavItems(
  items: readonly NavItem[] = V2_NAVIGATION_ITEMS,
  maxItems = 4
): NavItem[] {
  return [...items]
    .sort((a, b) => a.mobilePriority - b.mobilePriority)
    .slice(0, maxItems)
}

/**
 * جلب العناصر المتبقية التي تُعرض داخل قائمة "المزيد" للهواتف المحمولة
 */
export function getMobileMoreNavItems(
  items: readonly NavItem[] = V2_NAVIGATION_ITEMS,
  maxPrimary = 4
): NavItem[] {
  const sorted = [...items].sort((a, b) => a.mobilePriority - b.mobilePriority)
  return sorted.slice(maxPrimary)
}

/**
 * فحص مطابقة المسار النشط بشكل موحد عبر جميع مكونات التنقل
 */
export function isRouteActive(currentPath: string, targetHref: string): boolean {
  if (targetHref === '/v2/dashboard') {
    return currentPath === '/v2/dashboard' || currentPath === '/v2'
  }
  return currentPath === targetHref || currentPath.startsWith(`${targetHref}/`)
}
