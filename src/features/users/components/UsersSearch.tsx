'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

interface UsersSearchProps {
  initialSearch: string
}

export function UsersSearch({ initialSearch }: UsersSearchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialSearch)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setQuery(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = query.trim().slice(0, 100)
      if (normalized === initialSearch) return

      const params = new URLSearchParams(searchParams.toString())

      if (normalized) {
        params.set('q', normalized)
      } else {
        params.delete('q')
      }

      // A new search always starts from the first result page.
      params.delete('page')

      const nextQuery = params.toString()
      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
          scroll: false,
        })
      })
    }, 350)

    return () => window.clearTimeout(timer)
  }, [initialSearch, pathname, query, router, searchParams])

  return (
    <label className="relative block w-full">
      <span className="sr-only">البحث عن مستخدم</span>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ابحث بالاسم أو البريد أو المسمى الوظيفي..."
        className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-9 pl-10 text-xs outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
      <span className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="مسح البحث"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </span>
    </label>
  )
}
