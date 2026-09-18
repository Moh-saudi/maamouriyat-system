'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Plus, X } from 'lucide-react'
import {
  CascadingOrganizationSelect,
  type CascadingOrganizationOption,
} from '@/components/ui/CascadingOrganizationSelect'

type Organization = CascadingOrganizationOption & {
  is_active?: boolean | null
}

type Role = {
  id: string
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
  const [open, setOpen] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
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
    () => organizations.filter((organization) => organization.is_active !== false),
    [organizations]
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
          loadError instanceof Error ? loadError.message : 'تعذر تحميل الجهات'
        )
      })
      .finally(() => setLoadingOrganizations(false))
  }, [open, organizations.length])

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

  async function createUser() {
    if (!fullName.trim() || !email.trim() || !organizationId) {
      setError('الاسم والبريد والجهة بيانات مطلوبة')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
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

      setCreatedUserId(userId)

      if (canAssignRole) {
        const roleResponse = await fetch(
          `/api/admin/user-roles?user_id=${encodeURIComponent(userId)}`,
          { cache: 'no-store', credentials: 'same-origin' }
        )
        const rolePayload = (await roleResponse.json()) as RoleAssignmentResponse

        if (!roleResponse.ok) {
          throw new Error(
            rolePayload.error ||
              'تم إنشاء الحساب لكن تعذر تحميل أنواع العمل'
          )
        }

        setRoles(rolePayload.roles)
        setSelectedRoleId(rolePayload.roles[0]?.id ?? '')
      }
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

  async function assignRole() {
    if (!createdUserId || !selectedRoleId) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/user-roles', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: createdUserId,
          role_id: selectedRoleId,
          valid_until: null,
        }),
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحديد نوع العمل')
      }

      window.location.reload()
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : 'تعذر تحديد نوع العمل'
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
                  {createdUserId ? 'حدد نوع العمل' : 'بيانات الموظف'}
                </h2>
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
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {!createdUserId ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">
                      الاسم الكامل
                    </span>
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
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
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-left text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">
                      المسمى الوظيفي
                    </span>
                    <input
                      value={jobTitle}
                      onChange={(event) => setJobTitle(event.target.value)}
                      placeholder="مثال: مفتش، مسؤول مركز معلومات..."
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">
                      الهاتف
                    </span>
                    <input
                      dir="ltr"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-left text-sm outline-none focus:border-teal-500"
                    />
                  </label>

                  {loadingOrganizations ? (
                    <div className="flex h-20 items-center justify-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جارٍ تحميل الجهات...
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
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900">
                        تم إنشاء الحساب
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-700">
                        سيُطلب من المستخدم تغيير كلمة المرور المؤقتة عند أول
                        تسجيل دخول.
                      </p>
                    </div>
                  </div>

                  {canAssignRole && roles.length > 0 ? (
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-slate-600">
                        نوع العمل داخل المنظومة
                      </span>
                      <select
                        value={selectedRoleId}
                        onChange={(event) => setSelectedRoleId(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name_ar}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="text-sm text-slate-500">
                      تم إنشاء الحساب. يمكن تحديد نوع العمل لاحقًا بواسطة مسؤول
                      الصلاحيات.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
              <button
                type="button"
                onClick={resetAndClose}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
              >
                إلغاء
              </button>

              {!createdUserId ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void createUser()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  إنشاء الحساب
                </button>
              ) : canAssignRole && roles.length > 0 ? (
                <button
                  type="button"
                  disabled={submitting || !selectedRoleId}
                  onClick={() => void assignRole()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  حفظ نوع العمل
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="h-10 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white"
                >
                  تم
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
