'use client'

import { useMemo } from 'react'

export type OrganizationTreeOption = {
  id: string
  name: string
  code: string | null
  level: number
  level_label: string
  parent_id: string | null
  sector_id: string | null
  governorate: string | null
}

function buildDepthMap(
  organizations: readonly OrganizationTreeOption[]
): Map<string, number> {
  const byId = new Map(organizations.map((item) => [item.id, item]))
  const depths = new Map<string, number>()

  function depthOf(id: string, trail = new Set<string>()): number {
    const cached = depths.get(id)
    if (cached !== undefined) return cached

    if (trail.has(id)) return 0

    const item = byId.get(id)
    if (!item?.parent_id || !byId.has(item.parent_id)) {
      depths.set(id, 0)
      return 0
    }

    const nextTrail = new Set(trail)
    nextTrail.add(id)

    const depth = Math.min(6, depthOf(item.parent_id, nextTrail) + 1)
    depths.set(id, depth)
    return depth
  }

  for (const organization of organizations) {
    depthOf(organization.id)
  }

  return depths
}

function sortTree(
  organizations: readonly OrganizationTreeOption[]
): OrganizationTreeOption[] {
  const children = new Map<string | null, OrganizationTreeOption[]>()

  for (const organization of organizations) {
    const key = organization.parent_id
    const list = children.get(key) ?? []
    list.push(organization)
    children.set(key, list)
  }

  for (const list of children.values()) {
    list.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level
      return a.name.localeCompare(b.name, 'ar')
    })
  }

  const result: OrganizationTreeOption[] = []
  const visited = new Set<string>()

  function visit(parentId: string | null) {
    for (const item of children.get(parentId) ?? []) {
      if (visited.has(item.id)) continue
      visited.add(item.id)
      result.push(item)
      visit(item.id)
    }
  }

  visit(null)

  for (const item of organizations) {
    if (!visited.has(item.id)) result.push(item)
  }

  return result
}

interface OrganizationTreeSelectProps {
  organizations: readonly OrganizationTreeOption[]
  value: string | null
  onChange: (organizationId: string | null) => void
  label?: string
  placeholder?: string
  allowGlobal?: boolean
  globalLabel?: string
  disabledIds?: readonly string[]
  required?: boolean
}

export function OrganizationTreeSelect({
  organizations,
  value,
  onChange,
  label = 'الجهة التنظيمية',
  placeholder = 'اختر من الشجرة التنظيمية',
  allowGlobal = false,
  globalLabel = 'دور عام على مستوى النطاق المسموح',
  disabledIds = [],
  required = false,
}: OrganizationTreeSelectProps) {
  const depthMap = useMemo(
    () => buildDepthMap(organizations),
    [organizations]
  )
  const sorted = useMemo(() => sortTree(organizations), [organizations])
  const disabled = useMemo(() => new Set(disabledIds), [disabledIds])

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <select
        value={value ?? ''}
        required={required}
        onChange={(event) =>
          onChange(event.target.value ? event.target.value : null)
        }
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      >
        {!required && (
          <option value="">
            {allowGlobal ? globalLabel : placeholder}
          </option>
        )}

        {required && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}

        {allowGlobal && required && (
          <option value="">{globalLabel}</option>
        )}

        {sorted.map((organization) => {
          const depth = depthMap.get(organization.id) ?? 0
          const prefix = depth > 0 ? `${'— '.repeat(depth)}` : ''
          const code = organization.code ? ` · ${organization.code}` : ''

          return (
            <option
              key={organization.id}
              value={organization.id}
              disabled={disabled.has(organization.id)}
            >
              {prefix}
              {organization.name}
              {code}
            </option>
          )
        })}
      </select>
      <p className="mt-1 text-[11px] leading-5 text-slate-400">
        الاختيار مرتبط بمعرّف الجهة الحقيقي وتبعيتها داخل الشجرة، وليس نصًا حرًا.
      </p>
    </label>
  )
}
