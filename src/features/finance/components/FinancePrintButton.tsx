'use client'

import { Printer } from 'lucide-react'

export function FinancePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-[11px] font-bold text-white print:hidden"
    >
      <Printer className="h-3.5 w-3.5" />
      طباعة البيان
    </button>
  )
}
