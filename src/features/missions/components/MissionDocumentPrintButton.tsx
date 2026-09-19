'use client'

import { Printer } from 'lucide-react'

export function MissionDocumentPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-black text-white shadow-sm hover:bg-teal-800 print:hidden"
    >
      <Printer className="h-4 w-4" />
      طباعة المستند
    </button>
  )
}
