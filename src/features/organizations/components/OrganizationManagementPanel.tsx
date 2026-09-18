'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  OrganizationTreeSelect,
  type OrganizationTreeOption,
} from '@/components/ui/OrganizationTreeSelect'

type Organization = OrganizationTreeOption & {
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
  canManageCapabilities: boolean
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

const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: 'border-rose-200 bg-rose-50 text-rose-700',
  2: 'border-sky-200 bg-sky-50 text-sky-700',
  3: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  4: 'border-violet-200 bg-violet-50 text-violet-700',
  5: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  6: 'border-teal-200 bg-teal-50 text-teal-700',
  7: 'border-slate-200 bg-slate-50 text-slate-600',
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

  return [...result]
}

function countChildren(
  organizationId: string,
  organizations: readonly Organization[]
): number {
  return organizations.filter(
    (organization) => organization.parent_id === organizationId
  ).length
}

export function OrganizationManagementPanel({
  canCreate,
  canEdit,
  canManageCapabilities,
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
  const [code, setCode] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState({
    can_issue_missions: true,
    can_approve_missions: false,
    can_view_all_governorate: false,
    can_view_sector_facilities: false,
  })

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

  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const organization of organizations) {
      map.set(
        organization.level,
        (map.get(organization.level) ?? 0) + 1
      )
    }
    return map
  }, [organizations])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ar')

    return organizations.filter((organization) => {
      if (levelFilter !== 'all' && organization.level !== levelFilter) {
        return false
      }

      if (!q) return true

      return [
        organization.name,
        organization.code || '',
        organization.governorate || '',
        organization.health_admin || '',
      ].some((value) => value.toLocaleLowerCase('ar').includes(q))
    })
  }, [organizations, search, levelFilter])

  const organizationById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization])),
    [organizations]
  )

  function openEdit(organization: Organization) {
    setEditing(organization)
    setCreating(false)
    setName(organization.name)
    setCode(organization.code || '')
    setParentId(organization.parent_id)
    setCapabilities({
      can_issue_missions: organization.can_issue_missions,
      can_approve_missions: organization.can_approve_missions,
      can_view_all_governorate: organization.can_view_all_governorate,
      can_view_sector_facilities: organization.can_view_sector_facilities,
    })
    setError(null)
  }

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setName('')
    setCode('')
    setParentId(null)
    setCapabilities({
      can_issue_missions: true,
      can_approve_missions: false,
      can_view_all_governorate: false,
      can_view_sector_facilities: false,
    })
    setError(null)
  }

  function closeEditor() {
    setEditing(null)
    setCreating(false)
    setError(null)
  }

  const parentOptions = useMemo(() => {
    if (editing) {
      return organizations.filter(
        (organization) => organization.level === editing.level - 1
      )
    }

    if (creating) {
      return organizations.filter((organization) => organization.level < 7)
    }

    return organizations
  }, [organizations, editing, creating])

  const disabledParentIds = useMemo(() => {
    if (!editing) return []
    return [
      editing.id,
      ...descendantsOf(editing.id, organizations),
    ]
  }, [editing, organizations])

  async function save() {
    if (!name.trim()) {
      setError('اسم الجهة مطلوب')
      return
    }

    if (!parentId && (creating || (editing && editing.level > 1))) {
      setError('يجب اختيار الجهة الأم من الشجرة التنظيمية')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        code: code.trim() || undefined,
        parent_id: parentId,
      }

      if (canManageCapabilities) {
        Object.assign(body, capabilities)
      }

      if (editing) body.id = editing.id

      const response = await fetch('/api/admin/organizations', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const payload = (await response.json()) as {
        error?: string
      }

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
        جارٍ تحميل الشجرة التنظيمية...
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          value={organizations.length}
          label="إجمالي الجهات داخل نطاقك"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          value={counts.get(2) ?? 0}
          label="قطاعات"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          value={counts.get(5) ?? 0}
          label="مديريات صحية"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          value={(counts.get(6) ?? 0) + (counts.get(7) ?? 0)}
          label="إدارات ووحدات فرعية"
          icon={<ChevronDown className="h-5 w-5" />}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/70">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">البحث في الجهات</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث بالاسم أو الكود أو المحافظة..."
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
              <option value="all">كل المستويات</option>
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
              إضافة جهة فرعية
            </button>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1050px] border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-500">
                <th className="px-5 py-3.5">الجهة</th>
                <th className="px-5 py-3.5">المستوى</th>
                <th className="px-5 py-3.5">الجهة الأم</th>
                <th className="px-5 py-3.5">النطاق الجغرافي</th>
                <th className="px-5 py-3.5">القدرات التنظيمية</th>
                <th className="px-5 py-3.5">التوابع</th>
                <th className="px-5 py-3.5">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((organization) => {
                const parent = organization.parent_id
                  ? organizationById.get(organization.parent_id)
                  : null

                return (
                  <tr key={organization.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">
                        {organization.name}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">
                        {organization.code || '—'}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                          LEVEL_BADGE_CLASSES[organization.level] ||
                          LEVEL_BADGE_CLASSES[7]
                        }`}
                      >
                        {LEVEL_LABELS[organization.level] ||
                          `مستوى ${organization.level}`}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {parent?.name || 'جهة رئيسية'}
                    </td>

                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-700">
                        {organization.governorate || 'نطاق مركزي / عام'}
                      </div>
                      {organization.health_admin && (
                        <div className="mt-1 text-xs text-slate-400">
                          {organization.health_admin}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex max-w-[310px] flex-wrap gap-1.5">
                        {organization.can_issue_missions && (
                          <CapabilityChip label="إصدار مأموريات" />
                        )}
                        {organization.can_approve_missions && (
                          <CapabilityChip label="اعتماد مأموريات" />
                        )}
                        {organization.can_view_all_governorate && (
                          <CapabilityChip label="كل المحافظة" />
                        )}
                        {organization.can_view_sector_facilities && (
                          <CapabilityChip label="منشآت القطاع" />
                        )}
                        {!organization.can_issue_missions &&
                          !organization.can_approve_missions &&
                          !organization.can_view_all_governorate &&
                          !organization.can_view_sector_facilities && (
                            <span className="text-xs text-slate-400">
                              لا توجد قدرات إضافية
                            </span>
                          )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm font-bold text-slate-700">
                      {countChildren(
                        organization.id,
                        organizations
                      ).toLocaleString('ar-EG')}
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
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900">
                      {organization.name}
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      تابع لـ {parent?.name || 'الجهة الرئيسية'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${
                      LEVEL_BADGE_CLASSES[organization.level] ||
                      LEVEL_BADGE_CLASSES[7]
                    }`}
                  >
                    {LEVEL_LABELS[organization.level]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                  <div>
                    <span className="block text-slate-400">المحافظة</span>
                    <span className="mt-1 block font-semibold text-slate-700">
                      {organization.governorate || 'مركزي'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400">التوابع المباشرة</span>
                    <span className="mt-1 block font-semibold text-slate-700">
                      {countChildren(
                        organization.id,
                        organizations
                      ).toLocaleString('ar-EG')}
                    </span>
                  </div>
                </div>

                {canEdit && organization.level > 1 && (
                  <button
                    type="button"
                    onClick={() => openEdit(organization)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                    تعديل بيانات وتبعية الجهة
                  </button>
                )}
              </article>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex min-h-52 flex-col items-center justify-center px-5 py-10 text-center">
            <Building2 className="mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">
              لا توجد جهات مطابقة
            </p>
            <p className="mt-1 text-xs text-slate-400">
              غيّر البحث أو فلتر المستوى التنظيمي.
            </p>
          </div>
        )}
      </section>

      {(editing || creating) && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 backdrop-blur-[1px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="organization-editor-title"
        >
          <div className="max-h-[94vh] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="mb-1 text-xs font-bold text-teal-700">
                  الشجرة التنظيمية
                </p>
                <h2
                  id="organization-editor-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {editing
                    ? `تعديل بيانات وتبعية: ${editing.name}`
                    : 'إضافة جهة فرعية جديدة'}
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

            <div className="max-h-[calc(94vh-145px)] space-y-4 overflow-y-auto p-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    اسم الجهة
                  </span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    كود الجهة
                  </span>
                  <input
                    dir="ltr"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    placeholder="ORG-CODE"
                  />
                </label>
              </div>

              <OrganizationTreeSelect
                organizations={parentOptions}
                value={parentId}
                onChange={setParentId}
                label="الجهة الأم / التبعية التنظيمية"
                placeholder={
                  creating
                    ? 'اختر الجهة التي ستتبع لها الوحدة الجديدة'
                    : 'اختر الجهة الأم الجديدة'
                }
                disabledIds={disabledParentIds}
                required
              />

              {editing && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
                  الوحدة في المستوى {editing.level}. لذلك تظهر فقط الجهات من
                  المستوى {editing.level - 1} كجهات أم صالحة. يمنع النظام
                  اختيار الوحدة نفسها أو أي فرع تابع لها.
                </div>
              )}

              {canManageCapabilities && (
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">
                    قدرات الجهة التنظيمية
                  </h3>

                  <div className="space-y-3">
                    <CapabilityToggle
                      label="إصدار وتكليف المأموريات"
                      checked={capabilities.can_issue_missions}
                      onChange={(checked) =>
                        setCapabilities((current) => ({
                          ...current,
                          can_issue_missions: checked,
                        }))
                      }
                    />
                    <CapabilityToggle
                      label="اعتماد المأموريات"
                      checked={capabilities.can_approve_missions}
                      onChange={(checked) =>
                        setCapabilities((current) => ({
                          ...current,
                          can_approve_missions: checked,
                        }))
                      }
                    />
                    <CapabilityToggle
                      label="رؤية منشآت المحافظة كاملة"
                      checked={capabilities.can_view_all_governorate}
                      onChange={(checked) =>
                        setCapabilities((current) => ({
                          ...current,
                          can_view_all_governorate: checked,
                        }))
                      }
                    />
                    <CapabilityToggle
                      label="رؤية منشآت القطاع"
                      checked={capabilities.can_view_sector_facilities}
                      onChange={(checked) =>
                        setCapabilities((current) => ({
                          ...current,
                          can_view_sector_facilities: checked,
                        }))
                      }
                    />
                  </div>
                </section>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
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
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  value,
  label,
  icon,
}: {
  value: number
  label: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/60">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        {icon}
      </div>
      <p className="text-2xl font-black text-slate-900">
        {value.toLocaleString('ar-EG')}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
    </div>
  )
}

function CapabilityChip({ label }: { label: string }) {
  return (
    <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
      {label}
    </span>
  )
}

function CapabilityToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-teal-700"
      />
    </label>
  )
}
