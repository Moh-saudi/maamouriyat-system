import 'server-only'

import { getAdminSupabaseClient } from '@/server/supabase/admin'
import type { V2OrganizationFact } from './scope-types'

const MAX_ORG_DEPTH = 8

/**
 * Loads requested organizations plus their ancestors in batched rounds.
 *
 * The organizational hierarchy is capped by design at 7 levels. We allow one
 * extra traversal round for defensive validation and fail closed on cycles or
 * malformed deeper chains.
 */
export async function loadV2OrganizationFacts(
  organizationIds: readonly string[]
): Promise<Map<string, V2OrganizationFact>> {
  const admin = getAdminSupabaseClient()
  const facts = new Map<string, V2OrganizationFact>()
  let pending = new Set(organizationIds.filter(Boolean))

  for (let depth = 0; depth < MAX_ORG_DEPTH && pending.size > 0; depth += 1) {
    const ids = [...pending].filter((id) => !facts.has(id))
    if (ids.length === 0) break

    const { data, error } = await admin
      .from('organizations')
      .select('id, parent_id, sector_id, governorate, level')
      .in('id', ids)

    if (error) {
      throw new Error(
        `[V2 Scope] Failed to load organization facts: ${error.message}`
      )
    }

    if (!data || data.length !== ids.length) {
      throw new Error(
        '[V2 Scope] One or more organization anchors/resources could not be resolved.'
      )
    }

    pending = new Set<string>()

    for (const row of data) {
      const id = String(row.id)
      const parentId = row.parent_id ? String(row.parent_id) : null

      facts.set(id, {
        id,
        parentId,
        sectorId: row.sector_id ? String(row.sector_id) : null,
        governorate:
          typeof row.governorate === 'string' && row.governorate.trim().length > 0
            ? row.governorate.trim()
            : null,
        level: Number(row.level),
      })

      if (parentId && !facts.has(parentId)) {
        pending.add(parentId)
      }
    }
  }

  if (pending.size > 0) {
    throw new Error(
      '[V2 Scope] Organization hierarchy exceeded expected depth or contains a cycle.'
    )
  }

  return facts
}

export function isOrganizationWithinTree(input: {
  resourceOrganizationId: string
  anchorOrganizationId: string
  facts: ReadonlyMap<string, V2OrganizationFact>
}): boolean {
  const { resourceOrganizationId, anchorOrganizationId, facts } = input

  let currentId: string | null = resourceOrganizationId
  const visited = new Set<string>()

  while (currentId) {
    if (currentId === anchorOrganizationId) return true
    if (visited.has(currentId)) return false

    visited.add(currentId)
    currentId = facts.get(currentId)?.parentId ?? null
  }

  return false
}

export function getOrganizationSectorId(
  organizationId: string,
  facts: ReadonlyMap<string, V2OrganizationFact>
): string | null {
  const fact = facts.get(organizationId)
  if (!fact) return null

  if (fact.level === 2) return fact.id
  return fact.sectorId
}

export function getOrganizationGovernorate(
  organizationId: string,
  facts: ReadonlyMap<string, V2OrganizationFact>
): string | null {
  return facts.get(organizationId)?.governorate ?? null
}
