'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, UserCog, X } from 'lucide-react'

type Role = {
  id: string
  code: string
  name_ar: string
  description_ar: string | null
  is_system: boolean
  is_active: boolean
  priority: number
}

type Assignment = {
  id: string
  role_id: string
  assignment_org_id: string | null
  is_active: boolean
  valid_from: string
  valid_until: string | null
  assigned_by: string | null
}

type RolesResponse = {
  user: {
    id: string
    full_name: string
    organization_id: string | null
    org_level: number | null
  }
  roles: Role[]
  assignments: Assignment[]
  error?: string
}

interface UserRolesManagerProps {
  userId: string
  userName: string
  disabled?: boolean
}

export function UserRolesManager({
  userId,
  userName,
  disabled = false,
}: UserRolesManagerProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<RolesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/user-roles?user_id=${encodeURIComponent(userId)}`,
        { cache: 'no-store', credentials: 'same-origin' }
      )
      const payload = (await response.json()) as RolesResponse

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل نوع عمل المستخدم')
      }

      setData(payload)

      const activeRoleIds = new Set(
        payload.assignments
          .filter((assignment) => assignment.is_active)
          .map((assignment) => assignment.role_id)
      )
      const firstAvailable = payload.roles.find(
        (role) => !activeRoleIds.has(role.id)
      )
      setSelectedRoleId(firstAvailable?.id ?? '')
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل نوع عمل المستخدم'
      )
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) void loadRoles()
  }, [open, loadRoles])

  async function assignRole() {
    if (!selectedRoleId) return
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/user-roles', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          role_id: selectedRoleId,
          valid_until: null,
        }),
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر حفظ نوع العمل')
      }

      await loadRoles()
    } catch (assignError) {
      setError(
        assignError instanceof Error ? assignError.message : 'تعذر حفظ نوع العمل'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function revokeRole(assignmentId: string) {
    if (!window.confirm('هل تريد إزالة نوع العمل هذا من المستخدم؟')) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/user-roles?assignment_id=${encodeURIComponent(assignmentId)}`,
        { method: 'DELETE', credentials: 'same-origin' }
      )
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر إزالة نوع العمل')
      }

      await loadRoles()
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'تعذر إزالة نوع العمل'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const activeAssignments =
    data?.assignments.filter((assignment) => assignment.is_active) ?? []
  const activeRoleIds = new Set(
    activeAssignments.map((assignment) => assignment.role_id)
  )
  const availableRoles =
    data?.roles.filter((role) => !activeRoleIds.has(role.id)) ?? []

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <UserCog className="h-4 w-4" />
        إدارة الحساب
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/35 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`user-access-${userId}`}
        >
          <div className="w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold text-teal-700">إدارة الحساب</p>
                <h2
                  id={`user-access-${userId}`}
                  className="mt-1 text-lg font-extrabold text-slate-900"
                >
                  {userName}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  حدّد نوع العمل الذي يؤديه المستخدم داخل المنظومة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  جارٍ تحميل بيانات الحساب...
                </div>
              ) : data ? (
                <>
                  <section>
                    <h3 className="mb-2 text-sm font-bold text-slate-900">
                      نوع العمل الحالي
                    </h3>

                    {activeAssignments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        لم يتم تحديد نوع عمل لهذا الحساب بعد.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeAssignments.map((assignment) => {
                          const role = data.roles.find(
                            (item) => item.id === assignment.role_id
                          )
                          return (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {role?.name_ar || 'نوع عمل غير معروف'}
                                </p>
                                {role?.description_ar && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {role.description_ar}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => void revokeRole(assignment.id)}
                                className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-40"
                              >
                                إزالة
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  {availableRoles.length > 0 && (
                    <section className="rounded-xl bg-slate-50 p-4">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-slate-600">
                          إضافة نوع عمل
                        </span>
                        <select
                          value={selectedRoleId}
                          onChange={(event) => setSelectedRoleId(event.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                        >
                          {availableRoles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name_ar}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        disabled={submitting || !selectedRoleId}
                        onClick={() => void assignRole()}
                        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        حفظ نوع العمل
                      </button>
                    </section>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
