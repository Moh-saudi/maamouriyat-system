import { redirect } from 'next/navigation'
import Image from 'next/image'
import { KeyRound } from 'lucide-react'
import { BRANDING } from '@/config/branding'
import { getV2AuthState } from '@/server/auth/context'
import { ChangePasswordForm } from './ChangePasswordForm'

export const metadata = {
  title: `تغيير كلمة المرور | ${BRANDING.shortName} V2`,
}

export default async function ChangePasswordPage() {
  const authState = await getV2AuthState()

  // Gating controls
  if (authState.status === 'unauthenticated') {
    redirect('/login')
  }

  if (authState.status === 'profile_missing' || authState.status === 'inactive') {
    redirect('/v2/access-denied')
  }

  const { user } = authState

  // If the user is already compliant, send them straight to the dashboard
  if (!user.mustChangePassword) {
    redirect('/v2/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <Image
            src={BRANDING.logos.primary}
            alt={BRANDING.shortName}
            width={52}
            height={52}
            className="object-contain mb-3"
            priority
          />
          <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 mb-2">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            تغيير كلمة المرور
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            يجب تعيين كلمة مرور جديدة قبل متابعة استخدام المنظومة.
          </p>
        </div>

        {/* Change Password Interactive Form */}
        <ChangePasswordForm />
      </div>
    </div>
  )
}
