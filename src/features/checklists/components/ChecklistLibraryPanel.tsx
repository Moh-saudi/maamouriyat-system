'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  FileText,
  Loader2,
  PencilRuler,
  RefreshCw,
  Search,
} from 'lucide-react'

type TemplateRow = {
  id: string
  name: string
  version: string | null
  description: string | null
  visibility: 'system' | 'organization' | 'private'
  is_base: boolean
  created_by_me: boolean
  in_my_library: boolean
  library_source: string | null
  is_default: boolean
  section_count: number
  criteria_count: number
  applicable_facility_types: string[] | null
  updated_at: string | null
}

type Payload = {
  templates?: TemplateRow[]
  can_design?: boolean
  can_manage_library?: boolean
  error?: string
}

export function ChecklistLibraryPanel() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [tab, setTab] = useState<'mine' | 'available'>('mine')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [canDesign, setCanDesign] = useState(false)
  const [canManageLibrary, setCanManageLibrary] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v2/checklists/library', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as Payload

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل الاستمارات')
      }

      setTemplates(payload.templates ?? [])
      setCanDesign(payload.can_design === true)
      setCanManageLibrary(payload.can_manage_library === true)

      if (!(payload.templates ?? []).some((item) => item.in_my_library)) {
        setTab('available')
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل الاستمارات'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ar')

    return templates
      .filter((template) =>
        tab === 'mine' ? template.in_my_library : true
      )
      .filter((template) => {
        if (!q) return true
        return [
          template.name,
          template.description ?? '',
          template.version ?? '',
        ].some((value) => value.toLocaleLowerCase('ar').includes(q))
      })
  }, [templates, tab, search])

  async function toggleLibrary(template: TemplateRow) {
    if (!canManageLibrary || template.created_by_me) return

    setBusyId(template.id)
    setError(null)

    try {
      const method = template.in_my_library ? 'DELETE' : 'POST'
      const response = await fetch(
        template.in_my_library
          ? '/api/v2/checklists/library?template_id=' +
              encodeURIComponent(template.id)
          : '/api/v2/checklists/library',
        {
          method,
          credentials: 'same-origin',
          headers:
            method === 'POST'
              ? { 'Content-Type': 'application/json' }
              : undefined,
          body:
            method === 'POST'
              ? JSON.stringify({ template_id: template.id })
              : undefined,
        }
      )

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحديث استماراتي')
      }

      setTemplates((current) =>
        current.map((item) =>
          item.id === template.id
            ? { ...item, in_my_library: !item.in_my_library }
            : item
        )
      )
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'تعذر تحديث استماراتي'
      )
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل مكتبة الاستمارات...
      </div>
    )
  }

  const mineCount = templates.filter((item) => item.in_my_library).length

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab('mine')}
              className={
                'h-9 rounded-lg px-3 text-[10px] font-bold ' +
                (tab === 'mine'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-500')
              }
            >
              استماراتي ({mineCount.toLocaleString('en-US')})
            </button>
            <button
              type="button"
              onClick={() => setTab('available')}
              className={
                'h-9 rounded-lg px-3 text-[10px] font-bold ' +
                (tab === 'available'
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-500')
              }
            >
              النماذج المتاحة ({templates.length.toLocaleString('en-US')})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث في الاستمارات..."
                className="h-9 w-56 rounded-xl border border-slate-200 pr-9 pl-3 text-[11px] outline-none focus:border-teal-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-slate-600"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              تحديث
            </button>
            {canDesign && (
              <Link
                href="/dashboard/checklists"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-[10px] font-bold text-white hover:bg-teal-800"
              >
                <PencilRuler className="h-3.5 w-3.5" />
                تصميم استمارة
              </Link>
            )}
          </div>
        </div>

        <p className="mt-3 text-[10px] leading-5 text-slate-500">
          «استماراتي» هي مكتبتك الشخصية: تشمل ما أنشأته وما حفظته من النماذج
          المشتركة. اختيار الاستمارة الفعلية للمأمورية يتم لاحقًا داخل خطوة
          الإصدار، بعد تحديد المنشآت والفريق.
        </p>
      </section>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-bold text-slate-600">
            {tab === 'mine'
              ? 'لم تحفظ استمارات في مكتبتك بعد'
              : 'لا توجد استمارات مطابقة'}
          </p>
          {tab === 'mine' && (
            <button
              type="button"
              onClick={() => setTab('available')}
              className="mt-3 text-xs font-bold text-teal-700"
            >
              تصفح النماذج المتاحة
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((template) => (
            <article
              key={template.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-teal-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="truncate text-xs font-black text-slate-900">
                      {template.name}
                    </h2>
                    {template.created_by_me && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[8px] font-bold text-teal-700">
                        أنشأتها أنت
                      </span>
                    )}
                    {template.is_base && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-bold text-slate-600">
                        أساسية
                      </span>
                    )}
                  </div>

                  {template.description && (
                    <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-slate-500">
                      {template.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {template.section_count.toLocaleString('en-US')} أقسام
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {template.criteria_count.toLocaleString('en-US')} بند
                    </span>
                    {template.version && (
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        إصدار {template.version}
                      </span>
                    )}
                  </div>
                </div>

                {canManageLibrary && !template.created_by_me && (
                  <button
                    type="button"
                    disabled={busyId === template.id}
                    onClick={() => void toggleLibrary(template)}
                    className={
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border disabled:opacity-50 ' +
                      (template.in_my_library
                        ? 'border-teal-200 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white text-slate-400 hover:text-teal-700')
                    }
                    title={
                      template.in_my_library
                        ? 'إزالة من استماراتي'
                        : 'حفظ في استماراتي'
                    }
                  >
                    {busyId === template.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : template.in_my_library ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
