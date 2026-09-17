'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { UserMenu, type UserMenuProps } from './UserMenu'
import { BRANDING } from '@/config/branding'
import { V2_NAVIGATION_ITEMS, type NavItem } from '@/config/navigation'

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
  
  // Resolve current active item from route
  const currentNav = items.find((item) =>
    pathname === item.href || (item.href !== '/v2/dashboard' && pathname.startsWith(item.href))
  ) || { label: 'المنظومة', href: homeHref }

  return (
    <header className="sticky top-0 z-30 w-full h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Right Side (Title / Breadcrumb Area in RTL) */}
      <div className="flex items-center gap-3">
        {/* Mini Logo for Mobile (< 768px) where sidebar is completely hidden */}
        <Link href={homeHref} className="md:hidden flex items-center gap-2 shrink-0">
          <Image
            src={BRANDING.logos.primary}
            alt={BRANDING.shortName}
            width={28}
            height={28}
            className="object-contain"
          />
        </Link>

        {/* Page Title Context */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {currentNav.label}
            </h2>
            <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-semibold">
              V2
            </span>
          </div>
          <span className="hidden md:inline-block text-[11px] text-slate-400">
            {BRANDING.systemName}
          </span>
        </div>
      </div>

      {/* Left Side (Controls: Notifications + User Menu) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Placeholder Notification Bell */}
        <button
          type="button"
          aria-label="التنبيهات والإشعارات"
          title="التنبيهات والإشعارات (مرحلة 3)"
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 transition-colors"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
          {/* Subtle unread ping dot */}
          <span className="absolute top-2 right-2 w-2 h-2 bg-teal-600 rounded-full ring-2 ring-white" />
        </button>

        <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

        {/* User Profile Menu with forwarded user props */}
        <UserMenu {...user} />
      </div>
    </header>
  )
}
