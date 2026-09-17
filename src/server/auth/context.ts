import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { V2AuthState, V2AuthenticatedUser } from './types'

/**
 * Resolves whether the user must change their password.
 *
 * COMPATIBILITY & SECURITY STRATEGY:
 * - `app_metadata.must_change_password` is the authoritative server-controlled source in V2.
 * - If `app_metadata.must_change_password` is explicitly a boolean, its value is final.
 *   (e.g., app_metadata = false overrides legacy user_metadata = true).
 * - If `app_metadata.must_change_password` is undefined/absent, fall back to legacy `user_metadata.must_change_password === true`.
 * - Defaults to `false` if neither is present.
 */
export function resolveMustChangePassword(
  appMetadata?: Record<string, unknown> | null,
  userMetadata?: Record<string, unknown> | null
): boolean {
  if (typeof appMetadata?.must_change_password === 'boolean') {
    return appMetadata.must_change_password
  }

  if (typeof userMetadata?.must_change_password === 'boolean') {
    return userMetadata.must_change_password
  }

  return false
}

/**
 * Authoritative Server Authentication Context for V2.
 *
 * Verifies session cryptographically via Supabase Auth server client, resolves active profile
 * from public.users, verifies active state, and checks forced password flags.
 *
 * Strictly FAILS CLOSED on all exceptions and missing data.
 */
export async function getV2AuthState(): Promise<V2AuthState> {
  try {
    const supabase = await createServerSupabaseClient()
    if (!supabase) {
      console.warn('[V2 Auth Context] Supabase server client not configured.')
      return { status: 'unauthenticated' }
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { status: 'unauthenticated' }
    }

    // Resolve profile from public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(
        'id, email, full_name, job_title, organization_id, sector_id, org_level, level, is_active'
      )
      .eq('auth_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      console.warn(`[V2 Auth Context] Profile missing for auth_id=${user.id}`)
      return { status: 'profile_missing' }
    }

    // Fail-Closed: Only explicit boolean true is considered active.
    // false, null, and undefined are strictly treated as inactive.
    if (profile.is_active !== true) {
      console.warn(
        `[V2 Auth Context] Inactive or unverified user profile id=${profile.id}, is_active=${profile.is_active}`
      )
      return { status: 'inactive' }
    }

    // Resolve organization display name via user-scoped client
    let organizationName = 'جهة غير محددة'
    if (profile.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', profile.organization_id)
        .maybeSingle()

      if (org?.name) {
        organizationName = org.name
      }
    }

    const mustChangePassword = resolveMustChangePassword(
      user.app_metadata,
      user.user_metadata
    )

    const authenticatedUser: V2AuthenticatedUser = {
      authUserId: user.id,
      profileId: profile.id,
      email: profile.email || user.email || '',
      fullName: profile.full_name || 'مستخدم المنظومة',
      jobTitle: profile.job_title || null,
      organizationId: profile.organization_id || null,
      organizationName,
      sectorId: profile.sector_id || null,
      orgLevel: Number(profile.org_level ?? profile.level ?? 7),
      mustChangePassword,
    }

    return {
      status: 'authenticated',
      user: authenticatedUser,
    }
  } catch (error: any) {
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      (error.digest === 'DYNAMIC_SERVER_USAGE' || error.digest.startsWith('NEXT_'))
    ) {
      throw error
    }
    console.error('[V2 Auth Context] Unexpected error resolving auth state:', error)
    // Always fail closed
    return { status: 'unauthenticated' }
  }
}
