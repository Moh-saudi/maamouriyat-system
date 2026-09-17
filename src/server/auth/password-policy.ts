/**
 * Password Policy Enforcement for V2 Authentication.
 * Meets or exceeds V1 constraints:
 * - Password is required and must be a string.
 * - Minimum length: 6 characters.
 * - Must not match the default temporary password ('123456').
 * - Optional confirmation match check.
 */

export interface PasswordPolicyResult {
  valid: boolean
  error?: string
}

export function validatePasswordPolicy(
  newPassword: unknown,
  confirmPassword?: unknown
): PasswordPolicyResult {
  if (!newPassword || typeof newPassword !== 'string') {
    return {
      valid: false,
      error: 'كلمة المرور الجديدة مطلوبة',
    }
  }

  const trimmed = newPassword.trim()

  if (trimmed.length < 6) {
    return {
      valid: false,
      error: 'كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل',
    }
  }

  if (trimmed === '123456') {
    return {
      valid: false,
      error: 'يجب اختيار كلمة مرور جديدة مختلفة عن الكلمة الافتراضية (123456)',
    }
  }

  if (confirmPassword !== undefined && confirmPassword !== null) {
    if (typeof confirmPassword !== 'string' || confirmPassword !== newPassword) {
      return {
        valid: false,
        error: 'كلمتا المرور غير متطابقتين، يرجى إعادة التأكيد بدقة',
      }
    }
  }

  return { valid: true }
}
