'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type CompactFilterOption = {
  value: string
  label: string
  meta?: string
}

type CompactFilterSelectProps = {
  value: string
  options: readonly CompactFilterOption[]
  onChange: (value: string) => void
  placeholder: string
  className?: string
  disabled?: boolean
}

export function CompactFilterSelect({
  value,
  options,
  onChange,
  placeholder,
  className = '',
  disabled = false,
}: CompactFilterSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current
      if (!root || root.contains(event.target as Node)) return
      setOpen(false)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const selected = options.find((option) => option.value === value)

  return (
    <div ref={rootRef} className={'relative ' + className}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-right text-[11px] font-bold outline-none transition ' +
          (open
            ? 'border-teal-300 bg-white ring-2 ring-teal-100'
            : 'border-slate-200 bg-white hover:border-slate-300') +
          ' disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300'
        }
      >
        <span className={selected ? 'truncate text-slate-700' : 'truncate text-slate-500'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={
            'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ' +
            (open ? 'rotate-180' : '')
          }
        />
      </button>

      {open && !disabled && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
          <div className="max-h-64 overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className={
                'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-right text-[10px] font-bold transition ' +
                (!value
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-500 hover:bg-slate-50')
              }
            >
              <span>{placeholder}</span>
              {!value && <Check className="h-3.5 w-3.5" />}
            </button>

            {options.map((option) => {
              const active = option.value === value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-right transition ' +
                    (active
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-slate-50')
                  }
                >
                  <span className="min-w-0 truncate text-[10px] font-bold">
                    {option.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {option.meta && (
                      <span className="text-[9px] font-medium text-slate-400">
                        {option.meta}
                      </span>
                    )}
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
