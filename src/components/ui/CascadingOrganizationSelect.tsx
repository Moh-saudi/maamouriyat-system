'use client'

import { useMemo } from 'react'

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
  helperText = 'اختر الجهة بالتتابع حسب تبعيتها الإدارية.',
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

  const ministryChildren = useMemo(() => {
    const sectors = organizations.filter((item) => item.level === 2)
    const directorates = organizations.filter((item) => item.level === 5)
    return sortOptions([...sectors, ...directorates])
  }, [organizations])

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

  const selectedPath = useMemo(() => {
    if (!value) return []

    const selected = byId.get(value)
    if (!selected) return []

    const path: CascadingOrganizationOption[] = []

    if (selected.level >= 5) {
      const ministry = ministryRoots[0]
      const regionalPath: CascadingOrganizationOption[] = []
      let current: CascadingOrganizationOption | undefined = selected
      const visited = new Set<string>()

      while (current && !visited.has(current.id)) {
        visited.add(current.id)
        regionalPath.unshift(current)
        if (current.level === 5) break
        if (!current.parent_id) break
        current = byId.get(current.parent_id)
      }

      return ministry
        ? [ministry, ...regionalPath.filter((item) => item.level >= 5)]
        : regionalPath
    }

    let current: CascadingOrganizationOption | undefined = selected
    const visited = new Set<string>()

    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      path.unshift(current)
      if (!current.parent_id) break
      current = byId.get(current.parent_id)
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

  if (selectedPath.some((item) => item.level === 1) && ministryChildren.length > 0) {
    const selectedBranch = selectedPath.find(
      (item) => item.level === 2 || item.level === 5
    )

    selectors.push({
      key: 'ministry-child',
      options: ministryChildren,
      selectedId: selectedBranch?.id ?? '',
      label: 'الجهة التابعة للوزارة',
    })
  }

  const selectedBranch = selectedPath.find(
    (item) => item.level === 2 || item.level === 5
  )

  if (selectedBranch) {
    const nextLevels =
      selectedBranch.level === 2 ? [3, 4] : [6, 7]

    for (const level of nextLevels) {
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
