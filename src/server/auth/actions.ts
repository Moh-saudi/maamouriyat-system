'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAdminSupabaseClient } from '@/server/supabase/admin'
import { validatePasswordPolicy } from './password-policy'

export interface ChangePasswordState {
  error?: string
}

/**
 * Server Action for authenticated users to change their own password in V2.
 *
 * SECURITY CONTROLS:
 * - Session re-verified server-side; user ID taken exclusively from session.
 * - Password validated against shared policy.
 * - Clears both app_metadata and legacy user_metadata flags.
 * - Password is never exposed in logs.
 * - Redirects to /v2/dashboard on success.
 */
export async function changeOwnPasswordAction(
  _prevState: ChangePasswordState | null,
  formData: FormData
): Promise<ChangePasswordState> {
  const newPassword = formData.get('newPassword')
  const confirmPassword = formData.get('confirmPassword')

  // 1. Password policy verification
  const policyResult = validatePasswordPolicy(newPassword, confirmPassword)
  if (!policyResult.valid) {
    return { error: policyResult.error }
  }

  // 2. Server session verification
  const supabase = await createServerSupabaseClient()
  if (!supabase) {
    return { error: 'تعذر التحقق من خادم الاتصال. يرجى المحاولة لاحقاً.' }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'انتهت صلاحية جلسة الدخول. يرجى تسجيل الدخول مجدداً.' }
  }

  // 3. Admin update via service role using freshest auth record
  try {
    const admin = getAdminSupabaseClient()

    // Fetch latest auth user to avoid overwriting recent admin metadata updates
    const { data: latestUserData, error: latestUserError } =
      await admin.auth.admin.getUserById(user.id)

    if (latestUserError || !latestUserData?.user) {
      console.error(
        '[V2 Auth Action] Failed to fetch latest auth record for user ID:',
        user.id
      )
      return { error: 'تعذر التحقق من أحدث بيانات الحساب على الخادم. يرجى إعادة المحاولة.' }
    }

    const latestAuthUser = latestUserData.user
    const validPassword = policyResult.normalizedPassword || String(newPassword)

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: validPassword,
      app_metadata: {
        ...(latestAuthUser.app_metadata || {}),
        must_change_password: false,
      },
      user_metadata: {
        ...(latestAuthUser.user_metadata || {}),
        must_change_password: false,
      },
    })

    if (updateError) {
      console.error('[V2 Auth Action] updateUserById error status:', updateError.status)
      return { error: 'فشل تحديث كلمة المرور في الخادم. يرجى المحاولة لاحقاً.' }
    }
  } catch (err: unknown) {
    console.error('[V2 Auth Action] Error executing password change service call')
    return { error: 'حدث خطأ غير متوقع أثناء معالجة الطلب على الخادم.' }
  }

  // 4. Redirect upon successful password update
  redirect('/v2/dashboard')
}

/**
 * Server Action to sign out from V2 session and redirect to /login.
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.warn('[V2 Auth Action] signOut returned error status:', error.status)
      }
    } catch {
      console.warn('[V2 Auth Action] signOut caught unexpected exception')
    }
  }
  redirect('/login')
}
