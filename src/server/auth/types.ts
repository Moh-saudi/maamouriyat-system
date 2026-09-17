/**
 * V2 Server Authentication Context Types
 * Strictly decoupled from dynamic RBAC and permissions (Phase 3A).
 */

export interface V2AuthenticatedUser {
  authUserId: string
  profileId: string
  email: string
  fullName: string
  jobTitle: string | null
  organizationId: string | null
  organizationName: string
  sectorId: string | null
  /**
   * Organizational tier (1-7) representing administrative hierarchy context.
   * NOTE: This is organizational context ONLY and MUST NOT be used for feature authorization.
   */
  orgLevel: number
  mustChangePassword: boolean
}

export type V2AuthState =
  | { status: 'unauthenticated' }
  | { status: 'profile_missing' }
  | { status: 'inactive' }
  | { status: 'authenticated'; user: V2AuthenticatedUser }
