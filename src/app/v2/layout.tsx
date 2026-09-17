import './v2.css'
import type { Metadata } from 'next'
import { BRANDING } from '@/config/branding'

export const metadata: Metadata = {
  title: `${BRANDING.systemName} | ${BRANDING.shortName} V2`,
  description: `${BRANDING.systemName} — ${BRANDING.ministry}`,
}

export default function V2RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="v2-root min-h-screen bg-slate-50 text-slate-900" dir="rtl">
      {children}
    </div>
  )
}
