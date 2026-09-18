'use client'

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  History,
  Loader2,
  MapPin,
  Plus,
  Power,
  RotateCcw,
  Search,
  Stethoscope,
  X,
} from 'lucide-react'
import { STANDARD_FACILITY_TYPES } from '@/lib/facility-types'
import type {
  V2FacilityDirectoryData,
  V2FacilityDirectoryItem,
  V2FacilityManagementUi,
  V2HealthAdministrationOption,
} from '@/features/facilities/types'
import { FacilityMap } from './FacilityMap'
import { FacilityAuditDrawer } from './FacilityAuditDrawer'

const PAGE_SIZE = 30

interface FacilitiesExplorerProps {
  data: V2FacilityDirectoryData
  management: V2FacilityManagementUi
}

type EditorMode = 'create' | 'edit'

type EditorState = {
  mode: EditorMode
  facilityId: string | null
  name: string
  facilityTypeLabel: string
  governorate: string
  organizationId: string
  urbanRural: string
  villageCity: string
  latitude: string
  longitude: string
  reason: string
}

function emptyEditor(): EditorState {
  return {
    mode: 'create',
    facilityId: null,
    name: '',
    facilityTypeLabel: 'وحدة صحية',
    governorate: '',
    organizationId: '',
    urbanRural: '',
    villageCity: '',
    latitude: '30.044400',
    longitude: '31.235700',
    reason: '',
  }
}

function canManageFacility(
  management: V2FacilityManagementUi,
  facility: V2FacilityDirectoryItem
): boolean {
  if (!management.isInformationCenter) return false

  return management.anchors.some((anchor) => {
    if (anchor.level === 1) return true

    if (anchor.level === 5) {
      return Boolean(
        anchor.governorate &&
          facility.governorate === anchor.governorate
      )
    }

    if (anchor.level === 6) {
      return facility.organizationId === anchor.organizationId
    }

    return false
  })
}

function canManageHealthAdministration(
  management: V2FacilityManagementUi,
  organization: V2HealthAdministrationOption
): boolean {
  if (!management.isInformationCenter) return false

  return management.anchors.some((anchor) => {
    if (anchor.level === 1) return true

    if (anchor.level === 5) {
      return Boolean(
        anchor.governorate &&
          organization.governorate === anchor.governorate
      )
    }

    if (anchor.level === 6) {
      return organization.id === anchor.organizationId
    }

    return false
  })
}

function CompactMetric({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex min-w-[165px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
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

export function FacilitiesExplorer({
  data,
  management,
}: FacilitiesExplorerProps) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [governorate, setGovernorate] = useState('')
  const [healthAdmin, setHealthAdmin] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [page, setPage] = useState(1)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    null
  )
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [auditFacility, setAuditFacility] =
    useState<V2FacilityDirectoryItem | null>(null)

  const governorates = useMemo(
    () =>
      [...new Set(data.facilities.map((item) => item.governorate))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'ar')),
    [data.facilities]
  )

  const availableHealthAdmins = useMemo(
    () =>
      [
        ...new Set(
          data.facilities
            .filter(
              (item) =>
                !governorate || item.governorate === governorate
            )
            .map((item) => item.healthAdmin)
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, 'ar')),
    [data.facilities, governorate]
  )

  const manageableHealthAdmins = useMemo(
    () =>
      data.healthAdministrations.filter((item) =>
        canManageHealthAdministration(management, item)
      ),
    [data.healthAdministrations, management]
  )

  const editorGovernorates = useMemo(
    () =>
      [...new Set(manageableHealthAdmins.map((item) => item.governorate))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'ar')),
    [manageableHealthAdmins]
  )

  const editorHealthAdmins = useMemo(() => {
    if (!editor) return []

    return manageableHealthAdmins.filter(
      (item) => !editor.governorate || item.governorate === editor.governorate
    )
  }, [editor, manageableHealthAdmins])

  const allFacilityTypeLabels = useMemo(
    () =>
      [
        ...new Set([
          ...STANDARD_FACILITY_TYPES.map((item) => item.label),
          ...data.facilityTypes,
        ]),
      ].sort((a, b) => a.localeCompare(b, 'ar')),
    [data.facilityTypes]
  )

  const groupedFacilityTypes = useMemo(() => {
    const groups = new Map<string, string[]>()

    for (const item of STANDARD_FACILITY_TYPES) {
      const category = item.category || 'أنواع أخرى'
      const labels = groups.get(category) ?? []
      labels.push(item.label)
      groups.set(category, labels)
    }

    const knownLabels = new Set(
      STANDARD_FACILITY_TYPES.map((item) => item.label)
    )

    const extraLabels = allFacilityTypeLabels.filter(
      (label) => !knownLabels.has(label)
    )

    if (extraLabels.length > 0) {
      groups.set('أنواع أخرى', extraLabels)
    }

    return [...groups.entries()].map(([category, labels]) => ({
      category,
      labels: [...new Set(labels)].sort((a, b) =>
        a.localeCompare(b, 'ar')
      ),
    }))
  }, [allFacilityTypeLabels])

  const scopeFilteredFacilities = useMemo(() => {
    const q = deferredSearch.trim().toLocaleLowerCase('ar')

    return data.facilities.filter((item) => {
      if (status === 'active' && !item.isActive) return false
      if (status === 'inactive' && item.isActive) return false

      if (governorate && item.governorate !== governorate) return false
      if (healthAdmin && item.healthAdmin !== healthAdmin) return false

      if (!q) return true

      return [
        item.name,
        item.governorate,
        item.healthAdmin,
        item.villageCity || '',
        item.facilityTypeLabel,
      ].some((value) => value.toLocaleLowerCase('ar').includes(q))
    })
  }, [
    data.facilities,
    deferredSearch,
    governorate,
    healthAdmin,
    status,
  ])

  const visibleTypeCounts = useMemo(() => {
    const counts = new Map<
      string,
      { label: string; total: number; active: number }
    >()

    for (const item of scopeFilteredFacilities) {
      const current = counts.get(item.facilityTypeLabel) ?? {
        label: item.facilityTypeLabel,
        total: 0,
        active: 0,
      }

      current.total += 1
      if (item.isActive) current.active += 1
      counts.set(item.facilityTypeLabel, current)
    }

    return [...counts.values()].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.label.localeCompare(b.label, 'ar')
    })
  }, [scopeFilteredFacilities])

  const filteredFacilities = useMemo(
    () =>
      facilityType
        ? scopeFilteredFacilities.filter(
            (item) => item.facilityTypeLabel === facilityType
          )
        : scopeFilteredFacilities,
    [scopeFilteredFacilities, facilityType]
  )

  const totalPages = Math.max(
    1,
    Math.ceil(filteredFacilities.length / PAGE_SIZE)
  )

  const currentPage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const offset = (currentPage - 1) * PAGE_SIZE
    return filteredFacilities.slice(offset, offset + PAGE_SIZE)
  }, [filteredFacilities, currentPage])

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, governorate, healthAdmin, facilityType, status])

  useEffect(() => {
    if (
      selectedFacilityId &&
      !filteredFacilities.some((item) => item.id === selectedFacilityId)
    ) {
      setSelectedFacilityId(null)
    }
  }, [filteredFacilities, selectedFacilityId])

  useEffect(() => {
    if (
      healthAdmin &&
      !availableHealthAdmins.includes(healthAdmin)
    ) {
      setHealthAdmin('')
    }
  }, [availableHealthAdmins, healthAdmin])

  const handleSelectFacility = useCallback(
    (facilityId: string) => {
      setSelectedFacilityId(facilityId)

      const index = filteredFacilities.findIndex(
        (item) => item.id === facilityId
      )

      if (index >= 0) {
        setPage(Math.floor(index / PAGE_SIZE) + 1)
      }

      window.setTimeout(() => {
        const row = document.getElementById(
          `facility-row-${facilityId}`
        )
        row?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }, 0)
    },
    [filteredFacilities]
  )

  function openCreate() {
    const first = manageableHealthAdmins[0]
    const initial = emptyEditor()

    setEditor({
      ...initial,
      governorate: first?.governorate ?? '',
      organizationId: first?.id ?? '',
    })
    setEditorError(null)
  }

  function openEdit(facility: V2FacilityDirectoryItem) {
    setEditor({
      mode: 'edit',
      facilityId: facility.id,
      name: facility.name,
      facilityTypeLabel: facility.facilityTypeLabel,
      governorate: facility.governorate,
      organizationId: facility.organizationId,
      urbanRural: facility.urbanRural || '',
      villageCity: facility.villageCity || '',
      latitude: facility.latitude.toFixed(6),
      longitude: facility.longitude.toFixed(6),
      reason: '',
    })
    setSelectedFacilityId(facility.id)
    setEditorError(null)
  }

  function closeEditor() {
    setEditor(null)
    setEditorError(null)
  }

  function updateEditor(patch: Partial<EditorState>) {
    setEditor((current) => (current ? { ...current, ...patch } : current))
  }

  async function saveFacility() {
    if (!editor) return

    if (
      !editor.name.trim() ||
      !editor.facilityTypeLabel ||
      !editor.organizationId ||
      !editor.latitude ||
      !editor.longitude
    ) {
      setEditorError('اسم المنشأة ونوعها والإدارة الصحية والموقع بيانات مطلوبة')
      return
    }

    setSaving(true)
    setEditorError(null)

    try {
      const payload = {
        facility_id: editor.facilityId,
        name: editor.name.trim(),
        facility_type: editor.facilityTypeLabel,
        organization_id: editor.organizationId,
        urban_rural: editor.urbanRural || null,
        village_city: editor.villageCity.trim() || null,
        latitude: Number(editor.latitude),
        longitude: Number(editor.longitude),
        reason: editor.reason.trim() || null,
      }

      const response = await fetch('/api/admin/facilities', {
        method: editor.mode === 'create' ? 'POST' : 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editor.mode === 'create'
            ? payload
            : { ...payload, action: 'update' }
        ),
      })

      const result = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(result.error || 'تعذر حفظ المنشأة')
      }

      window.location.reload()
    } catch (saveError) {
      setEditorError(
        saveError instanceof Error ? saveError.message : 'تعذر حفظ المنشأة'
      )
    } finally {
      setSaving(false)
    }
  }

  async function changeFacilityStatus(
    facility: V2FacilityDirectoryItem
  ) {
    const action = facility.isActive ? 'deactivate' : 'reactivate'
    const verb = facility.isActive ? 'إيقاف' : 'إعادة تفعيل'

    if (!window.confirm(`هل تريد ${verb} المنشأة "${facility.name}"؟`)) {
      return
    }

    const reason =
      window.prompt(
        `سبب ${verb} المنشأة (اختياري، ويُحفظ في سجل التعديلات):`
      ) || ''

    setSaving(true)

    try {
      const response = await fetch('/api/admin/facilities', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facility.id,
          action,
          reason,
        }),
      })

      const result = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(result.error || 'تعذر تغيير حالة المنشأة')
      }

      window.location.reload()
    } catch (statusError) {
      window.alert(
        statusError instanceof Error
          ? statusError.message
          : 'تعذر تغيير حالة المنشأة'
      )
    } finally {
      setSaving(false)
    }
  }

  const mapPickedLocation =
    editor &&
    Number.isFinite(Number(editor.latitude)) &&
    Number.isFinite(Number(editor.longitude))
      ? {
          latitude: Number(editor.latitude),
          longitude: Number(editor.longitude),
        }
      : null

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-2.5">
        <CompactMetric
          icon={<Building2 className="h-4 w-4" />}
          value={data.ministryTotal}
          label="إجمالي المنشآت"
        />
        <CompactMetric
          icon={<Stethoscope className="h-4 w-4" />}
          value={data.activeTotal}
          label="منشأة نشطة"
        />
        <CompactMetric
          icon={<MapPin className="h-4 w-4" />}
          value={data.governorateCount}
          label="محافظة"
        />
        {management.canCreate && manageableHealthAdmins.length > 0 && (
          <button
            type="button"
            onClick={openCreate}
            className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 text-xs font-bold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            إضافة منشأة
          </button>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-extrabold text-slate-800">
              توزيع المنشآت حسب النوع
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-400">
              اضغط على أي نوع لتصفية القائمة والخريطة مباشرة.
            </p>
          </div>

          {facilityType && (
            <button
              type="button"
              onClick={() => {
                setFacilityType('')
                setSelectedFacilityId(null)
              }}
              className="text-[10px] font-bold text-teal-700 hover:text-teal-800"
            >
              عرض كل الأنواع
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {visibleTypeCounts.map((item) => {
            const selected = facilityType === item.label

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setFacilityType(selected ? '' : item.label)
                  setSelectedFacilityId(null)
                }}
                className={`min-w-[150px] shrink-0 rounded-xl border px-3 py-2.5 text-right transition ${
                  selected
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-[11px] font-bold ${
                      selected ? 'text-teal-800' : 'text-slate-700'
                    }`}
                  >
                    {item.label}
                  </span>
                  <strong
                    className={`text-base font-black ${
                      selected ? 'text-teal-800' : 'text-slate-900'
                    }`}
                  >
                    {item.total.toLocaleString('en-US')}
                  </strong>
                </div>

                {item.active !== item.total && (
                  <p className="mt-1 text-[9px] text-slate-400">
                    {item.active.toLocaleString('en-US')} نشطة
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_repeat(4,minmax(140px,1fr))]">
          <label className="relative">
            <span className="sr-only">البحث</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setSelectedFacilityId(null)
              }}
              placeholder="ابحث باسم المنشأة أو المكان..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <select
            value={governorate}
            onChange={(event) => {
              setGovernorate(event.target.value)
              setHealthAdmin('')
              setSelectedFacilityId(null)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-500"
            aria-label="المحافظة"
          >
            <option value="">كل المحافظات</option>
            {governorates.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={healthAdmin}
            onChange={(event) => {
              setHealthAdmin(event.target.value)
              setSelectedFacilityId(null)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-500"
            aria-label="الإدارة الصحية"
          >
            <option value="">كل الإدارات الصحية</option>
            {availableHealthAdmins.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={facilityType}
            onChange={(event) => {
              setFacilityType(event.target.value)
              setSelectedFacilityId(null)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-500"
            aria-label="نوع المنشأة"
          >
            <option value="">كل أنواع المنشآت</option>
            {data.facilityTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as 'active' | 'inactive' | 'all'
              )
              setSelectedFacilityId(null)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-500"
            aria-label="الحالة"
          >
            <option value="active">النشطة فقط</option>
            <option value="inactive">الموقوفة فقط</option>
            <option value="all">كل الحالات</option>
          </select>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(620px,1.08fr)_minmax(430px,.92fr)]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {editor ? (
            <div>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold text-teal-700">
                    {editor.mode === 'create'
                      ? 'إضافة منشأة'
                      : 'تصحيح بيانات المنشأة'}
                  </p>
                  <h2 className="mt-1 text-sm font-extrabold text-slate-900">
                    {editor.mode === 'create'
                      ? 'منشأة جديدة'
                      : editor.name}
                  </h2>
                  <p className="mt-1 text-[10px] text-slate-500">
                    انقر على الخريطة لتحديد الموقع الجغرافي بدقة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                  aria-label="إغلاق المحرر"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {editorError && (
                  <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {editorError}
                  </div>
                )}

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    اسم المنشأة
                  </span>
                  <input
                    value={editor.name}
                    onChange={(event) =>
                      updateEditor({ name: event.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-teal-500"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    نوع المنشأة
                  </span>
                  <select
                    value={editor.facilityTypeLabel}
                    onChange={(event) =>
                      updateEditor({
                        facilityTypeLabel: event.target.value,
                      })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                  >
                    {groupedFacilityTypes.map((group) => (
                      <optgroup key={group.category} label={group.category}>
                        {group.labels.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    المحافظة
                  </span>
                  <select
                    value={editor.governorate}
                    onChange={(event) => {
                      const nextGovernorate = event.target.value
                      const firstAdmin = manageableHealthAdmins.find(
                        (item) => item.governorate === nextGovernorate
                      )
                      updateEditor({
                        governorate: nextGovernorate,
                        organizationId: firstAdmin?.id ?? '',
                      })
                    }}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                  >
                    {editorGovernorates.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    الإدارة الصحية
                  </span>
                  <select
                    value={editor.organizationId}
                    onChange={(event) =>
                      updateEditor({ organizationId: event.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                  >
                    {editorHealthAdmins.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    حضر / ريف
                  </span>
                  <select
                    value={editor.urbanRural}
                    onChange={(event) =>
                      updateEditor({ urbanRural: event.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs"
                  >
                    <option value="">غير محدد</option>
                    <option value="حضر">حضر</option>
                    <option value="ريف">ريف</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    المدينة / القرية
                  </span>
                  <input
                    value={editor.villageCity}
                    onChange={(event) =>
                      updateEditor({ villageCity: event.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    خط العرض
                  </span>
                  <input
                    dir="ltr"
                    value={editor.latitude}
                    onChange={(event) =>
                      updateEditor({ latitude: event.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-left text-xs"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    خط الطول
                  </span>
                  <input
                    dir="ltr"
                    value={editor.longitude}
                    onChange={(event) =>
                      updateEditor({ longitude: event.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-left text-xs"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    سبب التصحيح
                  </span>
                  <textarea
                    value={editor.reason}
                    onChange={(event) =>
                      updateEditor({ reason: event.target.value })
                    }
                    rows={2}
                    placeholder="مثال: تصحيح اسم المنشأة أو نقل التبعية بعد مراجعة المديرية..."
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
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
                  onClick={() => void saveFacility()}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  حفظ التعديل
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-right">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-500">
                      <th className="px-4 py-2.5">المنشأة</th>
                      <th className="px-4 py-2.5">النوع</th>
                      <th className="px-4 py-2.5">المحافظة</th>
                      <th className="px-4 py-2.5">الإدارة الصحية</th>
                      <th className="px-4 py-2.5 text-center">مرات المرور</th>
                      <th className="px-4 py-2.5">الحالة</th>
                      {management.canAudit && (
                        <th className="px-4 py-2.5 text-center">السجل</th>
                      )}
                      {(management.canEdit || management.canDeactivate) && (
                        <th className="px-4 py-2.5">الإجراءات</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageItems.map((facility) => {
                      const manageable = canManageFacility(
                        management,
                        facility
                      )
                      const selected =
                        selectedFacilityId === facility.id

                      return (
                        <tr
                          id={`facility-row-${facility.id}`}
                          key={facility.id}
                          onClick={() =>
                            handleSelectFacility(facility.id)
                          }
                          className={`cursor-pointer transition ${
                            selected
                              ? 'bg-teal-50/70'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <p className="max-w-[300px] text-xs font-bold text-slate-900">
                              {facility.name}
                            </p>
                            {facility.villageCity && (
                              <p className="mt-1 max-w-[300px] truncate text-[10px] text-slate-400">
                                {facility.villageCity}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                              {facility.facilityTypeLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                            {facility.governorate}
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[190px] truncate text-xs text-slate-600">
                              {facility.healthAdmin}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className="inline-flex min-w-8 justify-center rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700"
                              title={
                                facility.lastVisitAt
                                  ? `آخر مرور: ${new Date(
                                      facility.lastVisitAt
                                    ).toLocaleDateString('en-GB')}`
                                  : 'لا توجد زيارات منفذة مسجلة'
                              }
                            >
                              {facility.visitCount.toLocaleString(
                                'en-US'
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                facility.isActive
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {facility.isActive ? 'نشطة' : 'موقوفة'}
                            </span>
                          </td>

                          {management.canAudit && (
                            <td
                              className="px-4 py-3 text-center"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {manageable ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAuditFacility(facility)
                                  }
                                  title={
                                    facility.lastAuditAt
                                      ? `آخر تعديل: ${new Date(
                                          facility.lastAuditAt
                                        ).toLocaleString('en-GB')} بواسطة ${facility.lastAuditActorName || 'مستخدم'}`
                                      : facility.updatedAt
                                        ? `آخر تحديث سابق للسجل: ${new Date(
                                            facility.updatedAt
                                          ).toLocaleString('en-GB')}`
                                        : 'عرض سجل التعديلات'
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-teal-700"
                                >
                                  <History className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-slate-200">—</span>
                              )}
                            </td>
                          )}

                          {(management.canEdit ||
                            management.canDeactivate) && (
                            <td
                              className="px-4 py-3"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {manageable ? (
                                <div className="flex items-center gap-1">
                                  {management.canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => openEdit(facility)}
                                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                      تعديل
                                    </button>
                                  )}

                                  {management.canDeactivate && (
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() =>
                                        void changeFacilityStatus(
                                          facility
                                        )
                                      }
                                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-bold ${
                                        facility.isActive
                                          ? 'border-red-100 bg-white text-red-600 hover:bg-red-50'
                                          : 'border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50'
                                      }`}
                                    >
                                      {facility.isActive ? (
                                        <Power className="h-3.5 w-3.5" />
                                      ) : (
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      )}
                                      {facility.isActive
                                        ? 'إيقاف'
                                        : 'تفعيل'}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-300">
                                  خارج نطاق الإدارة
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {pageItems.length === 0 && (
                <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center">
                  <Building2 className="mb-3 h-8 w-8 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">
                    لا توجد منشآت مطابقة للفلاتر الحالية
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                <p className="text-[10px] text-slate-500">
                  صفحة {currentPage.toLocaleString('en-US')} من{' '}
                  {totalPages.toLocaleString('en-US')} —{' '}
                  {filteredFacilities.length.toLocaleString('en-US')}{' '}
                  منشأة
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    السابق
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(totalPages, current + 1)
                      )
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 disabled:opacity-40"
                  >
                    التالي
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="min-h-[520px] xl:sticky xl:top-[76px] xl:h-[calc(100vh-92px)]">
          <FacilityMap
            facilities={filteredFacilities}
            selectedFacilityId={selectedFacilityId}
            onSelectFacility={handleSelectFacility}
            pickingLocation={Boolean(editor)}
            pickedLocation={mapPickedLocation}
            onMapLocationPick={(latitude, longitude) =>
              updateEditor({
                latitude: latitude.toFixed(6),
                longitude: longitude.toFixed(6),
              })
            }
          />
        </div>
      </section>

      <FacilityAuditDrawer
        open={Boolean(auditFacility)}
        facilityId={auditFacility?.id ?? null}
        facilityName={auditFacility?.name ?? ''}
        onClose={() => setAuditFacility(null)}
      />
    </div>
  )
}
