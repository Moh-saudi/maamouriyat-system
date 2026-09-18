'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { NavIcon } from './NavIcon'
import { BRANDING } from '@/config/branding'
import {
  V2_NAVIGATION_ITEMS,
  V2_NAV_GROUPS,
  type NavItem,
  type NavGroupKey,
  isRouteActive,
} from '@/config/navigation'

interface DesktopSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  items?: readonly NavItem[]
  homeHref?: string
}

export function DesktopSidebar({
  collapsed,
  onToggleCollapse,
  items = V2_NAVIGATION_ITEMS,
  homeHref = '/v2/dashboard',
}: DesktopSidebarProps) {
  const pathname = usePathname()
  const groups: NavGroupKey[] = ['main', 'operations', 'admin']

  return (
    <aside
      aria-label="القائمة الجانبية الرئيسية"
      className={`fixed right-0 top-0 z-40 hidden h-dvh shrink-0 flex-col border-l border-slate-200/80 bg-white transition-[width] duration-200 md:flex ${
        collapsed ? 'w-[76px]' : 'w-[76px] lg:w-[276px]'
      }`}
    >
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-slate-100 px-3">
        <Link
          href={homeHref}
          className="flex min-w-0 items-center gap-3 rounded-xl p-1 focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50/70">
            <Image
              src={BRANDING.logos.primary}
              alt={BRANDING.ministry}
              width={30}
              height={30}
              className="object-contain"
              style={{ width: 30, height: 30 }}
              priority
            />
          </div>

          {!collapsed && (
            <div className="hidden min-w-0 flex-col text-right lg:flex">
              <span className="truncate text-sm font-extrabold text-slate-900">
                {BRANDING.shortName}
              </span>
              <span className="truncate text-[11px] text-slate-400">
                {BRANDING.ministry}
              </span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:flex"
        >
          {collapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-2 py-5 lg:px-3">
        {groups.map((groupKey) => {
          const groupItems = items.filter((item) => item.group === groupKey)
          if (groupItems.length === 0) return null

          return (
            <section key={groupKey} className="space-y-2">
              {!collapsed && (
                <p className="hidden px-3 text-[11px] font-bold text-slate-400 lg:block">
                  {V2_NAV_GROUPS[groupKey]}
                </p>
              )}

              <div className="space-y-1">
                {groupItems.map((item) => {
                  const active = isRouteActive(pathname, item.href)

                  const link = (
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`relative flex min-h-11 items-center gap-3 rounded-xl text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
                        collapsed
                          ? 'justify-center px-0'
                          : 'justify-center px-0 lg:justify-start lg:px-3'
                      } ${
                        active
                          ? 'bg-teal-50 font-bold text-teal-800'
                          : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {active && (
                        <span className="absolute right-0 h-6 w-[3px] rounded-l-full bg-teal-600" />
                      )}
                      <NavIcon
                        name={item.iconName}
                        className={`h-5 w-5 shrink-0 ${
                          active ? 'text-teal-700' : 'text-slate-400'
                        }`}
                      />
                      {!collapsed && (
                        <span className="hidden truncate lg:inline">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  )

                  return (
                    <div key={item.id}>
                      <div className={collapsed ? 'block' : 'lg:hidden'}>
                        {link}
                      </div>
                      {!collapsed && <div className="hidden lg:block">{link}</div>}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-100 px-4 py-3">
        {!collapsed ? (
          <div className="hidden items-center justify-between text-[10px] text-slate-400 lg:flex">
            <span>{BRANDING.country}</span>
            <span className="font-mono">V2</span>
          </div>
        ) : (
          <div className="text-center text-[10px] font-mono text-slate-400">V2</div>
        )}
      </div>
    </aside>
  )
}
