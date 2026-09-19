'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Bell, HelpCircle } from 'lucide-react'
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
  sidebarCollapsed?: boolean
}

export function Topbar({
  user,
  items = V2_NAVIGATION_ITEMS,
  homeHref = '/v2/dashboard',
  sidebarCollapsed = false,
}: TopbarProps) {
  const pathname = usePathname()
  const currentNav =
    items.find((item) => isRouteActive(pathname, item.href)) ||
    { label: 'المنظومة', href: homeHref }

  return (
    <header
      className={`fixed left-0 top-0 z-50 flex h-[60px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-sm transition-[right] duration-200 sm:px-5 lg:px-6 ${
        sidebarCollapsed
          ? 'right-0 md:right-[76px]'
          : 'right-0 md:right-[76px] lg:right-[276px]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={homeHref}
          className="flex shrink-0 items-center md:hidden"
          aria-label={BRANDING.ministry}
        >
          <Image
            src={BRANDING.logos.primary}
            alt={BRANDING.ministry}
            width={28}
            height={28}
            className="object-contain"
            style={{ width: 28, height: 28 }}
          />
        </Link>

        <div className="min-w-0">
          <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
            {BRANDING.ministry}
          </p>
          <h2 className="truncate text-sm font-extrabold text-slate-900 sm:text-base">
            {currentNav.label}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href={`/v2/help?from=${encodeURIComponent(pathname)}`}
          aria-label="شرح هذه الصفحة"
          title="شرح هذه الصفحة"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-slate-500 transition hover:bg-slate-50 hover:text-teal-800"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden text-[11px] font-bold lg:inline">
            شرح الصفحة
          </span>
        </Link>

        <button
          type="button"
          aria-label="التنبيهات"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal-600 ring-2 ring-white" />
        </button>

        <div className="hidden h-6 w-px bg-slate-200 sm:block" />
        <UserMenu {...user} />
      </div>
    </header>
  )
}
