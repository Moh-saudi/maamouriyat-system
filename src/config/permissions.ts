import type { NavItem } from './navigation'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'

export const V2_NAV_PERMISSION_BY_ID: Readonly<Record<string, string>> = {
  dashboard: 'dashboard.view',
  missions: 'missions.view',
  violations: 'violations.view',
  facilities: 'facilities.view',
  targets: 'targets.view',
  checklists: 'checklists.design',
  organizations: 'organizations.view',
  users: 'users.view',
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
    return snapshot.permissions[permissionKey]?.granted === true
  })
}
