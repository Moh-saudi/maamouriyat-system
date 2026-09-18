import 'server-only'

import { hasV2Permission } from '@/server/authorization'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2AuthenticatedUser } from '@/server/auth/types'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'

export type FacilityManagementAnchor = {
  organizationId: string
  organizationTypeCode:
    | 'ministry'
    | 'health_directorate'
    | 'health_administration'
  governorate: string | null
}

export type FacilityManagementCapabilities = {
  isInformationCenter: boolean
  canCreate: boolean
  canEdit: boolean
  canDeactivate: boolean
  canAudit: boolean
  anchors: FacilityManagementAnchor[]
}

export type FacilityManagementResource = {
  organizationId: string | null
  governorate: string | null
}

export async function getFacilityManagementCapabilities(input: {
  user: V2AuthenticatedUser
  access: V2AuthorizationSnapshot
}): Promise<FacilityManagementCapabilities> {
  const informationCenterAssignments = input.access.roles.filter(
    (role) => role.roleCode === 'information_center'
  )

  if (informationCenterAssignments.length === 0) {
    return {
      isInformationCenter: false,
      canCreate: false,
      canEdit: false,
      canDeactivate: false,
      canAudit: false,
      anchors: [],
    }
  }

  const anchorIds = [
    ...new Set(
      informationCenterAssignments
        .map(
          (role) =>
            role.assignmentOrganizationId ?? input.user.organizationId
        )
        .filter((value): value is string => Boolean(value))
    ),
  ]

  if (anchorIds.length === 0) {
    return {
      isInformationCenter: true,
      canCreate: false,
      canEdit: false,
      canDeactivate: false,
      canAudit: false,
      anchors: [],
    }
  }

  const admin = getAdminSupabaseClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, organization_type_code, governorate')
    .in('id', anchorIds)
    .eq('is_active', true)

  if (error) {
    throw new Error(
      `[Facility Management] Failed to load information-center anchors: ${error.message}`
    )
  }

  // Facility data correction is intentionally supported only from the
  // ministry, directorate, and health-administration branches. Central-sector
  // hierarchy must not accidentally become an ownership boundary for regional
  // facilities.
  const anchors: FacilityManagementAnchor[] = (data ?? [])
    .flatMap((row) => {
      const organizationTypeCode =
        typeof row.organization_type_code === 'string'
          ? row.organization_type_code
          : ''

      if (
        organizationTypeCode !== 'ministry' &&
        organizationTypeCode !== 'health_directorate' &&
        organizationTypeCode !== 'health_administration'
      ) {
        return []
      }

      return [
        {
          organizationId: String(row.id),
          organizationTypeCode,
          governorate:
            typeof row.governorate === 'string' && row.governorate.trim()
              ? row.governorate.trim()
              : null,
        },
      ]
    })

  const hasEligibleAnchor = anchors.length > 0

  return {
    isInformationCenter: true,
    canCreate:
      hasEligibleAnchor &&
      hasV2Permission(input.access, 'facilities.create'),
    canEdit:
      hasEligibleAnchor &&
      hasV2Permission(input.access, 'facilities.edit'),
    canDeactivate:
      hasEligibleAnchor &&
      hasV2Permission(input.access, 'facilities.deactivate'),
    canAudit:
      hasEligibleAnchor &&
      hasV2Permission(input.access, 'facilities.audit'),
    anchors,
  }
}

export function canInformationCenterManageFacility(input: {
  capabilities: FacilityManagementCapabilities
  resource: FacilityManagementResource
}): boolean {
  const { capabilities, resource } = input

  if (!capabilities.isInformationCenter) return false

  return capabilities.anchors.some((anchor) => {
    if (anchor.organizationTypeCode === 'ministry') return true

    if (anchor.organizationTypeCode === 'health_directorate') {
      return Boolean(
        anchor.governorate &&
          resource.governorate &&
          anchor.governorate === resource.governorate
      )
    }

    if (anchor.organizationTypeCode === 'health_administration') {
      return Boolean(
        resource.organizationId &&
          resource.organizationId === anchor.organizationId
      )
    }

    return false
  })
}
