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

const FALLBACK_LEVEL_LABELS: Record<number, string> = {
  1: 'الوزارة',
  2: 'القطاع',
  3: 'الإدارة المركزية',
  4: 'الإدارة العامة',
  5: 'المديرية الصحية',
  6: 'الإدارة الصحية / الجهة',
  7: 'الوحدة التابعة',
}

function sortOptions(
  options: readonly CascadingOrganizationOption[]
): CascadingOrganizationOption[] {
  return [...options].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
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
  helperText = 'اختر المستوى بالتتابع، وستظهر الجهات التابعة للاختيار السابق فقط.',
  allowEmpty = false,
  emptyLabel = 'بدون جهة محددة',
  disabledIds = [],
}: CascadingOrganizationSelectProps) {
  const byId = useMemo(
    () => new Map(organizations.map((item) => [item.id, item])),
    [organizations]
  )

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CascadingOrganizationOption[]>()

    for (const organization of organizations) {
      const parentKey =
        organization.parent_id && byId.has(organization.parent_id)
          ? organization.parent_id
          : null
      const children = map.get(parentKey) ?? []
      children.push(organization)
      map.set(parentKey, children)
    }

    for (const [key, children] of map.entries()) {
      map.set(key, sortOptions(children))
    }

    return map
  }, [organizations, byId])

  const selectedPath = useMemo(() => {
    if (!value) return []

    const path: CascadingOrganizationOption[] = []
    const visited = new Set<string>()
    let current = byId.get(value)

    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      path.unshift(current)

      if (!current.parent_id || !byId.has(current.parent_id)) {
        break
      }

      current = byId.get(current.parent_id)
    }

    return path
  }, [value, byId])

  const disabled = useMemo(() => new Set(disabledIds), [disabledIds])
  const roots = childrenByParent.get(null) ?? []

  const selectors: Array<{
    key: string
    options: CascadingOrganizationOption[]
    selectedId: string
    level: number
  }> = []

  if (roots.length > 0) {
    selectors.push({
      key: 'root',
      options: roots,
      selectedId: selectedPath[0]?.id ?? '',
      level: roots[0]?.level ?? 1,
    })
  }

  for (let index = 0; index < selectedPath.length; index += 1) {
    const selected = selectedPath[index]
    const children = childrenByParent.get(selected.id) ?? []

    if (children.length === 0) continue

    selectors.push({
      key: selected.id,
      options: children,
      selectedId: selectedPath[index + 1]?.id ?? '',
      level: children[0]?.level ?? selected.level + 1,
    })
  }

  function handleSelection(selectorIndex: number, selectedId: string) {
    if (!selectedId) {
      if (selectorIndex === 0) {
        onChange(null)
        return
      }

      const previous = selectedPath[selectorIndex - 1]
      onChange(previous?.id ?? null)
      return
    }

    onChange(selectedId)
  }

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
        {selectors.map((selector, index) => {
          const levelLabel =
            selector.options[0]?.level_label ||
            FALLBACK_LEVEL_LABELS[selector.level] ||
            `المستوى ${selector.level}`

          return (
            <label key={selector.key} className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                {levelLabel}
              </span>
              <select
                value={selector.selectedId}
                onChange={(event) =>
                  handleSelection(index, event.target.value)
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">
                  اختر {levelLabel}
                </option>
                {selector.options.map((organization) => (
                  <option
                    key={organization.id}
                    value={organization.id}
                    disabled={disabled.has(organization.id)}
                  >
                    {organization.name}
                    {organization.code ? ` · ${organization.code}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      {value && byId.get(value) && (
        <div className="rounded-lg bg-teal-50/70 px-3 py-2 text-[11px] font-semibold text-teal-800">
          الجهة المختارة: {byId.get(value)?.name}
        </div>
      )}

      <p className="text-[10px] leading-4 text-slate-400">{helperText}</p>
    </fieldset>
  )
}
