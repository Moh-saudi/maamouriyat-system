'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Building2,
  Loader2,
  MapPin,
  Network,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react'
import {
  CascadingOrganizationSelect,
  type CascadingOrganizationOption,
} from '@/components/ui/CascadingOrganizationSelect'

type Organization = CascadingOrganizationOption & {
  health_admin: string | null
  is_active: boolean | null
  can_issue_missions: boolean
  can_approve_missions: boolean
  can_view_all_governorate: boolean
  can_view_sector_facilities: boolean
}

type OrganizationsResponse = {
  success?: boolean
  data?: Organization[]
  error?: string
}

interface OrganizationManagementPanelProps {
  canCreate: boolean
  canEdit: boolean
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'الوزارة',
  2: 'قطاع',
  3: 'إدارة مركزية',
  4: 'إدارة عامة',
  5: 'مديرية صحية',
  6: 'إدارة صحية',
  7: 'وحدة / جهة فرعية',
}

function descendantsOf(
  organizationId: string,
  organizations: readonly Organization[]
): string[] {
  const byParent = new Map<string, string[]>()

  for (const organization of organizations) {
    if (!organization.parent_id) continue
    const list = byParent.get(organization.parent_id) ?? []
    list.push(organization.id)
    byParent.set(organization.parent_id, list)
  }

  const result = new Set<string>()
  const queue = [organizationId]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    for (const child of byParent.get(current) ?? []) {
      if (result.has(child)) continue
      result.add(child)
      queue.push(child)
    }
  }

  return Array.from(result)
}

export function OrganizationManagementPanel({
  canCreate,
  canEdit,
}: OrganizationManagementPanelProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all')
  const [editing, setEditing] = useState<Organization | null>(null)
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/organizations', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as OrganizationsResponse

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل الهيكل التنظيمي')
      }

      setOrganizations(payload.data ?? [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل الهيكل التنظيمي'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const organizationById = useMemo(
    () =>
      new Map(
        organizations.map((organization) => [organization.id, organization])
      ),
    [organizations]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ar')

    return organizations.filter((organization) => {
      if (levelFilter !== 'all' && organization.level !== levelFilter) {
        return false
      }

      if (!q) return true

      return [
        organization.name,
        organization.governorate || '',
        organization.health_admin || '',
      ].some((value) => value.toLocaleLowerCase('ar').includes(q))
    })
  }, [organizations, search, levelFilter])

  const sectorCount = organizations.filter((item) => item.level === 2).length
  const directorateCount = organizations.filter((item) => item.level === 5).length

  function openEdit(organization: Organization) {
    setEditing(organization)
    setCreating(false)
    setName(organization.name)
    setParentId(organization.level === 5 ? null : organization.parent_id)
    setError(null)
  }

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setName('')
    setParentId(null)
    setError(null)
  }

  function closeEditor() {
    setEditing(null)
    setCreating(false)
    setError(null)
  }

  const parentOptions = useMemo(() => {
    if (editing) {
      const parentLevel = editing.level - 1
      return organizations.filter(
        (organization) => organization.level <= parentLevel
      )
    }

    if (creating) {
      return organizations.filter((organization) => organization.level < 7)
    }

    return organizations
  }, [organizations, editing, creating])

  const disabledParentIds = useMemo(() => {
    if (!editing) return []
    return [editing.id, ...descendantsOf(editing.id, organizations)]
  }, [editing, organizations])

  async function save() {
    if (!name.trim()) {
      setError('اسم الجهة مطلوب')
      return
    }

    if (
      !parentId &&
      (creating || (editing && editing.level > 1 && editing.level !== 5))
    ) {
      setError('يجب اختيار الجهة الأم من الشجرة التنظيمية')
      return
    }

    if (editing && parentId) {
      const selectedParent = organizations.find(
        (organization) => organization.id === parentId
      )

      if (!selectedParent || selectedParent.level !== editing.level - 1) {
        setError(
          `الجهة الأم يجب أن تكون من مستوى ${LEVEL_LABELS[editing.level - 1] || editing.level - 1}`
        )
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
      }

      if (parentId) body.parent_id = parentId

      if (editing) body.id = editing.id

      const response = await fetch('/api/admin/organizations', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر حفظ بيانات الجهة')
      }

      closeEditor()
      await load()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'تعذر حفظ بيانات الجهة'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل الهيكل التنظيمي...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && !editing && !creating && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3 lg:max-w-4xl">
        <SimpleStat
          icon={<Network className="h-5 w-5" />}
          value={organizations.length}
          label="جهة داخل نطاقك"
        />
        <SimpleStat
          icon={<Building2 className="h-5 w-5" />}
          value={sectorCount}
          label="قطاع"
        />
        <SimpleStat
          icon={<MapPin className="h-5 w-5" />}
          value={directorateCount}
          label="مديرية صحية"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">البحث في الجهات</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث باسم الجهة أو المحافظة..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <select
              value={levelFilter}
              onChange={(event) =>
                setLevelFilter(
                  event.target.value === 'all'
                    ? 'all'
                    : Number(event.target.value)
                )
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
            >
              <option value="all">كل أنواع الجهات</option>
              {Object.entries(LEVEL_LABELS).map(([level, label]) => (
                <option key={level} value={level}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              إضافة جهة
            </button>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[850px] border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-bold text-slate-500">
                <th className="px-5 py-3.5">الجهة</th>
                <th className="px-5 py-3.5">النوع</th>
                <th className="px-5 py-3.5">الجهة الأم</th>
                <th className="px-5 py-3.5">المحافظة / النطاق</th>
                <th className="px-5 py-3.5">الحالة</th>
                <th className="px-5 py-3.5">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((organization) => {
                const parent = organization.parent_id
                  ? organizationById.get(organization.parent_id)
                  : null

                return (
                  <tr key={organization.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">
                        {organization.name}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {LEVEL_LABELS[organization.level] ||
                          `مستوى ${organization.level}`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {organization.level === 5
                        ? 'وزارة الصحة والسكان'
                        : parent?.name || 'جهة رئيسية'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {organization.governorate ||
                        organization.health_admin ||
                        'نطاق مركزي'}
                    </td>
                    <td className="px-5 py-4">
                      {organization.is_active !== false ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          نشطة
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                          موقوفة
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {canEdit && organization.level > 1 ? (
                        <button
                          type="button"
                          onClick={() => openEdit(organization)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-teal-300 hover:text-teal-800"
                        >
                          <Pencil className="h-4 w-4" />
                          تعديل
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.map((organization) => {
            const parent = organization.parent_id
              ? organizationById.get(organization.parent_id)
              : null

            return (
              <article key={organization.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {organization.name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {LEVEL_LABELS[organization.level]} •{' '}
                      {organization.level === 5
                        ? 'وزارة الصحة والسكان'
                        : parent?.name || 'جهة رئيسية'}
                    </p>
                  </div>
                  {organization.is_active !== false && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                      نشطة
                    </span>
                  )}
                </div>

                {canEdit && organization.level > 1 && (
                  <button
                    type="button"
                    onClick={() => openEdit(organization)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                    تعديل الجهة
                  </button>
                )}
              </article>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex min-h-52 flex-col items-center justify-center px-5 py-10 text-center">
            <Building2 className="mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">لا توجد جهات مطابقة</p>
          </div>
        )}
      </section>

      {(editing || creating) && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="organization-editor-title"
        >
          <div className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold text-teal-700">
                  {editing ? 'تعديل جهة' : 'إضافة جهة'}
                </p>
                <h2
                  id="organization-editor-title"
                  className="mt-1 text-lg font-extrabold text-slate-900"
                >
                  {editing ? editing.name : 'جهة جديدة'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-140px)] space-y-4 overflow-y-auto p-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
                  اسم الجهة
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              {editing?.level === 5 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-slate-500">
                    التبعية التنظيمية
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    وزارة الصحة والسكان — المسار الإقليمي للمديريات
                  </p>
                </div>
              ) : (
                <CascadingOrganizationSelect
                  organizations={parentOptions}
                  value={parentId}
                  onChange={setParentId}
                  label="الجهة الأم"
                  disabledIds={disabledParentIds}
                  helperText={
                    editing
                      ? `اختر التبعية بالتدرج حتى مستوى ${LEVEL_LABELS[editing.level - 1] || editing.level - 1}.`
                      : 'اختر الجهة الأم بالتدرج؛ مستوى الجهة الجديدة يُحدد تلقائيًا بناءً عليها.'
                  }
                />
              )}

              {editing && (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  نوع الجهة: <strong>{LEVEL_LABELS[editing.level]}</strong>
                </div>
              )}


            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SimpleStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: number
  label: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        {icon}
      </div>
      <p className="text-3xl font-black text-slate-900">
        {value.toLocaleString('ar-EG')}
      </p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  )
}
