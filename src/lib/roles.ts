export const demoPassword = '123456'

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

export type DemoRole = keyof typeof roleDefinitions
export type NavigationKey = (typeof roleDefinitions)[DemoRole]['navigation'][number]

export const demoEmailToRoleMap: Record<string, DemoRole> = {
  'admin@admin.com': 'superadmin',
  'superadmin@mohp.gov.eg': 'superadmin',
  'techadmin@mohp.gov.eg': 'techadmin',
  'techadmin@admin.com': 'techadmin',
  'director@director.com': 'central',
  'central@mohp.gov.eg': 'central',
  'supervisor@supervisor.com': 'generalmanager',
  'generalmanager@mohp.gov.eg': 'generalmanager',
  'creator@mohp.gov.eg': 'creator',
  'financial@mohp.gov.eg': 'financial',
  'inspector@inspector.com': 'inspector',
  'inspector@mohp.gov.eg': 'inspector',
  'corrections@corrections.com': 'inspector',
}

export const demoRoleAliases: Record<string, DemoRole> = {
  admin: 'superadmin',
  superadmin: 'superadmin',
  techadmin: 'techadmin',
  director: 'central',
  central: 'central',
  supervisor: 'generalmanager',
  generalmanager: 'generalmanager',
  creator: 'creator',
  financial: 'financial',
  inspector: 'inspector',
  corrections: 'inspector',
}

export const demoAccounts = Array.from(new Set([
  ...Object.keys(demoEmailToRoleMap),
  ...Object.values(roleDefinitions).map((role) => role.email)
]))

export const demoSessionRoles = Object.keys(roleDefinitions) as DemoRole[]

export function normalizeDemoRole(value?: string | null): DemoRole | null {
  if (!value) return null
  const normalized = decodeURIComponent(value).trim().toLowerCase()
  
  if (demoEmailToRoleMap[normalized]) {
    return demoEmailToRoleMap[normalized]
  }
  
  if (demoSessionRoles.includes(normalized as DemoRole)) {
    return normalized as DemoRole
  }
  
  if (demoRoleAliases[normalized]) {
    return demoRoleAliases[normalized]
  }
  
  const prefix = normalized.includes('@') ? normalized.split('@')[0] : normalized
  
  if (demoRoleAliases[prefix]) {
    return demoRoleAliases[prefix]
  }
  
  if (demoSessionRoles.includes(prefix as DemoRole)) {
    return prefix as DemoRole
  }

  return null
}

export function isDemoAccount(email: string) {
  return (demoAccounts as readonly string[]).includes(email.trim().toLowerCase())
}

export function getRoleDefinition(role: DemoRole | null | undefined) {
  return roleDefinitions[role ?? 'superadmin']
}

export function getRoleNavigation(role: DemoRole, dynamicPermissionsRaw?: string | null): readonly NavigationKey[] {
  if (dynamicPermissionsRaw) {
    try {
      const decoded = dynamicPermissionsRaw.includes('%') ? decodeURIComponent(dynamicPermissionsRaw) : dynamicPermissionsRaw
      const parsed = JSON.parse(decoded)
      if (parsed && parsed[role] && Array.isArray(parsed[role])) {
        return parsed[role] as readonly NavigationKey[]
      }
    } catch {}
  }
  return roleDefinitions[role].navigation
}

export function getUserNavigation(
  emailOrId: string | null | undefined,
  role: DemoRole,
  dynamicPermissionsRaw?: string | null,
  userPermissionsRaw?: string | null
): readonly NavigationKey[] {
  if (emailOrId && userPermissionsRaw) {
    try {
      const decoded = userPermissionsRaw.includes('%') ? decodeURIComponent(userPermissionsRaw) : userPermissionsRaw
      const parsed = JSON.parse(decoded)
      const userKey = emailOrId.trim().toLowerCase()
      
      const resolvedRole = normalizeDemoRole(userKey) || role
      
      if (parsed) {
        // 1. Match literal key (e.g. email)
        if (parsed[userKey] && Array.isArray(parsed[userKey])) {
          return parsed[userKey] as readonly NavigationKey[]
        }
        
        // 2. Match resolved role key (e.g. 'superadmin', 'techadmin')
        if (parsed[resolvedRole] && Array.isArray(parsed[resolvedRole])) {
          return parsed[resolvedRole] as readonly NavigationKey[]
        }
        
        // 3. Match any key that maps to the same resolved role
        const matchedKey = Object.keys(parsed).find(
          (k) => normalizeDemoRole(k) === resolvedRole
        )
        if (matchedKey && Array.isArray(parsed[matchedKey])) {
          return parsed[matchedKey] as readonly NavigationKey[]
        }
      }
    } catch {}
  }
  return getRoleNavigation(role, dynamicPermissionsRaw)
}

