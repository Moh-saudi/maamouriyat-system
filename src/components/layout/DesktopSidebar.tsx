'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Tooltip } from '@heroui/react'
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
}

export function DesktopSidebar({
  collapsed,
  onToggleCollapse,
  items = V2_NAVIGATION_ITEMS,
}: DesktopSidebarProps) {
  const pathname = usePathname()

  // Group items according to NavGroupKey
  const groups: NavGroupKey[] = ['main', 'operations', 'admin']

  return (
    <aside
      aria-label="القائمة الجانبية الرئيسية"
      className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 bg-white border-l border-slate-200/90 z-40 transition-[width] duration-200 ease-in-out select-none ${
        collapsed ? 'w-20' : 'w-20 lg:w-72'
      }`}
    >
      {/* ── Header: Logo & Branding ────────────────────────────────────── */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-200/80 shrink-0">
        <Link
          href="/v2/dashboard"
          className="flex items-center gap-3 overflow-hidden focus-visible:outline-teal-600 rounded-lg p-1"
        >
          <div className="relative w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-teal-50 border border-teal-200">
            <Image
              src={BRANDING.logos.primary}
              alt={BRANDING.ministry}
              width={28}
              height={28}
              className="object-contain"
              priority
            />
          </div>

          {!collapsed && (
            <div className="hidden lg:flex flex-col text-right truncate">
              <span className="text-sm font-bold text-slate-900 leading-snug truncate">
                {BRANDING.shortName}
              </span>
              <span className="text-[11px] text-slate-400 truncate">
                {BRANDING.ministry}
              </span>
            </div>
          )}
        </Link>

        {/* Collapse Toggle Button (Desktop Only >= 1024px) */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
          title={collapsed ? 'توسيع' : 'طي'}
          className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-teal-600 transition-colors"
        >
          {collapsed ? (
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* ── Scrollable Navigation Items ─────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 lg:px-3 py-4 space-y-6 scrollbar-thin">
        {groups.map((groupKey) => {
          const groupItems = items.filter((item) => item.group === groupKey)
          if (groupItems.length === 0) return null

          return (
            <div key={groupKey} className="space-y-1.5">
              {/* Group Header (Visible only on expanded Desktop >= 1024px) */}
              {!collapsed && (
                <p className="hidden lg:block px-3 text-[11px] font-bold text-slate-400 tracking-wide uppercase">
                  {V2_NAV_GROUPS[groupKey]}
                </p>
              )}

              {/* Group Nav Items */}
              <div className="space-y-1">
                {groupItems.map((item) => {
                  const active = isRouteActive(pathname, item.href)

                  const itemContent = (
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-teal-600 ${
                        collapsed
                          ? 'justify-center px-0'
                          : 'justify-center lg:justify-start px-0 lg:px-3'
                      } ${
                        active
                          ? 'bg-teal-700 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <NavIcon
                        name={item.iconName}
                        className={`w-5 h-5 shrink-0 transition-colors ${
                          active ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'
                        }`}
                      />
                      {!collapsed && (
                        <span className="hidden lg:inline truncate text-right">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  )

                  // In collapsed mode (or on tablet where sidebar is a rail), wrap in Tooltip
                  return (
                    <div key={item.id} className="relative">
                      {/* Mobile / Tablet Rail Tooltip */}
                      <div className={collapsed ? 'block' : 'lg:hidden'}>
                        <Tooltip delay={150}>
                          <Tooltip.Trigger>{itemContent}</Tooltip.Trigger>
                          <Tooltip.Content className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded shadow-md z-50">
                            {item.label}
                          </Tooltip.Content>
                        </Tooltip>
                      </div>

                      {/* Expanded Desktop layout without tooltip */}
                      {!collapsed && (
                        <div className="hidden lg:block">{itemContent}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── Footer / Version ───────────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-200/80 shrink-0 text-center">
        {!collapsed ? (
          <div className="hidden lg:flex items-center justify-between text-[11px] text-slate-400 px-2">
            <span>{BRANDING.country}</span>
            <span className="font-mono">v{BRANDING.version}</span>
          </div>
        ) : null}
        <div className={collapsed ? 'block' : 'lg:hidden'}>
          <span className="text-[10px] font-mono text-slate-400">V2</span>
        </div>
      </div>
    </aside>
  )
}
