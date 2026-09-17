'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { NavIcon } from './NavIcon'
import {
  type NavItem,
  V2_NAVIGATION_ITEMS,
  getMobilePrimaryNavItems,
  getMobileMoreNavItems,
  isRouteActive,
} from '@/config/navigation'

interface MobileBottomNavProps {
  items?: readonly NavItem[]
  onOpenMore: () => void
  isMoreOpen?: boolean
}

export function MobileBottomNav({
  items = V2_NAVIGATION_ITEMS,
  onOpenMore,
  isMoreOpen = false,
}: MobileBottomNavProps) {
  const pathname = usePathname()

  // Determine items distribution
  const hasMore = items.length > 4
  const primaryItems = hasMore ? getMobilePrimaryNavItems(items, 4) : [...items]
  const moreItems = hasMore ? getMobileMoreNavItems(items, 4) : []

  // Check if any item in the "More" drawer is currently active
  const isMoreActive = moreItems.some((item) => isRouteActive(pathname, item.href))

  return (
    <nav
      aria-label="شريط التنقل السفلي للهواتف"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-[env(safe-area-inset-bottom)] select-none shadow-[0_-4px_16px_rgba(0,0,0,0.03)]"
    >
      <div className="h-16 max-w-lg mx-auto px-2 flex items-center justify-around">
        {primaryItems.map((item) => {
          const active = isRouteActive(pathname, item.href)

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
                active
                  ? 'text-teal-800 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 active:bg-slate-100/50'
              }`}
            >
              <div
                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  active ? 'bg-teal-50 text-teal-700' : 'text-slate-500'
                }`}
              >
                <NavIcon
                  name={item.iconName}
                  className={`w-5 h-5 ${active ? 'stroke-[2.25]' : 'stroke-[1.75]'}`}
                />
              </div>
              <span className="text-[11px] leading-tight truncate mt-0.5 max-w-full">
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* "More" Button (Shown only when items exceed 4) */}
        {hasMore && (
          <button
            type="button"
            onClick={onOpenMore}
            aria-expanded={isMoreOpen}
            aria-label="المزيد من الأقسام"
            className={`flex-1 min-w-0 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
              isMoreActive || isMoreOpen
                ? 'text-teal-800 font-semibold'
                : 'text-slate-500 hover:text-slate-900 active:bg-slate-100/50'
            }`}
          >
            <div
              className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isMoreActive || isMoreOpen ? 'bg-teal-50 text-teal-700' : 'text-slate-500'
              }`}
            >
              <MoreHorizontal
                className={`w-5 h-5 ${
                  isMoreActive || isMoreOpen ? 'stroke-[2.25]' : 'stroke-[1.75]'
                }`}
                aria-hidden="true"
              />
              {isMoreActive && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-teal-600 rounded-full" />
              )}
            </div>
            <span className="text-[11px] leading-tight truncate mt-0.5">المزيد</span>
          </button>
        )}
      </div>
    </nav>
  )
}
