import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { UserRolesManager } from '@/features/users/components/UserRolesManager'
import { CreateUserDialog } from '@/features/users/components/CreateUserDialog'
import { UsersSearch } from '@/features/users/components/UsersSearch'
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

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
      نشط
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
      موقوف
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
  const canCreateUsers = hasV2Permission(access, 'users.create')
  const activeOnPage = result.items.filter((item) => item.isActive).length

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="المستخدمون"
        description="إدارة حسابات العاملين داخل نطاق الجهة المسموح لك بإدارتها."
        actions={
          canCreateUsers ? (
            <CreateUserDialog canAssignRole={canAssignRoles} />
          ) : undefined
        }
      />

      <section className="mb-4 flex flex-wrap gap-2.5">
        <div className="flex min-w-[190px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xl font-black leading-none text-slate-900">
              {result.total.toLocaleString('en-US')}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">مستخدم داخل نطاقك</p>
          </div>
        </div>

        <div className="flex min-w-[210px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <UserCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xl font-black leading-none text-slate-900">
              {activeOnPage.toLocaleString('en-US')}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">حساب نشط في الصفحة الحالية</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <UsersSearch initialSearch={search} />
        </div>

        {result.items.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
            <Users className="mb-3 h-9 w-9 text-slate-300" />
            <h2 className="text-base font-bold text-slate-900">لا توجد نتائج</h2>
            <p className="mt-1 text-sm text-slate-500">
              لا توجد حسابات تطابق البحث الحالي داخل نطاقك.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-bold text-slate-500">
                    <th className="px-4 py-2.5">المستخدم</th>
                    <th className="px-4 py-2.5">الجهة</th>
                    <th className="px-4 py-2.5">نوع العمل</th>
                    <th className="px-4 py-2.5">الحالة</th>
                    <th className="px-4 py-2.5">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-slate-900">{item.fullName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.jobTitle || 'بدون مسمى وظيفي'}
                          {item.email ? ` • ${item.email}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="max-w-[280px] text-xs font-medium text-slate-700">
                          {item.organizationName}
                        </p>
                        {item.governorate && (
                          <p className="mt-1 text-xs text-slate-400">
                            {item.governorate}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.roleNames.length > 0 ? (
                          <p className="text-xs font-semibold text-slate-700">
                            {item.roleNames.join('، ')}
                          </p>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700">
                            لم يحدد بعد
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ActiveBadge active={item.isActive} />
                      </td>
                      <td className="px-4 py-3">
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
                    <p className="text-xs font-bold text-slate-700">
                      {item.organizationName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.roleNames.length > 0
                        ? item.roleNames.join('، ')
                        : 'نوع العمل لم يحدد بعد'}
                    </p>
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

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            صفحة {result.page.toLocaleString('en-US')} من{' '}
            {Math.max(1, result.totalPages).toLocaleString('en-US')}
          </p>

          <div className="flex items-center gap-2">
            {result.page > 1 ? (
              <Link
                href={buildPageHref(result.page - 1, search)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Link>
            ) : null}

            {result.page < result.totalPages ? (
              <Link
                href={buildPageHref(result.page + 1, search)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </V2PageContainer>
  )
}
