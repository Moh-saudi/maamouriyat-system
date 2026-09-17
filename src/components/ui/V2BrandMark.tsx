import Image from 'next/image'
import { BRANDING } from '@/config/branding'

interface V2BrandMarkProps {
  showSubtitle?: boolean
  className?: string
}

export function V2BrandMark({ showSubtitle = true, className = '' }: V2BrandMarkProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-teal-50 border border-teal-200">
        <Image
          src={BRANDING.logos.primary}
          alt={BRANDING.ministry}
          width={32}
          height={32}
          className="object-contain"
          priority
        />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-slate-900 leading-tight">
          {BRANDING.systemName}
        </span>
        {showSubtitle && (
          <span className="text-xs text-slate-500 mt-0.5">
            {BRANDING.ministry} — {BRANDING.country}
          </span>
        )}
      </div>
    </div>
  )
}
