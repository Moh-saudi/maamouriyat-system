'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { UserMenu, type UserMenuProps } from './UserMenu'
import { BRANDING } from '@/config/branding'
import {
  V2_NAVIGATION_ITEMS,
  isRouteActive,
  type NavItem,
} from '@/config/navigation'

interface TopbarProps {
  user?: UserMenuProps
  items?: readonly NavItem[]
  homeHref?: string
}

export function Topbar({
  user,
  items = V2_NAVIGATION_ITEMS,
  homeHref = '/v2/dashboard',
}: TopbarProps) {
  const pathname = usePathname()
  const currentNav =
    items.find((item) => isRouteActive(pathname, item.href)) ||
    { label: 'المنظومة', href: homeHref }

  return (
    <header className="sticky top-0 z-30 flex h-[72px] w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={homeHref}
          className="flex shrink-0 items-center md:hidden"
          aria-label={BRANDING.ministry}
        >
          <Image
            src={BRANDING.logos.primary}
            alt={BRANDING.ministry}
            width={32}
            height={32}
            className="object-contain"
          />
        </Link>

        <div className="min-w-0">
          <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
            {BRANDING.ministry}
          </p>
          <h2 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">
            {currentNav.label}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="التنبيهات"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal-600 ring-2 ring-white" />
        </button>

        <div className="hidden h-6 w-px bg-slate-200 sm:block" />
        <UserMenu {...user} />
      </div>
    </header>
  )
}
