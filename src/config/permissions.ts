import type { NavItem } from './navigation'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'

export const V2_NAV_PERMISSION_BY_ID: Readonly<
  Record<string, string | readonly string[]>
> = {
  dashboard: 'dashboard.view',
  missions: 'missions.view',
  violations: 'violations.view',
  facilities: 'facilities.view',
  targets: 'targets.view',
  checklists: 'checklists.design',
  organizations: 'organizations.view',
  users: 'users.view',
  finance: 'finance.view',
  reports: ['reports.missions_view', 'reports.finance_view'],
  settings: 'settings.view',
}

export function filterV2NavigationItems(
  items: readonly NavItem[],
  snapshot: V2AuthorizationSnapshot
): NavItem[] {
  return items.filter((item) => {
    if (item.id === 'help') return true

    const permissionKey = V2_NAV_PERMISSION_BY_ID[item.id]
    if (!permissionKey) return false

    if (Array.isArray(permissionKey)) {
      return permissionKey.some(
        (key) => snapshot.permissions[key]?.granted === true
      )
    }

    return snapshot.permissions[permissionKey]?.granted === true
  })
}
