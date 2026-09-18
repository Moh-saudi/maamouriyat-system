'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, ChevronLeft } from 'lucide-react'
import { Drawer } from '@heroui/react'
import { NavIcon } from './NavIcon'
import {
  type NavItem,
  V2_NAVIGATION_ITEMS,
  V2_NAV_GROUPS,
  getMobileMoreNavItems,
  isRouteActive,
} from '@/config/navigation'

interface MoreNavigationSheetProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  items?: readonly NavItem[]
}

export function MoreNavigationSheet({
  isOpen,
  onOpenChange,
  items,
}: MoreNavigationSheetProps) {
  const pathname = usePathname()
  const sourceItems = items ?? V2_NAVIGATION_ITEMS
  const navItems = getMobileMoreNavItems(sourceItems, 4)

  if (navItems.length === 0) {
    return null
  }

  // Derive unique active groups dynamically from the actual remaining items
  const activeGroups = Array.from(new Set(navItems.map((item) => item.group)))

  return (
    <Drawer.Root isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Backdrop className="bg-slate-900/40 backdrop-blur-xs fixed inset-0 z-50 transition-opacity">
        <Drawer.Content
          placement="bottom"
          className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl border-t border-slate-200/90 max-h-[85vh] flex flex-col focus:outline-hidden pb-[env(safe-area-inset-bottom)]"
        >
          <Drawer.Dialog className="flex flex-col h-full overflow-hidden">
            {/* Sheet Handle */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <Drawer.Header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <Drawer.Heading className="text-base font-bold text-slate-900">
                المزيد من أقسام المنظومة
              </Drawer.Heading>
              <button
                type="button"
                aria-label="إغلاق القائمة"
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </Drawer.Header>

            {/* Scrollable Body */}
            <Drawer.Body className="p-4 overflow-y-auto space-y-5">
              {activeGroups.map((groupKey) => {
                const groupItems = navItems.filter((i) => i.group === groupKey)
                if (groupItems.length === 0) return null

                return (
                  <div key={groupKey} className="space-y-2">
                    <p className="px-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                      {V2_NAV_GROUPS[groupKey] || groupKey}
                    </p>
                    <div className="space-y-1">
                      {groupItems.map((item) => {
                        const active = isRouteActive(pathname, item.href)

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => onOpenChange(false)}
                            aria-current={active ? 'page' : undefined}
                            className={`flex items-center justify-between p-3 rounded-xl transition-colors min-h-[48px] ${
                              active
                                ? 'bg-teal-50 border border-teal-200/80 text-teal-900 font-semibold'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  active
                                    ? 'bg-teal-700 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <NavIcon name={item.iconName} className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-sm font-semibold">{item.label}</span>
                                {item.description && (
                                  <span className="text-[11px] text-slate-400 line-clamp-1">
                                    {item.description}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronLeft
                              className={`w-4 h-4 ${
                                active ? 'text-teal-700' : 'text-slate-300'
                              }`}
                              aria-hidden="true"
                            />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer.Root>
  )
}
