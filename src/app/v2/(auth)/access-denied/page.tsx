import Image from 'next/image'
import { ShieldAlert, LogOut } from 'lucide-react'
import { BRANDING } from '@/config/branding'
import { logoutAction } from '@/server/auth/actions'

export const metadata = {
  title: `غير مصرح بالوصول | ${BRANDING.shortName} V2`,
}

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center">
        {/* Ministry Branding Logo */}
        <div className="flex justify-center mb-5">
          <Image
            src={BRANDING.logos.primary}
            alt={BRANDING.shortName}
            width={56}
            height={56}
            className="object-contain"
            priority
          />
        </div>

        {/* Warning Icon Badge */}
        <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>

        <h1 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
          تعذر السماح بالوصول
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          تعذر السماح لهذا الحساب بالوصول إلى المنظومة. يرجى التواصل مع مسؤول النظام.
        </p>

        {/* Action Button: Logout */}
        <form action={logoutAction} className="w-full">
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>تسجيل الخروج والعودة</span>
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
          <span>{BRANDING.ministry}</span>
        </div>
      </div>
    </div>
  )
}
