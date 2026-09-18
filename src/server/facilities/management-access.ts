import 'server-only'

import { hasV2Permission } from '@/server/authorization'
import { loadV2OrganizationFacts } from '@/server/authorization/organization-scope-repository'
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

const MINISTRY_FALLBACK_BLOCKED_TYPES = new Set([
  'sector',
  'central_administration',
  'general_administration',
])

function resolveFacilityManagementAnchor(input: {
  assignmentOrganizationId: string
  facts: Awaited<ReturnType<typeof loadV2OrganizationFacts>>
  activeOrganizationIds: ReadonlySet<string>
}): FacilityManagementAnchor | null {
  const { assignmentOrganizationId, facts, activeOrganizationIds } = input

  let currentId: string | null = assignmentOrganizationId
  let crossedCentralBranch = false
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) return null
    visited.add(currentId)

    const fact = facts.get(currentId)
    if (!fact || !activeOrganizationIds.has(currentId)) return null

    const organizationTypeCode = fact.organizationTypeCode

    if (organizationTypeCode === 'health_administration') {
      return {
        organizationId: fact.id,
        organizationTypeCode,
        governorate: fact.governorate,
      }
    }

    if (organizationTypeCode === 'health_directorate') {
      if (!fact.governorate) return null

      return {
        organizationId: fact.id,
        organizationTypeCode,
        governorate: fact.governorate,
      }
    }

    if (organizationTypeCode === 'ministry') {
      // A role assigned directly to the ministry is always explicit. For a
      // ministry-level Information Center represented by a simple child unit,
      // allow the direct ancestry fallback only when the path did not pass
      // through a central sector/administration branch first.
      if (
        currentId !== assignmentOrganizationId &&
        crossedCentralBranch
      ) {
        return null
      }

      return {
        organizationId: fact.id,
        organizationTypeCode,
        governorate: fact.governorate,
      }
    }

    if (
      organizationTypeCode &&
      MINISTRY_FALLBACK_BLOCKED_TYPES.has(organizationTypeCode)
    ) {
      crossedCentralBranch = true
    }

    currentId = fact.parentId
  }

  return null
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

  const assignmentOrganizationIds = [
    ...new Set(
      informationCenterAssignments
        .map(
          (role) =>
            role.assignmentOrganizationId ?? input.user.organizationId
        )
        .filter((value): value is string => Boolean(value))
    ),
  ]

  if (assignmentOrganizationIds.length === 0) {
    return {
      isInformationCenter: true,
      canCreate: false,
      canEdit: false,
      canDeactivate: false,
      canAudit: false,
      anchors: [],
    }
  }

  const facts = await loadV2OrganizationFacts(assignmentOrganizationIds)
  const factIds = [...facts.keys()]

  const admin = getAdminSupabaseClient()
  const { data: activeRows, error: activeRowsError } = await admin
    .from('organizations')
    .select('id, is_active')
    .in('id', factIds)

  if (activeRowsError) {
    throw new Error(
      `[Facility Management] Failed to validate information-center ancestry: ${activeRowsError.message}`
    )
  }

  const activeOrganizationIds = new Set(
    (activeRows ?? [])
      .filter((row) => row.is_active === true)
      .map((row) => String(row.id))
  )

  const anchorsById = new Map<string, FacilityManagementAnchor>()

  for (const assignmentOrganizationId of assignmentOrganizationIds) {
    const anchor = resolveFacilityManagementAnchor({
      assignmentOrganizationId,
      facts,
      activeOrganizationIds,
    })

    if (anchor) {
      anchorsById.set(anchor.organizationId, anchor)
    }
  }

  const anchors = [...anchorsById.values()]
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
