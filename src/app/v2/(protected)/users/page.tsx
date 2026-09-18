import Link from 'next/link'
import { Search, Users, UserCheck, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { UserRolesManager } from '@/features/users/components/UserRolesManager'
import { hasV2Permission } from '@/server/authorization'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import { listV2Users } from '@/server/services/users/list-users'

type SearchParams = Promise<{
  page?: string
  q?: string
}>

function buildPageHref(page: number, search: string): string {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (search) params.set('q', search)
  const query = params.toString()
  return query ? `/v2/users?${query}` : '/v2/users'
}

function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      مستوى {level}
    </span>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
      نشط
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
      غير نشط
    </span>
  )
}

export default async function V2UsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, access } = await requireV2PagePermission('users.view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const search = (params.q || '').trim().slice(0, 100)

  const result = await listV2Users({
    user,
    snapshot: access,
    page,
    pageSize: 25,
    search,
  })

  const canAssignRoles = hasV2Permission(access, 'users.assign_role')
  const activeOnPage = result.items.filter((item) => item.isActive).length
  const withoutRoles = result.items.filter(
    (item) => item.roleNames.length === 0
  ).length

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="المستخدمون والفرق"
        description="إدارة حسابات العاملين والأدوار الوظيفية داخل النطاق الإداري المسموح لك فقط."
        breadcrumbs={[
          { label: 'المنظومة', href: '/v2/dashboard' },
          { label: 'المستخدمون والفرق' },
        ]}
        badge={
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">
            RBAC V2
          </span>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/60">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black tracking-tight text-slate-900">
            {result.total.toLocaleString('ar-EG')}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            إجمالي المستخدمين داخل نطاق العرض
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/60">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <UserCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black tracking-tight text-slate-900">
            {activeOnPage.toLocaleString('ar-EG')}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            حساب نشط في الصفحة الحالية
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/60">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black tracking-tight text-slate-900">
            {withoutRoles.toLocaleString('ar-EG')}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            بدون دور V2 نشط في الصفحة الحالية
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/70">
        <div className="border-b border-slate-100 bg-slate-50/60 p-4">
          <form
            action="/v2/users"
            method="get"
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <label className="relative flex-1">
              <span className="sr-only">البحث عن مستخدم</span>
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                name="q"
                defaultValue={search}
                placeholder="بحث بالاسم أو البريد أو المسمى الوظيفي..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <button
              type="submit"
              className="h-11 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white transition hover:bg-teal-800"
            >
              بحث
            </button>

            {search && (
              <Link
                href="/v2/users"
                className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                مسح البحث
              </Link>
            )}
          </form>
        </div>

        {result.items.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              لا توجد نتائج
            </h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              لا توجد حسابات تطابق البحث الحالي داخل نطاقك الإداري.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-xs font-bold text-slate-500">
                    <th className="px-5 py-3.5">المستخدم</th>
                    <th className="px-5 py-3.5">الجهة</th>
                    <th className="px-5 py-3.5">المستوى</th>
                    <th className="px-5 py-3.5">الأدوار الفعالة</th>
                    <th className="px-5 py-3.5">الحالة</th>
                    <th className="px-5 py-3.5">الإدارة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((item) => (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {item.fullName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.jobTitle || 'بدون مسمى وظيفي'}
                          {item.email ? ` • ${item.email}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="max-w-[260px] text-sm font-medium text-slate-700">
                          {item.organizationName}
                        </div>
                        {item.governorate && (
                          <div className="mt-1 text-xs text-slate-400">
                            {item.governorate}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <LevelBadge level={item.orgLevel} />
                      </td>
                      <td className="px-5 py-4">
                        {item.roleNames.length > 0 ? (
                          <div className="flex max-w-[320px] flex-wrap gap-1.5">
                            {item.roleNames.map((role) => (
                              <span
                                key={role}
                                className="rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-800"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700">
                            لم يتم إسناد دور
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <ActiveBadge active={item.isActive} />
                      </td>
                      <td className="px-5 py-4">
                        <UserRolesManager
                          userId={item.id}
                          userName={item.fullName}
                          disabled={!canAssignRoles}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {result.items.map((item) => (
                <article key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-slate-900">
                        {item.fullName}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.jobTitle || 'بدون مسمى وظيفي'}
                      </p>
                    </div>
                    <ActiveBadge active={item.isActive} />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">
                      {item.organizationName}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <LevelBadge level={item.orgLevel} />
                      {item.governorate && (
                        <span className="text-[11px] text-slate-500">
                          {item.governorate}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-bold text-slate-400">
                      الأدوار
                    </p>
                    {item.roleNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.roleNames.map((role) => (
                          <span
                            key={role}
                            className="rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-800"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700">
                        لم يتم إسناد دور
                      </span>
                    )}
                  </div>

                  <UserRolesManager
                    userId={item.id}
                    userName={item.fullName}
                    disabled={!canAssignRoles}
                  />
                </article>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-slate-500">
            صفحة {result.page.toLocaleString('ar-EG')} من{' '}
            {Math.max(1, result.totalPages).toLocaleString('ar-EG')} • عرض{' '}
            {result.items.length.toLocaleString('ar-EG')} من{' '}
            {result.total.toLocaleString('ar-EG')}
          </p>

          <div className="flex items-center gap-2">
            {result.page > 1 ? (
              <Link
                href={buildPageHref(result.page - 1, search)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-300">
                <ChevronRight className="h-4 w-4" />
                السابق
              </span>
            )}

            {result.page < result.totalPages ? (
              <Link
                href={buildPageHref(result.page + 1, search)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-300">
                التالي
                <ChevronLeft className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </section>
    </V2PageContainer>
  )
}
