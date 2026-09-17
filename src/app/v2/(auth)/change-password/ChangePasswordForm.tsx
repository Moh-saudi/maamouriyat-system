'use client'

import { useState, useActionState } from 'react'
import { Eye, EyeOff, Lock, AlertCircle, ArrowRight } from 'lucide-react'
import { changeOwnPasswordAction } from '@/server/auth/actions'
import { logoutAction } from '@/server/auth/actions'

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changeOwnPasswordAction, { error: undefined })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  return (
    <div>
      {/* Error alert if returned from Server Action */}
      {state?.error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {/* New Password Input */}
        <div>
          <label
            htmlFor="newPassword"
            className="block text-xs font-semibold text-slate-700 mb-1.5 text-right"
          >
            كلمة المرور الجديدة
          </label>
          <div className="relative">
            <input
              id="newPassword"
              name="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={isPending}
              className="w-full h-11 px-3.5 pl-10 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all outline-hidden text-right"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              tabIndex={-1}
              aria-label={showNewPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showNewPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 text-right">
            يجب أن تتكون من 6 أحرف أو أرقام على الأقل وتختلف عن كلمة المرور الافتراضية.
          </p>
        </div>

        {/* Confirm Password Input */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-semibold text-slate-700 mb-1.5 text-right"
          >
            تأكيد كلمة المرور الجديدة
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={isPending}
              className="w-full h-11 px-3.5 pl-10 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all outline-hidden text-right"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              tabIndex={-1}
              aria-label={showConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-2 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-semibold text-sm transition-all shadow-xs hover:shadow-sm focus-visible:outline-2 focus-visible:outline-teal-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Lock className="w-4 h-4" aria-hidden="true" />
          <span>{isPending ? 'جارٍ التحديث...' : 'حفظ كلمة المرور ومتابعة الدخول'}</span>
        </button>
      </form>

      {/* Logout option */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">هل ترغب في تسجيل الخروج؟</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs font-semibold text-slate-600 hover:text-rose-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <span>تسجيل الخروج</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  )
}
