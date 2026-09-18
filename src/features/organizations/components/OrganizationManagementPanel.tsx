'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Archive,
  Building2,
  FileText,
  Loader2,
  MapPin,
  Network,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  CascadingOrganizationSelect,
  type CascadingOrganizationOption,
} from '@/components/ui/CascadingOrganizationSelect'

type OrganizationUsage = {
  usersTotal: number
  usersActive: number
  childOrganizationsTotal: number
  childOrganizationsActive: number
  facilitiesTotal: number
  facilitiesActive: number
  missionsCreated: number
  missionsInspector: number
  activeRoleAssignments: number
  formTemplatesTotal: number
  violationsTotal: number
  leadershipTargetsTotal: number
  missionTargetsTotal: number
}

type Organization = CascadingOrganizationOption & {
  organization_type_code: string
  organization_type_name_ar: string
  health_admin: string | null
  is_active: boolean | null
  can_issue_missions: boolean
  can_approve_missions: boolean
  can_view_all_governorate: boolean
  can_view_sector_facilities: boolean
  lifecycle_status: 'active' | 'inactive' | 'archived'
  created_at: string | null
  created_by_name: string | null
  updated_at: string | null
  updated_by_name: string | null
  deactivated_at: string | null
  deactivated_by_name: string | null
  archived_at: string | null
  archived_by_name: string | null
  usage: OrganizationUsage
}

type OrganizationTypeOption = {
  code: string
  nameAr: string
  descriptionAr: string | null
}

type OrganizationTypeRelation = {
  parentTypeCode: string
  childTypeCode: string
}

type OrganizationsResponse = {
  success?: boolean
  data?: Organization[]
  organizationTypes?: OrganizationTypeOption[]
  typeRelations?: OrganizationTypeRelation[]
  error?: string
}

interface OrganizationManagementPanelProps {
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
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
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        {icon}
      </div>
      <div>
        <p className="text-xl font-black leading-none text-slate-900">
          {value.toLocaleString('en-US')}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export function OrganizationManagementPanel({
  canCreate,
  canEdit,
  canDelete,
}: OrganizationManagementPanelProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organizationTypes, setOrganizationTypes] = useState<
    OrganizationTypeOption[]
  >([])
  const [typeRelations, setTypeRelations] = useState<
    OrganizationTypeRelation[]
  >([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [detailsOrganization, setDetailsOrganization] =
    useState<Organization | null>(null)
  const [editing, setEditing] = useState<Organization | null>(null)
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [organizationTypeCode, setOrganizationTypeCode] = useState('')
  const [governorate, setGovernorate] = useState('')

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
      setOrganizationTypes(payload.organizationTypes ?? [])
      setTypeRelations(payload.typeRelations ?? [])
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

  const typeByCode = useMemo(
    () =>
      new Map(
        organizationTypes.map((type) => [type.code, type])
      ),
    [organizationTypes]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ar')

    return organizations.filter((organization) => {
      if (
        typeFilter !== 'all' &&
        organization.organization_type_code !== typeFilter
      ) {
        return false
      }

      if (
        statusFilter !== 'all' &&
        organization.lifecycle_status !== statusFilter
      ) {
        return false
      }

      if (!q) return true

      return [
        organization.name,
        organization.organization_type_name_ar,
        organization.governorate || '',
        organization.health_admin || '',
      ].some((value) => value.toLocaleLowerCase('ar').includes(q))
    })
  }, [organizations, search, typeFilter, statusFilter])

  const sectorCount = organizations.filter(
    (item) => item.organization_type_code === 'sector'
  ).length

  const directorateCount = organizations.filter(
    (item) => item.organization_type_code === 'health_directorate'
  ).length

  const activeOrganizationCount = organizations.filter(
    (item) => item.lifecycle_status === 'active'
  ).length

  function hasRecordedActivity(organization: Organization): boolean {
    return (
      organization.usage.usersActive > 0 ||
      organization.usage.activeRoleAssignments > 0 ||
      organization.usage.missionsCreated > 0 ||
      organization.usage.missionsInspector > 0
    )
  }

  function hasLinkedRecords(organization: Organization): boolean {
    const usage = organization.usage
    return (
      usage.usersTotal +
        usage.childOrganizationsTotal +
        usage.facilitiesTotal +
        usage.missionsCreated +
        usage.missionsInspector +
        usage.activeRoleAssignments +
        usage.formTemplatesTotal +
        usage.violationsTotal +
        usage.leadershipTargetsTotal +
        usage.missionTargetsTotal >
      0
    )
  }

  function lifecycleLabel(organization: Organization): string {
    if (organization.lifecycle_status === 'archived') return 'مؤرشفة'
    if (organization.lifecycle_status === 'inactive') return 'موقوفة'
    return 'نشطة'
  }

  function formatDate(value: string | null): string {
    if (!value) return 'غير مسجل'
    return new Date(value).toLocaleDateString('en-GB')
  }

  function openEdit(organization: Organization) {
    setEditing(organization)
    setCreating(false)
    setName(organization.name)
    setParentId(organization.parent_id)
    setOrganizationTypeCode(organization.organization_type_code)
    setGovernorate(organization.governorate || '')
    setError(null)
  }

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setName('')
    setParentId(null)
    setOrganizationTypeCode('')
    setGovernorate('')
    setError(null)
  }

  function closeEditor() {
    setEditing(null)
    setCreating(false)
    setName('')
    setParentId(null)
    setOrganizationTypeCode('')
    setGovernorate('')
    setError(null)
  }

  const disabledParentIds = useMemo(() => {
    if (!editing) return []
    return [editing.id, ...descendantsOf(editing.id, organizations)]
  }, [editing, organizations])

  const selectedParent = parentId
    ? organizationById.get(parentId) ?? null
    : null

  const allowedTypeCodes = useMemo(() => {
    if (!selectedParent) return new Set<string>()

    const result = new Set(
      typeRelations
        .filter(
          (relation) =>
            relation.parentTypeCode ===
            selectedParent.organization_type_code
        )
        .map((relation) => relation.childTypeCode)
    )

    if (
      editing &&
      parentId === editing.parent_id &&
      editing.organization_type_code
    ) {
      result.add(editing.organization_type_code)
    }

    return result
  }, [selectedParent, typeRelations, editing, parentId])

  const availableTypes = useMemo(
    () =>
      organizationTypes.filter((type) =>
        allowedTypeCodes.has(type.code)
      ),
    [organizationTypes, allowedTypeCodes]
  )

  const currentRelationIsLegacy = Boolean(
    editing &&
      selectedParent &&
      !typeRelations.some(
        (relation) =>
          relation.parentTypeCode ===
            selectedParent.organization_type_code &&
          relation.childTypeCode === editing.organization_type_code
      )
  )

  function handleParentChange(nextParentId: string | null) {
    setParentId(nextParentId)

    if (!nextParentId) {
      setOrganizationTypeCode('')
      return
    }

    const nextParent = organizationById.get(nextParentId)
    if (!nextParent) {
      setOrganizationTypeCode('')
      return
    }

    const nextAllowed = typeRelations
      .filter(
        (relation) =>
          relation.parentTypeCode ===
          nextParent.organization_type_code
      )
      .map((relation) => relation.childTypeCode)

    const canKeepCurrent =
      editing &&
      nextParentId === editing.parent_id &&
      organizationTypeCode === editing.organization_type_code

    if (!canKeepCurrent && !nextAllowed.includes(organizationTypeCode)) {
      setOrganizationTypeCode(
        nextAllowed.length === 1 ? nextAllowed[0] : ''
      )
    }
  }

  async function save() {
    if (!name.trim()) {
      setError('اسم الجهة مطلوب')
      return
    }

    if (!parentId) {
      setError('يجب اختيار الجهة الأم')
      return
    }

    if (!organizationTypeCode) {
      setError('يجب اختيار نوع الجهة')
      return
    }

    if (
      organizationTypeCode === 'health_directorate' &&
      !governorate.trim()
    ) {
      setError('المحافظة مطلوبة لمديرية الشؤون الصحية')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        parent_id: parentId,
        organization_type_code: organizationTypeCode,
      }

      if (organizationTypeCode === 'health_directorate') {
        body.governorate = governorate.trim()
      }

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

  async function changeLifecycle(
    organization: Organization,
    action: 'deactivate' | 'reactivate' | 'archive'
  ) {
    const actionLabel =
      action === 'deactivate'
        ? 'إيقاف'
        : action === 'archive'
          ? 'أرشفة'
          : 'إعادة تفعيل'

    if (
      !window.confirm(
        `هل تريد ${actionLabel} الجهة "${organization.name}"؟`
      )
    ) {
      return
    }

    const reason =
      action === 'reactivate'
        ? ''
        : window.prompt(
            `سبب ${actionLabel} الجهة (اختياري ويُسجل في التاريخ):`
          ) || ''

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: organization.id,
          action,
          reason,
        }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تغيير حالة الجهة')
      }

      setDetailsOrganization(null)
      await load()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'تعذر تغيير حالة الجهة'
      )
    } finally {
      setSaving(false)
    }
  }

  async function hardDeleteOrganization(organization: Organization) {
    if (hasLinkedRecords(organization)) {
      setError(
        'لا يمكن حذف الجهة نهائيًا لوجود سجلات مرتبطة بها. استخدم الأرشفة.'
      )
      return
    }

    if (
      !window.confirm(
        `حذف "${organization.name}" نهائيًا؟ هذا الإجراء مخصص للجهة المضافة بالخطأ ولا يمكن التراجع عنه.`
      )
    ) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/organizations?id=${encodeURIComponent(organization.id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      )

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر حذف الجهة')
      }

      setDetailsOrganization(null)
      await load()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'تعذر حذف الجهة'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        جارٍ تحميل الهيكل التنظيمي...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && !editing && !creating && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="flex flex-wrap gap-2.5">
        <SimpleStat
          icon={<Network className="h-4 w-4" />}
          value={organizations.length}
          label="جهة تنظيمية"
        />
        <SimpleStat
          icon={<Building2 className="h-4 w-4" />}
          value={sectorCount}
          label="قطاع"
        />
        <SimpleStat
          icon={<MapPin className="h-4 w-4" />}
          value={directorateCount}
          label="مديرية شؤون صحية"
        />
        <SimpleStat
          icon={<Power className="h-4 w-4" />}
          value={activeOrganizationCount}
          label="جهة نشطة"
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">البحث في الجهات</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث باسم الجهة أو المحافظة..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-teal-500"
            >
              <option value="all">كل أنواع الجهات</option>
              {organizationTypes
                .filter((type) => type.code !== 'ministry')
                .map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.nameAr}
                  </option>
                ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-teal-500"
            >
              <option value="all">كل الحالات</option>
              <option value="active">النشطة</option>
              <option value="inactive">الموقوفة</option>
              <option value="archived">المؤرشفة</option>
            </select>
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 text-xs font-bold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              إضافة جهة
            </button>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1180px] border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold text-slate-500">
                <th className="px-4 py-2.5">الجهة</th>
                <th className="px-4 py-2.5">النوع</th>
                <th className="px-4 py-2.5">الجهة الأم</th>
                <th className="px-4 py-2.5">المحافظة / النطاق</th>
                <th className="px-4 py-2.5">الإضافة</th>
                <th className="px-4 py-2.5">الاستخدام</th>
                <th className="px-4 py-2.5">الحالة</th>
                <th className="px-4 py-2.5">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((organization) => {
                const parent = organization.parent_id
                  ? organizationById.get(organization.parent_id)
                  : null

                return (
                  <tr key={organization.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-slate-900">
                        {organization.name}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                        {organization.organization_type_name_ar}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {organization.organization_type_code ===
                      'health_directorate'
                        ? 'وزارة الصحة والسكان'
                        : parent?.name || 'جهة رئيسية'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {organization.governorate ||
                        organization.health_admin ||
                        'نطاق مركزي'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[10px] font-semibold text-slate-600">
                        {formatDate(organization.created_at)}
                      </p>
                      <p className="mt-1 max-w-[150px] truncate text-[9px] text-slate-400">
                        {organization.created_by_name || 'من السجلات السابقة'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-[10px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>
                            {organization.usage.usersActive.toLocaleString('en-US')} حساب نشط
                          </span>
                        </div>
                        <div>
                          {(
                            organization.usage.missionsCreated +
                            organization.usage.missionsInspector
                          ).toLocaleString('en-US')}{' '}
                          مأمورية ·{' '}
                          {organization.usage.childOrganizationsTotal.toLocaleString(
                            'en-US'
                          )}{' '}
                          جهة تابعة
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            hasRecordedActivity(organization)
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {hasRecordedActivity(organization)
                            ? 'نشاط مسجل'
                            : 'لا نشاط مسجل'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                          organization.lifecycle_status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : organization.lifecycle_status === 'archived'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {lifecycleLabel(organization)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailsOrganization(organization)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          ملف الجهة
                        </button>
                        {canEdit &&
                          organization.organization_type_code !== 'ministry' && (
                            <button
                              type="button"
                              onClick={() => openEdit(organization)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 hover:border-teal-300 hover:text-teal-800"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              تعديل
                            </button>
                          )}
                      </div>
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
                      {organization.organization_type_name_ar} •{' '}
                      {organization.organization_type_code ===
                      'health_directorate'
                        ? 'وزارة الصحة والسكان'
                        : parent?.name || 'جهة رئيسية'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      organization.lifecycle_status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : organization.lifecycle_status === 'archived'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {lifecycleLabel(organization)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500">
                  <div>
                    <span className="block text-slate-400">أضيفت</span>
                    <strong className="text-slate-700">
                      {formatDate(organization.created_at)}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-slate-400">الحسابات النشطة</span>
                    <strong className="text-slate-700">
                      {organization.usage.usersActive.toLocaleString('en-US')}
                    </strong>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailsOrganization(organization)}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"
                  >
                    <FileText className="h-4 w-4" />
                    ملف الجهة
                  </button>
                  {canEdit &&
                    organization.organization_type_code !== 'ministry' && (
                      <button
                        type="button"
                        onClick={() => openEdit(organization)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                        تعديل
                      </button>
                    )}
                </div>
              </article>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex min-h-52 flex-col items-center justify-center px-5 py-10 text-center">
            <Building2 className="mb-3 h-8 w-8 text-slate-300" />
            <p className="text-xs font-bold text-slate-700">
              لا توجد جهات مطابقة
            </p>
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
          <div className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold text-teal-700">
                  {editing ? 'تعديل جهة' : 'إضافة جهة'}
                </p>
                <h2
                  id="organization-editor-title"
                  className="mt-1 text-base font-extrabold text-slate-900"
                >
                  {editing ? editing.name : 'جهة تنظيمية جديدة'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-135px)] space-y-4 overflow-y-auto p-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-600">
                  اسم الجهة
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  placeholder="مثال: الإدارة العامة للطب العلاجي"
                />
              </label>

              <CascadingOrganizationSelect
                organizations={organizations}
                value={parentId}
                onChange={handleParentChange}
                label="الجهة الأم"
                disabledIds={disabledParentIds}
                helperText="اختر الجهة التي تتبع لها الوحدة إداريًا، ثم اختر نوع الجهة من الأنواع المسموحة تحتها."
              />

              {parentId && (
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-600">
                    نوع الجهة
                  </span>
                  <select
                    value={organizationTypeCode}
                    onChange={(event) =>
                      setOrganizationTypeCode(event.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                  >
                    <option value="">اختر نوع الجهة</option>
                    {availableTypes.map((type) => (
                      <option key={type.code} value={type.code}>
                        {type.nameAr}
                      </option>
                    ))}
                  </select>

                  {organizationTypeCode && (
                    <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                      {typeByCode.get(organizationTypeCode)?.descriptionAr ||
                        'تصنيف إداري داخل الهيكل التنظيمي.'}
                    </p>
                  )}
                </label>
              )}

              {currentRelationIsLegacy && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-800">
                  التبعية الحالية واردة من الهيكل القديم. يمكن حفظ الاسم كما
                  هو، أو اختيار تبعية ونوع جديدين لتصحيحها وفق الهيكل
                  التنظيمي الجديد.
                </div>
              )}

              {organizationTypeCode === 'health_directorate' && (
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-600">
                    المحافظة
                  </span>
                  <input
                    value={governorate}
                    onChange={(event) => setGovernorate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
                    placeholder="مثال: الدقهلية"
                  />
                </label>
              )}

              <div className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-5 text-slate-500">
                المنشآت الصحية مثل المستشفيات والوحدات والمراكز والعيادات
                لا تُضاف من الهيكل التنظيمي؛ تُدار من شاشة المنشآت الصحية
                مع تحديد تبعيتها المناسبة.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              <button
                type="button"
                onClick={closeEditor}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-700 px-5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
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
