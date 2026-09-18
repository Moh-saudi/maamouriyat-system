'use client'

import { useMemo, useState } from 'react'

export type CascadingOrganizationOption = {
  id: string
  name: string
  code: string | null
  level: number
  level_label: string
  parent_id: string | null
  sector_id: string | null
  governorate: string | null
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'الوزارة',
  2: 'القطاع',
  3: 'الإدارة المركزية',
  4: 'الإدارة العامة',
  5: 'مديرية الشؤون الصحية',
  6: 'الإدارة الصحية / الجهة التابعة',
  7: 'الوحدة التابعة',
}

type OrganizationTrack = 'central' | 'directorates'

function sortOptions(
  options: readonly CascadingOrganizationOption[]
): CascadingOrganizationOption[] {
  return [...options].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

function levelLabel(level: number): string {
  return LEVEL_LABELS[level] || `المستوى التنظيمي ${level}`
}

interface CascadingOrganizationSelectProps {
  organizations: readonly CascadingOrganizationOption[]
  value: string | null
  onChange: (organizationId: string | null) => void
  label?: string
  helperText?: string
  allowEmpty?: boolean
  emptyLabel?: string
  disabledIds?: readonly string[]
}

export function CascadingOrganizationSelect({
  organizations,
  value,
  onChange,
  label = 'الجهة التنظيمية',
  helperText = 'اختر المسار ثم الجهة بالتتابع، وستظهر الجهات التابعة فقط.',
  allowEmpty = false,
  emptyLabel = 'بدون جهة محددة',
  disabledIds = [],
}: CascadingOrganizationSelectProps) {
  const byId = useMemo(
    () => new Map(organizations.map((item) => [item.id, item])),
    [organizations]
  )

  const ministryRoots = useMemo(
    () => sortOptions(organizations.filter((item) => item.level === 1)),
    [organizations]
  )

  const sectors = useMemo(
    () => sortOptions(organizations.filter((item) => item.level === 2)),
    [organizations]
  )

  const directorates = useMemo(
    () => sortOptions(organizations.filter((item) => item.level === 5)),
    [organizations]
  )

  const childrenByParent = useMemo(() => {
    const map = new Map<string, CascadingOrganizationOption[]>()

    for (const organization of organizations) {
      if (!organization.parent_id) continue
      const children = map.get(organization.parent_id) ?? []
      children.push(organization)
      map.set(organization.parent_id, children)
    }

    for (const [key, children] of map.entries()) {
      map.set(key, sortOptions(children))
    }

    return map
  }, [organizations])

  const inferredTrack = useMemo<OrganizationTrack>(() => {
    if (!value) return 'central'

    let current = byId.get(value)
    const visited = new Set<string>()

    while (current && !visited.has(current.id)) {
      visited.add(current.id)

      if (current.level === 5 || current.level === 6 || current.level === 7) {
        return 'directorates'
      }

      if (!current.parent_id) break
      current = byId.get(current.parent_id)
    }

    return 'central'
  }, [value, byId])

  const [manualTrack, setManualTrack] = useState<OrganizationTrack | null>(null)
  const track = manualTrack ?? inferredTrack

  const selectedPath = useMemo(() => {
    if (!value) return []

    const selected = byId.get(value)
    if (!selected) return []

    const path: CascadingOrganizationOption[] = []
    const visited = new Set<string>()
    let current: CascadingOrganizationOption | undefined = selected

    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      path.unshift(current)

      if (current.level === 5) break
      if (!current.parent_id) break
      current = byId.get(current.parent_id)
    }

    if (selected.level >= 5) {
      const ministry = ministryRoots[0]
      return ministry ? [ministry, ...path.filter((item) => item.level >= 5)] : path
    }

    return path
  }, [value, byId, ministryRoots])

  const disabled = useMemo(() => new Set(disabledIds), [disabledIds])

  const selectors: Array<{
    key: string
    options: CascadingOrganizationOption[]
    selectedId: string
    label: string
  }> = []

  if (ministryRoots.length > 0) {
    selectors.push({
      key: 'ministry',
      options: ministryRoots,
      selectedId: selectedPath.find((item) => item.level === 1)?.id ?? '',
      label: 'الوزارة',
    })
  }

  if (track === 'central') {
    if (sectors.length > 0) {
      selectors.push({
        key: 'sector',
        options: sectors,
        selectedId: selectedPath.find((item) => item.level === 2)?.id ?? '',
        label: 'القطاع',
      })
    }

    for (const level of [3, 4]) {
      const parent = selectedPath.find((item) => item.level === level - 1)
      if (!parent) continue

      const options = (childrenByParent.get(parent.id) ?? []).filter(
        (item) => item.level === level
      )

      if (options.length === 0) continue

      selectors.push({
        key: `level-${level}`,
        options,
        selectedId: selectedPath.find((item) => item.level === level)?.id ?? '',
        label: levelLabel(level),
      })
    }
  } else {
    if (directorates.length > 0) {
      selectors.push({
        key: 'directorate',
        options: directorates,
        selectedId: selectedPath.find((item) => item.level === 5)?.id ?? '',
        label: 'مديرية الشؤون الصحية',
      })
    }

    for (const level of [6, 7]) {
      const parent = selectedPath.find((item) => item.level === level - 1)
      if (!parent) continue

      const options = (childrenByParent.get(parent.id) ?? []).filter(
        (item) => item.level === level
      )

      if (options.length === 0) continue

      selectors.push({
        key: `level-${level}`,
        options,
        selectedId: selectedPath.find((item) => item.level === level)?.id ?? '',
        label: levelLabel(level),
      })
    }
  }

  function handleTrackChange(nextTrack: OrganizationTrack) {
    setManualTrack(nextTrack)
    const ministry = ministryRoots[0]
    onChange(ministry?.id ?? null)
  }

  function handleSelection(selectorIndex: number, selectedId: string) {
    if (!selectedId) {
      if (selectorIndex === 0) {
        onChange(null)
        return
      }

      const previousSelector = selectors[selectorIndex - 1]
      onChange(previousSelector?.selectedId || ministryRoots[0]?.id || null)
      return
    }

    const selectedOrganization = byId.get(selectedId)
    if (selectedOrganization) {
      setManualTrack(
        selectedOrganization.level >= 5 ? 'directorates' : 'central'
      )
    }

    onChange(selectedId)
  }

  const selectedOrganization = value ? byId.get(value) : null

  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-1 text-xs font-bold text-slate-600">
        {label}
      </legend>

      {allowEmpty && (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <input
            type="radio"
            checked={!value}
            onChange={() => onChange(null)}
            className="h-4 w-4 accent-teal-700"
          />
          <span className="text-xs font-semibold text-slate-600">
            {emptyLabel}
          </span>
        </label>
      )}

      {ministryRoots.length > 0 && sectors.length > 0 && directorates.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleTrackChange('central')}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
              track === 'central'
                ? 'border-teal-300 bg-teal-50 text-teal-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            الهيكل المركزي
          </button>
          <button
            type="button"
            onClick={() => handleTrackChange('directorates')}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
              track === 'directorates'
                ? 'border-teal-300 bg-teal-50 text-teal-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            المديريات والإدارات الصحية
          </button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {selectors.map((selector, index) => (
          <label key={selector.key} className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
              {selector.label}
            </span>
            <select
              value={selector.selectedId}
              onChange={(event) => handleSelection(index, event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">اختر {selector.label}</option>
              {selector.options.map((organization) => (
                <option
                  key={organization.id}
                  value={organization.id}
                  disabled={disabled.has(organization.id)}
                >
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {selectedOrganization && (
        <div className="rounded-lg bg-teal-50/70 px-3 py-2 text-[11px] font-semibold text-teal-800">
          الجهة المختارة: {selectedOrganization.name}
        </div>
      )}

      <p className="text-[10px] leading-4 text-slate-400">{helperText}</p>
    </fieldset>
  )
}
