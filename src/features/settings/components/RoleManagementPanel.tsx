'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import {
  CascadingOrganizationSelect,
  type CascadingOrganizationOption,
} from '@/components/ui/CascadingOrganizationSelect'
import {
  ROLE_TEMPLATE_CATALOG,
  type RoleTemplateDefinition,
} from '@/config/role-templates'

const SCOPE_LABELS: Record<string, string> = {
  self: 'المستخدم نفسه',
  assigned: 'ما تم تكليفه به',
  organization: 'الجهة فقط',
  organization_tree: 'الجهة وما يتبعها',
  governorate: 'المحافظة',
  sector: 'القطاع',
  national: 'كل المنظومة',
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'لوحة التحكم',
  missions: 'المأموريات',
  mission_results: 'نتائج المأموريات',
  violations: 'المخالفات',
  facilities: 'المنشآت الصحية',
  organizations: 'الهيكل التنظيمي',
  users: 'المستخدمون',
  checklists: 'نماذج التقييم',
  targets: 'المستهدفات',
  leadership_targets: 'مستهدفات القيادات',
  settings: 'الإعدادات',
  audit: 'سجل التدقيق',
}

type Role = {
  id: string
  code: string
  name_ar: string
  description_ar: string | null
  owner_organization_id: string | null
  is_system: boolean
  is_active: boolean
  priority: number
}

type Grant = {
  role_id: string
  permission_key: string
  scope_type: string
}

type Permission = {
  key: string
  module: string
  action: string
  display_name_ar: string
  description_ar: string | null
  is_sensitive: boolean
  is_active: boolean
  sort_order: number
}

type RolesPayload = {
  roles: Role[]
  grants: Grant[]
  permissions: Permission[]
  delegationScopes: Record<string, string[]>
  organizations: CascadingOrganizationOption[]
  capabilities: {
    canManageRoles: boolean
    canCreateGlobalRoles: boolean
    canManagePermissionRegistry: boolean
  }
  error?: string
}

type RoleDraft = {
  roleId: string | null
  code: string
  nameAr: string
  descriptionAr: string
  ownerOrganizationId: string | null
  grants: Map<string, string>
}

function emptyDraft(): RoleDraft {
  return {
    roleId: null,
    code: '',
    nameAr: '',
    descriptionAr: '',
    ownerOrganizationId: null,
    grants: new Map(),
  }
}

function createDraft(role: Role, grants: Grant[]): RoleDraft {
  return {
    roleId: role.id,
    code: role.code,
    nameAr: role.name_ar,
    descriptionAr: role.description_ar || '',
    ownerOrganizationId: role.owner_organization_id,
    grants: new Map(
      grants
        .filter((grant) => grant.role_id === role.id)
        .map((grant) => [grant.permission_key, grant.scope_type])
    ),
  }
}

export function RoleManagementPanel() {
  const [data, setData] = useState<RolesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft)
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/roles', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as RolesPayload

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل أنواع العمل')
      }

      setData(payload)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'تعذر تحميل أنواع العمل'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const permissionGroups = useMemo<Array<[string, Permission[]]>>(() => {
    const groups = new Map<string, Permission[]>()

    for (const permission of data?.permissions ?? []) {
      const current = groups.get(permission.module) ?? []
      current.push(permission)
      groups.set(permission.module, current)
    }

    return Array.from(groups.entries())
  }, [data?.permissions])

  const permissionByKey = useMemo(
    () =>
      new Map((data?.permissions ?? []).map((permission) => [permission.key, permission])),
    [data?.permissions]
  )

  function startCreate() {
    setDraft(emptyDraft())
    setSelectedTemplateId('')
    setEditing(true)
    setError(null)
  }

  function startEdit(role: Role) {
    if (role.is_system || !data) return
    setDraft(createDraft(role, data.grants))
    setSelectedTemplateId('')
    setEditing(true)
    setError(null)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft(emptyDraft())
    setSelectedTemplateId('')
    setError(null)
  }

  function togglePermission(permissionKey: string) {
    if (!data) return

    setDraft((current) => {
      const grants = new Map(current.grants)

      if (grants.has(permissionKey)) {
        grants.delete(permissionKey)
      } else {
        const scopes = data.delegationScopes[permissionKey] ?? []
        if (scopes.length === 0) return current

        grants.set(
          permissionKey,
          scopes.includes('organization_tree')
            ? 'organization_tree'
            : scopes[0]
        )
      }

      return { ...current, grants }
    })
  }

  function updateScope(permissionKey: string, scopeType: string) {
    setDraft((current) => {
      const grants = new Map(current.grants)
      grants.set(permissionKey, scopeType)
      return { ...current, grants }
    })
  }

  function pickDelegableScope(
    permissionKey: string,
    preferredScopes: readonly string[]
  ): string | null {
    if (!data) return null

    const allowedScopes = data.delegationScopes[permissionKey] ?? []

    for (const scope of preferredScopes) {
      if (allowedScopes.includes(scope)) return scope
    }

    return allowedScopes[0] ?? null
  }

  function applyRoleTemplate(template: RoleTemplateDefinition) {
    if (!data) return

    const grants = new Map<string, string>()

    if (template.sourceSystemRoleCode) {
      const sourceRole = data.roles.find(
        (role) => role.code === template.sourceSystemRoleCode
      )

      if (sourceRole) {
        for (const grant of data.grants.filter(
          (item) => item.role_id === sourceRole.id
        )) {
          const allowedScopes =
            data.delegationScopes[grant.permission_key] ?? []

          const scope = allowedScopes.includes(grant.scope_type)
            ? grant.scope_type
            : allowedScopes[0]

          if (scope) grants.set(grant.permission_key, scope)
        }
      }
    } else {
      for (const permissionKey of template.permissionKeys ?? []) {
        const scope = pickDelegableScope(
          permissionKey,
          template.preferredScope ?? [
            'organization_tree',
            'organization',
            'governorate',
            'sector',
            'national',
            'assigned',
            'self',
          ]
        )

        if (scope) grants.set(permissionKey, scope)
      }
    }

    setSelectedTemplateId(template.id)
    setDraft((current) => ({
      ...current,
      nameAr: template.label,
      descriptionAr: template.description,
      grants,
    }))
    setError(null)
  }

  async function saveRole() {
    if (!draft.nameAr.trim()) {
      setError('اسم نوع العمل مطلوب')
      return
    }

    if (draft.grants.size === 0) {
      setError('اختر صلاحية واحدة على الأقل')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const roleCode =
        draft.roleId && draft.code
          ? draft.code
          : `custom_${Date.now().toString(36)}`

      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: draft.roleId,
          code: roleCode,
          name_ar: draft.nameAr,
          description_ar: draft.descriptionAr,
          owner_organization_id: draft.ownerOrganizationId,
          grants: Array.from(draft.grants.entries()).map(
            ([permissionKey, scopeType]) => ({
              permission_key: permissionKey,
              scope_type: scopeType,
            })
          ),
        }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر حفظ نوع العمل')
      }

      cancelEdit()
      await load()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'تعذر حفظ نوع العمل'
      )
    } finally {
      setSaving(false)
    }
  }

  async function disableRole(role: Role) {
    if (
      role.is_system ||
      !window.confirm(`هل تريد إيقاف نوع العمل "${role.name_ar}"؟`)
    ) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/roles?role_id=${encodeURIComponent(role.id)}`,
        { method: 'DELETE', credentials: 'same-origin' }
      )
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر إيقاف نوع العمل')
      }

      await load()
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : 'تعذر إيقاف نوع العمل'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-52 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        جارٍ تحميل أنواع العمل...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error || 'تعذر تحميل أنواع العمل.'}
      </div>
    )
  }

  const activeRoles = data.roles.filter((role) => role.is_active)

  const selectedPageLabels = Array.from(
    new Set(
      Array.from(draft.grants.keys())
        .map((permissionKey) => permissionByKey.get(permissionKey)?.module)
        .filter((module): module is string => Boolean(module))
        .map((module) => MODULE_LABELS[module] || 'صفحة إضافية')
    )
  )

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {editing && (
        <section className="rounded-xl border border-teal-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-[11px] font-bold text-teal-700">
                {draft.roleId ? 'تعديل نوع العمل' : 'نوع عمل جديد'}
              </p>
              <h2 className="mt-0.5 text-base font-extrabold text-slate-900">
                {draft.roleId ? draft.nameAr || 'تعديل النوع' : 'إضافة نوع عمل'}
              </h2>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              aria-label="إغلاق المحرر"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              {!draft.roleId && (
                <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="mb-2">
                    <p className="text-xs font-bold text-slate-700">
                      ابدأ من نوع عمل معروف
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                      اختر قالبًا لملء الصفحات والصلاحيات المقترحة تلقائيًا، ثم عدّل ما تحتاجه.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {ROLE_TEMPLATE_CATALOG.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyRoleTemplate(template)}
                        className={`rounded-lg border px-3 py-2.5 text-right transition ${
                          selectedTemplateId === template.id
                            ? 'border-teal-300 bg-teal-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-xs font-bold text-slate-800">
                          {template.label}
                        </span>
                        <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                          {template.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {selectedPageLabels.length > 0 && (
                <section className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
                  <p className="mb-2 text-[11px] font-bold text-teal-800">
                    الصفحات المقترحة لهذا النوع
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPageLabels.map((pageLabel) => (
                      <span
                        key={pageLabel}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-teal-800 ring-1 ring-teal-100"
                      >
                        {pageLabel}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-600">
                  اسم نوع العمل
                </span>
                <input
                  value={draft.nameAr}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nameAr: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
                  placeholder="مثال: مسؤول مركز معلومات"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-600">
                  وصف مختصر
                </span>
                <textarea
                  value={draft.descriptionAr}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      descriptionAr: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  placeholder="ما الذي يفعله صاحب هذا النوع داخل المنظومة؟"
                />
              </label>

              <CascadingOrganizationSelect
                organizations={data.organizations}
                value={draft.ownerOrganizationId}
                onChange={(ownerOrganizationId) =>
                  setDraft((current) => ({
                    ...current,
                    ownerOrganizationId,
                  }))
                }
                label="الجهة المالكة"
                allowEmpty={data.capabilities.canCreateGlobalRoles}
                emptyLabel="نوع عمل عام على مستوى المنظومة"
              />
            </div>

            <details className="rounded-xl border border-slate-200" open>
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">
                الصلاحيات الداخلية
              </summary>
              <div className="max-h-[430px] space-y-4 overflow-y-auto border-t border-slate-100 p-4">
                {permissionGroups.map(([module, permissions]) => (
                  <section key={module}>
                    <h3 className="mb-2 text-[11px] font-extrabold text-slate-500">
                      {MODULE_LABELS[module] || 'مجموعة صلاحيات'}
                    </h3>

                    <div className="space-y-1.5">
                      {permissions.map((permission) => {
                        const scopes = data.delegationScopes[permission.key] ?? []
                        const selectedScope = draft.grants.get(permission.key)
                        const checked = Boolean(selectedScope)
                        const delegable = scopes.length > 0

                        return (
                          <div
                            key={permission.key}
                            className={`rounded-lg border px-3 py-2 ${
                              delegable
                                ? 'border-slate-200'
                                : 'border-slate-100 bg-slate-50 opacity-45'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!delegable}
                                onChange={() => togglePermission(permission.key)}
                                className="h-4 w-4 accent-teal-700"
                              />
                              <span className="flex-1 text-xs font-semibold text-slate-700">
                                {permission.display_name_ar}
                              </span>
                              {checked && (
                                <select
                                  value={selectedScope}
                                  onChange={(event) =>
                                    updateScope(permission.key, event.target.value)
                                  }
                                  className="h-8 max-w-[150px] rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600"
                                >
                                  {scopes.map((scope) => (
                                    <option key={scope} value={scope}>
                                      {SCOPE_LABELS[scope] || scope}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </details>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
            <button
              type="button"
              onClick={cancelEdit}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveRole()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ
            </button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              أنواع العمل
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              افتح أي نوع لرؤية الصلاحيات الداخلية المرتبطة به.
            </p>
          </div>

          {data.capabilities.canManageRoles && !editing && (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 text-xs font-bold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              إضافة نوع عمل
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {activeRoles.map((role) => {
            const roleGrants = data.grants.filter(
              (grant) => grant.role_id === role.id
            )
            const expanded = expandedRoleId === role.id

            return (
              <article key={role.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedRoleId(expanded ? null : role.id)
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                    aria-label={expanded ? 'طي التفاصيل' : 'عرض التفاصيل'}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        expanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <ShieldCheck className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {role.name_ar}
                      </h3>
                      {role.is_system && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                          أساسي
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {role.description_ar || 'نوع عمل معتمد داخل المنظومة.'}
                    </p>
                  </div>

                  {!role.is_system && data.capabilities.canManageRoles && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(role)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                        aria-label="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void disableRole(role)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                        aria-label="إيقاف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                    {roleGrants.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        لا توجد صلاحيات مرتبطة.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {roleGrants.map((grant) => {
                          const permission = permissionByKey.get(
                            grant.permission_key
                          )

                          return (
                            <span
                              key={grant.permission_key}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-600"
                            >
                              <strong className="font-bold text-slate-700">
                                {permission?.display_name_ar || 'صلاحية داخلية'}
                              </strong>
                              <span className="text-slate-300">•</span>
                              <span>
                                {SCOPE_LABELS[grant.scope_type] || 'نطاق محدد'}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
