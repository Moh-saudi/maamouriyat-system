'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import {
  OrganizationTreeSelect,
  type OrganizationTreeOption,
} from '@/components/ui/OrganizationTreeSelect'

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
  organizations: OrganizationTreeOption[]
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
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const roleCode =
        draft.roleId && draft.code
          ? draft.code
          : `custom_${Date.now().toString(36)}`

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

  const grantCountByRole = useMemo(() => {
    const counts = new Map<string, number>()
    for (const grant of data?.grants ?? []) {
      counts.set(grant.role_id, (counts.get(grant.role_id) ?? 0) + 1)
    }
    return counts
  }, [data?.grants])

  function openNewRole() {
    setDraft(emptyDraft())
    setError(null)
    setEditorOpen(true)
  }

  function openEditRole(role: Role) {
    if (role.is_system || !data) return
    setDraft(createDraft(role, data.grants))
    setError(null)
    setEditorOpen(true)
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

  async function saveRole() {
    if (!draft.nameAr.trim()) {
      setError('اسم نوع العمل مطلوب')
      return
    }

    if (draft.grants.size === 0) {
      setError('اختر صلاحية واحدة على الأقل من الإعدادات المتقدمة')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const grants = Array.from(draft.grants.entries()).map(
        ([permissionKey, scopeType]) => ({
          permission_key: permissionKey,
          scope_type: scopeType,
        })
      )

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
          grants,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'تعذر حفظ نوع العمل')
      }

      setEditorOpen(false)
      setDraft(emptyDraft())
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
      <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل أنواع العمل...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        {error || 'تعذر تحميل أنواع العمل.'}
      </div>
    )
  }

  const activeRoles = data.roles.filter((role) => role.is_active)

  return (
    <div className="space-y-5">
      {error && !editorOpen && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              أنواع العمل داخل المنظومة
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              مثل مفتش، مدير جهة، مسؤول مركز معلومات أو مسؤول اعتماد.
            </p>
          </div>

          {data.capabilities.canManageRoles && (
            <button
              type="button"
              onClick={openNewRole}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              إضافة نوع عمل
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {activeRoles.map((role) => (
            <article
              key={role.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">{role.name_ar}</h3>
                    {role.is_system && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        أساسي
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {role.description_ar || 'نوع عمل معتمد داخل المنظومة.'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {(grantCountByRole.get(role.id) ?? 0).toLocaleString('ar-EG')}{' '}
                    صلاحية مرتبطة
                  </p>
                </div>
              </div>

              {!role.is_system && data.capabilities.canManageRoles && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openEditRole(role)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => void disableRole(role)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    إيقاف
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {editorOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-editor-title"
        >
          <div className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold text-teal-700">نوع العمل</p>
                <h2
                  id="role-editor-title"
                  className="mt-1 text-lg font-extrabold text-slate-900"
                >
                  {draft.roleId ? 'تعديل نوع العمل' : 'إضافة نوع عمل'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-145px)] space-y-4 overflow-y-auto p-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
                  الاسم الظاهر للمستخدم
                </span>
                <input
                  value={draft.nameAr}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nameAr: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  placeholder="مثال: مسؤول مركز معلومات"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
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
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  placeholder="ما الذي يفعله هذا المستخدم داخل المنظومة؟"
                />
              </label>

              <OrganizationTreeSelect
                organizations={data.organizations}
                value={draft.ownerOrganizationId}
                onChange={(ownerOrganizationId) =>
                  setDraft((current) => ({
                    ...current,
                    ownerOrganizationId,
                  }))
                }
                label="الجهة المالكة"
                placeholder="اختر الجهة من الشجرة التنظيمية"
                allowGlobal={data.capabilities.canCreateGlobalRoles}
                globalLabel="نوع عمل عام على مستوى المنظومة"
                required={!data.capabilities.canCreateGlobalRoles}
              />

              <details className="rounded-xl border border-slate-200">
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-700">
                  إعدادات الصلاحيات المتقدمة
                </summary>
                <div className="space-y-4 border-t border-slate-100 p-4">
                  <p className="text-xs leading-5 text-slate-500">
                    هذه التفاصيل مخصصة لمسؤول النظام فقط. المستخدم العادي لن
                    يرى أسماء الصلاحيات التقنية.
                  </p>

                  {permissionGroups.map(([module, permissions]) => (
                    <section key={module}>
                      <h3 className="mb-2 text-xs font-extrabold text-slate-700">
                        {MODULE_LABELS[module] || module}
                      </h3>

                      <div className="space-y-2">
                        {permissions.map((permission) => {
                          const scopes =
                            data.delegationScopes[permission.key] ?? []
                          const selectedScope = draft.grants.get(permission.key)
                          const checked = Boolean(selectedScope)
                          const delegable = scopes.length > 0

                          return (
                            <div
                              key={permission.key}
                              className={`rounded-lg border p-3 ${
                                delegable
                                  ? 'border-slate-200'
                                  : 'border-slate-100 bg-slate-50 opacity-50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!delegable}
                                  onChange={() =>
                                    togglePermission(permission.key)
                                  }
                                  className="mt-1 h-4 w-4 accent-teal-700"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800">
                                    {permission.display_name_ar}
                                  </p>
                                  {checked && (
                                    <select
                                      value={selectedScope}
                                      onChange={(event) =>
                                        updateScope(
                                          permission.key,
                                          event.target.value
                                        )
                                      }
                                      className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
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
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </details>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveRole()}
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
