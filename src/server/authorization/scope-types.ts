import type { V2PermissionSource, V2ScopeType } from './types'

export interface V2OrganizationFact {
  id: string
  parentId: string | null
  sectorId: string | null
  governorate: string | null
  level: number
  organizationTypeCode: string | null
}

export interface V2ResourceScopeContext {
  /**
   * public.users.id (profile id), not auth.users.id.
   */
  ownerUserId?: string | null

  /**
   * public.users.id values of users explicitly assigned to the resource.
   */
  assignedUserIds?: readonly string[]

  /**
   * Canonical public.organizations.id associated with the resource.
   */
  organizationId?: string | null

  /**
   * Optional denormalized sector/governorate values read from the DB.
   * The resolver falls back to organization facts when omitted.
   */
  sectorId?: string | null
  governorate?: string | null
}

export interface V2ScopeMatch {
  scopeType: V2ScopeType
  source: V2PermissionSource
  anchorOrganizationId: string | null
}

export type V2ScopeDecision =
  | {
      allowed: true
      match: V2ScopeMatch
    }
  | {
      allowed: false
      reason:
        | 'permission_not_granted'
        | 'no_scope_source_matched'
        | 'missing_resource_context'
        | 'organization_context_unavailable'
    }
