'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  OrganizationTreeSelect,
  type OrganizationTreeOption,
} from '@/components/ui/OrganizationTreeSelect'
import {
  ShieldCheck,
  KeyRound,
  LockKeyhole,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Settings2,
} from 'lucide-react'

const SCOPE_LABELS: Record<string, string> = {
  self: 'الذات',
  assigned: 'المكلّف به',
  organization: 'الجهة',
  organization_tree: 'الجهة وفروعها',
  governorate: 'المحافظة',
  sector: 'القطاع',
  national: 'وطني',
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

type DraftGrant = {
  permissionKey: string
  scopeType: string
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
      const response = await fetch('/api/admin/roles', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as RolesPayload

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل الأدوار والصلاحيات')
      }

      setData(payload)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل الأدوار والصلاحيات'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, Permission[]>()

    for (const permission of data?.permissions ?? []) {
      const current = groups.get(permission.module) ?? []
      current.push(permission)
      groups.set(permission.module, current)
    }

    return [...groups.entries()]
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
        const allowedScopes = data.delegationScopes[permissionKey] ?? []
        if (allowedScopes.length === 0) return current
        grants.set(
          permissionKey,
          allowedScopes.includes('organization_tree')
            ? 'organization_tree'
            : allowedScopes[0]
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
    if (!draft.code.trim() || !draft.nameAr.trim()) {
      setError('اسم الدور والكود مطلوبان')
      return
    }

    if (draft.grants.size === 0) {
      setError('يجب اختيار صلاحية واحدة على الأقل')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const grants: DraftGrant[] = [...draft.grants.entries()].map(
        ([permissionKey, scopeType]) => ({
          permissionKey,
          scopeType,
        })
      )

      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_id: draft.roleId,
          code: draft.code,
          name_ar: draft.nameAr,
          description_ar: draft.descriptionAr,
          owner_organization_id: draft.ownerOrganizationId,
          grants: grants.map((grant) => ({
            permission_key: grant.permissionKey,
            scope_type: grant.scopeType,
          })),
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'تعذر حفظ الدور')
      }

      setEditorOpen(false)
      setDraft(emptyDraft())
      await load()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'تعذر حفظ الدور'
      )
    } finally {
      setSaving(false)
    }
  }

  async function disableRole(role: Role) {
    if (
      role.is_system ||
      !window.confirm(
        `سيتم تعطيل الدور "${role.name_ar}" وإيقاف إسناداته النشطة. هل تريد المتابعة؟`
      )
    ) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/roles?role_id=${encodeURIComponent(role.id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      )

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تعطيل الدور')
      }

      await load()
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : 'تعذر تعطيل الدور'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل إعدادات الوصول...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        {error || 'تعذر تحميل إعدادات الوصول.'}
      </div>
    )
  }

  const activeRoles = data.roles.filter((role) => role.is_active)
  const customRoles = activeRoles.filter((role) => !role.is_system)
  const sensitivePermissions = data.permissions.filter(
    (permission) => permission.is_sensitive
  ).length

  return (
    <div className="space-y-5">
      {error && !editorOpen && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5" />}
          value={activeRoles.length}
          label="دور نشط"
        />
        <SummaryCard
          icon={<Settings2 className="h-5 w-5" />}
          value={customRoles.length}
          label="دور مخصص"
        />
        <SummaryCard
          icon={<KeyRound className="h-5 w-5" />}
          value={data.permissions.length}
          label="صلاحية مسجلة"
        />
        <SummaryCard
          icon={<LockKeyhole className="h-5 w-5" />}
          value={sensitivePermissions}
          label="صلاحية حساسة"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/70">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              الأدوار داخل المنظومة
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              الأدوار النظامية محمية. التعديل متاح فقط للأدوار المخصصة.
            </p>
          </div>

          {data.capabilities.canManageRoles && (
            <button
              type="button"
              onClick={openNewRole}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              إنشاء دور مخصص
            </button>
          )}
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {activeRoles.map((role) => (
            <article
              key={role.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-slate-900">
                      {role.name_ar}
                    </h3>
                    <span
                      className={
                        role.is_system
                          ? 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600'
                          : 'rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700'
                      }
                    >
                      {role.is_system ? 'نظامي' : 'مخصص'}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    {role.code}
                  </p>
                </div>

                {!role.is_system && data.capabilities.canManageRoles && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEditRole(role)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-teal-50 hover:text-teal-700"
                      aria-label="تعديل الدور"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void disableRole(role)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                      aria-label="تعطيل الدور"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <p className="min-h-10 text-xs leading-5 text-slate-500">
                {role.description_ar || 'لا يوجد وصف إضافي لهذا الدور.'}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-500">
                  الصلاحيات
                </span>
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-800">
                  {(grantCountByRole.get(role.id) ?? 0).toLocaleString('ar-EG')}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/70">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-teal-700" />
            <h2 className="text-base font-bold text-slate-900">
              سجل الصلاحيات
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            السجل المركزي المستخدم في جميع الأدوار. إدارة تعريفات الصلاحيات
            نفسها محفوظة للمدير التقني.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {permissionGroups.map(([module, permissions]) => (
            <div key={module} className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  {MODULE_LABELS[module] || module}
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  {permissions.length.toLocaleString('ar-EG')} صلاحية
                </span>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {permissions.map((permission) => (
                  <div
                    key={permission.key}
                    className="rounded-xl border border-slate-200 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {permission.display_name_ar}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">
                          {permission.key}
                        </p>
                      </div>
                      {permission.is_sensitive && (
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                          حساسة
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {editorOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 backdrop-blur-[1px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-editor-title"
        >
          <div className="max-h-[94vh] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="mb-1 text-xs font-bold text-teal-700">
                  إعداد الصلاحيات
                </p>
                <h2
                  id="role-editor-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {draft.roleId ? 'تعديل الدور المخصص' : 'إنشاء دور مخصص'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(94vh-150px)] overflow-y-auto p-5">
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    اسم الدور بالعربية
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
                    placeholder="مثال: مصحح المخالفات"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    كود الدور
                  </span>
                  <input
                    dir="ltr"
                    value={draft.code}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        code: event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, ''),
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    placeholder="violation_corrector"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    وصف الدور
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
                    placeholder="وصف مختصر لمسؤوليات الدور..."
                  />
                </label>

                <div className="sm:col-span-2">
                  <OrganizationTreeSelect
                    organizations={data.organizations}
                    value={draft.ownerOrganizationId}
                    onChange={(ownerOrganizationId) =>
                      setDraft((current) => ({
                        ...current,
                        ownerOrganizationId,
                      }))
                    }
                    label="الجهة المالكة للدور"
                    placeholder="اختر الجهة المالكة من الشجرة التنظيمية"
                    allowGlobal={data.capabilities.canCreateGlobalRoles}
                    globalLabel="دور عام بلا جهة مالكة"
                    required={!data.capabilities.canCreateGlobalRoles}
                  />
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  الصلاحيات والنطاق
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  تم اختيار {draft.grants.size.toLocaleString('ar-EG')}
                </span>
              </div>

              <div className="space-y-4">
                {permissionGroups.map(([module, permissions]) => (
                  <section
                    key={module}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <h4 className="mb-3 text-sm font-bold text-slate-800">
                      {MODULE_LABELS[module] || module}
                    </h4>

                    <div className="grid gap-2 md:grid-cols-2">
                      {permissions.map((permission) => {
                        const allowedScopes =
                          data.delegationScopes[permission.key] ?? []
                        const selectedScope = draft.grants.get(permission.key)
                        const checked = Boolean(selectedScope)
                        const delegable = allowedScopes.length > 0

                        return (
                          <div
                            key={permission.key}
                            className={
                              delegable
                                ? 'rounded-xl border border-slate-200 p-3'
                                : 'rounded-xl border border-slate-100 bg-slate-50 p-3 opacity-55'
                            }
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
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-bold text-slate-800">
                                    {permission.display_name_ar}
                                  </p>
                                  {permission.is_sensitive && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                                      حساسة
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 font-mono text-[9px] text-slate-400">
                                  {permission.key}
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
                                    className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-teal-500"
                                  >
                                    {allowedScopes.map((scope) => (
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
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
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
                حفظ الدور
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: number
  label: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/60">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        {icon}
      </div>
      <p className="text-2xl font-black tracking-tight text-slate-900">
        {value.toLocaleString('ar-EG')}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
    </div>
  )
}
