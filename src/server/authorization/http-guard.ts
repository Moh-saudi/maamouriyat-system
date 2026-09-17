import 'server-only'

import { NextResponse } from 'next/server'
import { getV2AccessState, hasV2Permission } from '@/server/authorization'
import type { V2AuthenticatedUser } from '@/server/auth/types'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'

export type V2AuthorizedRequestContext = {
  ok: true
  user: V2AuthenticatedUser
  access: V2AuthorizationSnapshot
}

export type V2RejectedRequestContext = {
  ok: false
  response: NextResponse
}

export type V2PermissionRequestContext =
  | V2AuthorizedRequestContext
  | V2RejectedRequestContext

function reject(
  status: number,
  error: string,
  code: string
): V2RejectedRequestContext {
  return {
    ok: false,
    response: NextResponse.json({ error, code }, { status }),
  }
}

/**
 * Canonical V2 API/service permission gate.
 *
 * This performs, in order:
 * 1. Verified server authentication.
 * 2. Active-profile enforcement.
 * 3. Forced-password enforcement.
 * 4. RBAC availability enforcement.
 * 5. Explicit permission check.
 *
 * It intentionally does NOT perform resource scope evaluation; callers must use
 * checkV2ResourceAccess() with trusted DB-derived resource context where needed.
 */
export async function requireV2Permission(
  permissionKey: string
): Promise<V2PermissionRequestContext> {
  const state = await getV2AccessState()

  if (state.status === 'unauthenticated') {
    return reject(401, 'غير مصرح بالدخول', 'UNAUTHENTICATED')
  }

  if (state.status === 'profile_missing') {
    return reject(403, 'ملف المستخدم غير موجود', 'PROFILE_MISSING')
  }

  if (state.status === 'inactive') {
    return reject(403, 'الحساب غير نشط', 'ACCOUNT_INACTIVE')
  }

  if (state.status === 'password_change_required') {
    return reject(
      403,
      'يجب تغيير كلمة المرور الافتراضية قبل استخدام هذه العملية',
      'PASSWORD_CHANGE_REQUIRED'
    )
  }

  if (state.status === 'authorization_unavailable') {
    return reject(
      503,
      'تعذر التحقق من الصلاحيات حالياً',
      'AUTHORIZATION_UNAVAILABLE'
    )
  }

  if (!hasV2Permission(state.access, permissionKey)) {
    return reject(403, 'ليس لديك صلاحية تنفيذ هذه العملية', 'PERMISSION_DENIED')
  }

  return {
    ok: true,
    user: state.user,
    access: state.access,
  }
}
