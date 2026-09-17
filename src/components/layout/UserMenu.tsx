'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { User, Settings, LogOut, ChevronDown } from 'lucide-react'

export interface UserMenuProps {
  /** Placeholder or future authenticated name */
  name?: string
  /** Functional job title */
  jobTitle?: string
  /** Assigned organization / sector */
  organization?: string
  /** Initials for avatar */
  initials?: string
}

export function UserMenu({
  name = 'حساب المستخدم',
  jobTitle = 'منظومة المأموريات V2',
  organization = 'وزارة الصحة والسكان',
  initials = 'م',
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <div className="relative inline-block text-right" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        id="v2-user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="قائمة المستخدم"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 transition-colors border border-transparent hover:border-slate-200"
      >
        {/* Avatar Circle */}
        <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
          {initials}
        </div>

        {/* User Details (Desktop only) */}
        <div className="hidden sm:flex flex-col text-right leading-tight">
          <span className="text-xs font-bold text-slate-800 line-clamp-1 max-w-[120px]">
            {name}
          </span>
          <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[120px]">
            {jobTitle}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="v2-user-menu-trigger"
          className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-md py-1.5 z-50 focus:outline-hidden"
        >
          {/* Header Info */}
          <div className="px-3.5 py-2.5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900">{name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{jobTitle}</p>
            <p className="text-[10px] text-teal-700 font-medium mt-1">{organization}</p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              disabled
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-400 cursor-not-allowed text-right"
            >
              <User className="w-4 h-4" aria-hidden="true" />
              <span>الملف الشخصي (مرحلة 3)</span>
            </button>

            <Link
              href="/v2/settings"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-teal-800 transition-colors text-right"
            >
              <Settings className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>إعدادات الحساب</span>
            </Link>
          </div>

          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              role="menuitem"
              disabled
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-400 cursor-not-allowed text-right"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>تسجيل الخروج (مرحلة 3)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
