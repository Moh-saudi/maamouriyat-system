'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  CascadingOrganizationSelect,
  type CascadingOrganizationOption,
} from '@/components/ui/CascadingOrganizationSelect'

type Organization = CascadingOrganizationOption & {
  is_active?: boolean | null
}

type Role = {
  id: string
  code?: string
  name_ar: string
  description_ar: string | null
}

type RoleAssignmentResponse = {
  roles: Role[]
  assignments: Array<{
    role_id: string
    is_active: boolean
  }>
  error?: string
}

interface CreateUserDialogProps {
  canAssignRole: boolean
}

export function CreateUserDialog({
  canAssignRole,
}: CreateUserDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const activeOrganizations = useMemo(
    () =>
      organizations.filter(
        (organization) => organization.is_active !== false
      ),
    [organizations]
  )

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  )

  useEffect(() => {
    if (!open || organizations.length > 0) return

    setLoadingOrganizations(true)
    fetch('/api/admin/organizations', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: Organization[]
          error?: string
        }

        if (!response.ok) {
          throw new Error(payload.error || 'تعذر تحميل الجهات')
        }

        setOrganizations(payload.data ?? [])
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'تعذر تحميل الجهات'
        )
      })
      .finally(() => setLoadingOrganizations(false))
  }, [open, organizations.length])

  useEffect(() => {
    if (!open || !canAssignRole || !organizationId || createdUserId) {
      if (!organizationId) {
        setRoles([])
        setSelectedRoleId('')
      }
      return
    }

    let cancelled = false
    setLoadingRoles(true)
    setRoles([])
    setSelectedRoleId('')
    setError(null)

    fetch(
      `/api/admin/user-roles?preview_organization_id=${encodeURIComponent(
        organizationId
      )}`,
      {
        cache: 'no-store',
        credentials: 'same-origin',
      }
    )
      .then(async (response) => {
        const payload = (await response.json()) as RoleAssignmentResponse

        if (!response.ok) {
          throw new Error(
            payload.error || 'تعذر تحميل أنواع العمل المتاحة'
          )
        }

        if (!cancelled) {
          setRoles(payload.roles)
          setSelectedRoleId(payload.roles[0]?.id ?? '')
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'تعذر تحميل أنواع العمل المتاحة'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRoles(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, canAssignRole, organizationId, createdUserId])

  function resetAndClose() {
    setOpen(false)
    setCreatedUserId(null)
    setRoles([])
    setSelectedRoleId('')
    setError(null)
    setFullName('')
    setEmail('')
    setJobTitle('')
    setPhone('')
    setOrganizationId(null)
  }

  async function assignSelectedRole(userId: string) {
    if (!selectedRoleId) {
      throw new Error('يجب تحديد نوع العمل قبل إنشاء الحساب')
    }

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
      throw new Error(payload.error || 'تعذر إسناد نوع العمل')
    }
  }

  async function createUser() {
    if (!fullName.trim() || !email.trim() || !organizationId) {
      setError('الاسم والبريد والجهة بيانات مطلوبة')
      return
    }

    if (canAssignRole && !selectedRoleId) {
      setError('يجب تحديد نوع العمل داخل المنظومة')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (createdUserId) {
        if (canAssignRole) {
          await assignSelectedRole(createdUserId)
        }

        router.refresh()
        resetAndClose()
        return
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          job_title: jobTitle.trim() || null,
          phone: phone.trim() || null,
          organization_id: organizationId,
        }),
      })

      const payload = (await response.json()) as {
        data?: { id?: string }
        error?: string
      }

      const userId = payload.data?.id

      if (!response.ok || !userId) {
        throw new Error(payload.error || 'تعذر إنشاء الحساب')
      }

      if (canAssignRole) {
        try {
          await assignSelectedRole(userId)
        } catch (assignError) {
          setCreatedUserId(userId)
          throw new Error(
            assignError instanceof Error
              ? `تم إنشاء الحساب، لكن تعذر إسناد نوع العمل: ${assignError.message}. يمكنك إعادة المحاولة من نفس النافذة.`
              : 'تم إنشاء الحساب، لكن تعذر إسناد نوع العمل. يمكنك إعادة المحاولة من نفس النافذة.'
          )
        }
      }

      router.refresh()
      resetAndClose()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'تعذر إنشاء الحساب'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800"
      >
        <Plus className="h-4 w-4" />
        إضافة مستخدم
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
        >
          <div className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold text-teal-700">حساب جديد</p>
                <h2
                  id="create-user-title"
                  className="mt-1 text-lg font-extrabold text-slate-900"
                >
                  بيانات الموظف ونوع العمل
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  أكمل بيانات الحساب وحدد الجهة ونوع العمل قبل الإنشاء.
                </p>
              </div>

              <button
                type="button"
                onClick={resetAndClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-145px)] overflow-y-auto p-5">
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                  {error}
                </div>
              )}

              {createdUserId && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
                  تم إنشاء الحساب بالفعل. لم يبقَ إلا إعادة محاولة ربط نوع
                  العمل المحدد؛ لن يتم إنشاء حساب آخر.
                </div>
              )}

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    الاسم الكامل
                  </span>
                  <input
                    value={fullName}
                    disabled={Boolean(createdUserId)}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    البريد الإلكتروني
                  </span>
                  <input
                    dir="ltr"
                    type="email"
                    value={email}
                    disabled={Boolean(createdUserId)}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-left text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    المسمى الوظيفي
                  </span>
                  <input
                    value={jobTitle}
                    disabled={Boolean(createdUserId)}
                    onChange={(event) => setJobTitle(event.target.value)}
                    placeholder="مثال: مفتش، مسؤول مركز معلومات..."
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">
                    الهاتف
                  </span>
                  <input
                    dir="ltr"
                    value={phone}
                    disabled={Boolean(createdUserId)}
                    onChange={(event) => setPhone(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-left text-sm outline-none focus:border-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </label>

                {loadingOrganizations ? (
                  <div className="flex h-20 items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جارٍ تحميل الجهات...
                  </div>
                ) : createdUserId ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    تم تثبيت الجهة التنظيمية للحساب بعد إنشائه.
                  </div>
                ) : (
                  <CascadingOrganizationSelect
                    organizations={activeOrganizations}
                    value={organizationId}
                    onChange={setOrganizationId}
                    label="الجهة التابع لها الموظف"
                    helperText="اختر المسار التنظيمي أولًا، ثم الجهة التابعة مستوى بعد مستوى."
                  />
                )}

                {canAssignRole && organizationId && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-slate-700">
                        نوع العمل داخل المنظومة
                      </span>

                      {loadingRoles ? (
                        <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          جارٍ تحديد أنواع العمل المتاحة لهذه الجهة...
                        </div>
                      ) : roles.length > 0 ? (
                        <>
                          <select
                            value={selectedRoleId}
                            onChange={(event) =>
                              setSelectedRoleId(event.target.value)
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name_ar}
                              </option>
                            ))}
                          </select>

                          {selectedRole?.description_ar && (
                            <p className="mt-2 text-[11px] leading-5 text-slate-500">
                              {selectedRole.description_ar}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                          لا توجد أنواع عمل يمكنك إسنادها لهذه الجهة ضمن
                          نطاقك الحالي.
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {!canAssignRole && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                    سيتم إنشاء الحساب بدون نوع عمل، ويجب على مسؤول الصلاحيات
                    إسناده لاحقًا.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
              <button
                type="button"
                disabled={submitting}
                onClick={resetAndClose}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 disabled:opacity-40"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={
                  submitting ||
                  loadingOrganizations ||
                  loadingRoles ||
                  !fullName.trim() ||
                  !email.trim() ||
                  !organizationId ||
                  (canAssignRole && !selectedRoleId)
                }
                onClick={() => void createUser()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {createdUserId
                  ? 'إعادة محاولة ربط نوع العمل'
                  : 'إنشاء الحساب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
