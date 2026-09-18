'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, X, Plus, Trash2, Loader2 } from 'lucide-react'

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
  const [validUntil, setValidUntil] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/user-roles?user_id=${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }
      )

      const payload = (await response.json()) as RolesResponse

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل الأدوار')
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
          : 'تعذر تحميل الأدوار'
      )
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!open) return
    void loadRoles()
  }, [open, loadRoles])

  async function assignRole() {
    if (!selectedRoleId) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/user-roles', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          role_id: selectedRoleId,
          valid_until: validUntil || null,
        }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر إسناد الدور')
      }

      setValidUntil('')
      await loadRoles()
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : 'تعذر إسناد الدور'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function revokeRole(assignmentId: string) {
    if (!window.confirm('هل تريد إلغاء إسناد هذا الدور للمستخدم؟')) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/user-roles?assignment_id=${encodeURIComponent(
          assignmentId
        )}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      )

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر إلغاء الدور')
      }

      await loadRoles()
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'تعذر إلغاء الدور'
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
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        إدارة الأدوار
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[1px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`roles-title-${userId}`}
        >
          <div className="max-h-[90vh] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="mb-1 text-xs font-semibold text-teal-700">
                  التحكم في الوصول
                </p>
                <h2
                  id={`roles-title-${userId}`}
                  className="text-lg font-bold text-slate-900"
                >
                  أدوار {userName}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  المستوى التنظيمي لا يغيّر الدور تلقائيًا. كل إسناد مستقل
                  ومسجل في سجل التدقيق.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-80px)] space-y-5 overflow-y-auto p-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  جارٍ تحميل الأدوار...
                </div>
              ) : data ? (
                <>
                  <section>
                    <h3 className="mb-2 text-sm font-bold text-slate-900">
                      الأدوار الحالية
                    </h3>

                    {activeAssignments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                        لا يوجد دور نشط لهذا المستخدم حتى الآن.
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
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  {role?.name_ar || 'دور غير معروف'}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {assignment.valid_until
                                    ? `صالح حتى ${new Date(
                                        assignment.valid_until
                                      ).toLocaleDateString('ar-EG')}`
                                    : 'بدون تاريخ انتهاء'}
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() =>
                                  void revokeRole(assignment.id)
                                }
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
                                aria-label="إلغاء الدور"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Plus className="h-4 w-4 text-teal-700" />
                      <h3 className="text-sm font-bold text-slate-900">
                        إسناد دور جديد
                      </h3>
                    </div>

                    {availableRoles.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        لا توجد أدوار إضافية متاحة للإسناد.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            الدور
                          </span>
                          <select
                            value={selectedRoleId}
                            onChange={(event) =>
                              setSelectedRoleId(event.target.value)
                            }
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                          >
                            {availableRoles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name_ar}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                            انتهاء اختياري
                          </span>
                          <input
                            type="date"
                            value={validUntil}
                            onChange={(event) =>
                              setValidUntil(event.target.value)
                            }
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={submitting || !selectedRoleId}
                          onClick={() => void assignRole()}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          إسناد
                        </button>
                      </div>
                    )}
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
