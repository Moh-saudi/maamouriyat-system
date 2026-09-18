import Link from 'next/link'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  Stethoscope,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import {
  listV2Facilities,
  type V2FacilityStatusFilter,
} from '@/server/services/facilities/list-facilities'

type SearchParams = Promise<{
  page?: string
  q?: string
  governorate?: string
  healthAdmin?: string
  type?: string
  status?: string
}>

type FacilityFilters = {
  search: string
  governorate: string
  healthAdmin: string
  facilityTypeLabel: string
  status: V2FacilityStatusFilter
}

function buildPageHref(page: number, filters: FacilityFilters): string {
  const params = new URLSearchParams()

  if (page > 1) params.set('page', String(page))
  if (filters.search) params.set('q', filters.search)
  if (filters.governorate) params.set('governorate', filters.governorate)
  if (filters.healthAdmin) params.set('healthAdmin', filters.healthAdmin)
  if (filters.facilityTypeLabel) params.set('type', filters.facilityTypeLabel)
  if (filters.status !== 'active') params.set('status', filters.status)

  const query = params.toString()
  return query ? `/v2/facilities?${query}` : '/v2/facilities'
}

function FacilityStatus({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
      نشطة
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
      موقوفة
    </span>
  )
}

function CompactMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex min-w-[170px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        {icon}
      </div>
      <div>
        <p className="text-xl font-black leading-none text-slate-900">
          {value.toLocaleString('en-US')}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default async function V2FacilitiesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireV2PagePermission('facilities.view')

  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const search = (params.q || '').trim().slice(0, 100)
  const governorate = (params.governorate || '').trim().slice(0, 120)
  const healthAdmin = (params.healthAdmin || '').trim().slice(0, 120)
  const facilityTypeLabel = (params.type || '').trim().slice(0, 120)
  const status: V2FacilityStatusFilter =
    params.status === 'inactive' || params.status === 'all'
      ? params.status
      : 'active'

  const filters: FacilityFilters = {
    search,
    governorate,
    healthAdmin,
    facilityTypeLabel,
    status,
  }

  const result = await listV2Facilities({
    page,
    pageSize: 30,
    search,
    governorate,
    healthAdmin,
    facilityTypeLabel,
    status,
  })

  const hasFilters =
    Boolean(search) ||
    Boolean(governorate) ||
    Boolean(healthAdmin) ||
    Boolean(facilityTypeLabel) ||
    status !== 'active'

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="المنشآت الصحية"
        description="السجل الوزاري المشترك للوحدات والمراكز والمنشآت الصحية، والمتاح لأعمال المرور والمأموريات حسب صلاحية المستخدم."
        badge={
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">
            سجل وزاري مشترك
          </span>
        }
      />

      <section className="mb-4 flex flex-wrap gap-2.5">
        <CompactMetric
          icon={<Building2 className="h-4 w-4" />}
          value={result.ministryTotal}
          label="إجمالي السجل"
        />
        <CompactMetric
          icon={<Stethoscope className="h-4 w-4" />}
          value={result.activeTotal}
          label="منشأة نشطة"
        />
        <CompactMetric
          icon={<MapPin className="h-4 w-4" />}
          value={result.governorateCount}
          label="محافظة"
        />
        {hasFilters && (
          <CompactMetric
            icon={<Search className="h-4 w-4" />}
            value={result.total}
            label="نتيجة مطابقة"
          />
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-3">
          <form
            action="/v2/facilities"
            method="get"
            className="grid gap-2 lg:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(150px,1fr))_auto]"
          >
            <label className="relative">
              <span className="sr-only">البحث عن منشأة</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={search}
                placeholder="اسم المنشأة أو المدينة أو الإدارة الصحية..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-xs outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <select
              name="governorate"
              defaultValue={governorate}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-500"
              aria-label="المحافظة"
            >
              <option value="">كل المحافظات</option>
              {result.filters.governorates.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              name="healthAdmin"
              defaultValue={healthAdmin}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-500"
              aria-label="الإدارة الصحية"
            >
              <option value="">كل الإدارات الصحية</option>
              {result.filters.healthAdmins.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              name="type"
              defaultValue={facilityTypeLabel}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-500"
              aria-label="نوع المنشأة"
            >
              <option value="">كل أنواع المنشآت</option>
              {result.filters.facilityTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-teal-500"
              aria-label="حالة المنشأة"
            >
              <option value="active">النشطة فقط</option>
              <option value="inactive">الموقوفة فقط</option>
              <option value="all">كل الحالات</option>
            </select>

            <div className="flex gap-2">
              <button
                type="submit"
                className="h-9 rounded-lg bg-teal-700 px-4 text-xs font-bold text-white hover:bg-teal-800"
              >
                تطبيق
              </button>
              {hasFilters && (
                <Link
                  href="/v2/facilities"
                  className="flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  مسح
                </Link>
              )}
            </div>
          </form>
        </div>

        {result.items.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
            <Building2 className="mb-3 h-9 w-9 text-slate-300" />
            <h2 className="text-sm font-bold text-slate-800">
              لا توجد منشآت مطابقة
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              جرّب تغيير البحث أو أحد الفلاتر الحالية.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] border-collapse text-right">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500">
                    <th className="px-4 py-2.5">المنشأة</th>
                    <th className="px-4 py-2.5">النوع</th>
                    <th className="px-4 py-2.5">المحافظة</th>
                    <th className="px-4 py-2.5">الإدارة الصحية</th>
                    <th className="px-4 py-2.5">المنطقة</th>
                    <th className="px-4 py-2.5">الحالة</th>
                    <th className="px-4 py-2.5">الموقع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((item) => {
                    const hasLocation =
                      item.latitude !== null &&
                      item.longitude !== null &&
                      Number.isFinite(item.latitude) &&
                      Number.isFinite(item.longitude)

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="max-w-[320px] text-xs font-bold text-slate-900">
                            {item.name}
                          </p>
                          {item.villageCity && (
                            <p className="mt-1 text-[10px] text-slate-400">
                              {item.villageCity}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                            {item.facilityTypeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.governorate}
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[240px] text-xs text-slate-600">
                            {item.healthAdmin}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {item.urbanRural || item.villageCity || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <FacilityStatus active={item.isActive} />
                        </td>
                        <td className="px-4 py-3">
                          {hasLocation ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              فتح الموقع
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-300">
                              غير مسجل
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {result.items.map((item) => {
                const hasLocation =
                  item.latitude !== null &&
                  item.longitude !== null &&
                  Number.isFinite(item.latitude) &&
                  Number.isFinite(item.longitude)

                return (
                  <article key={item.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-slate-900">
                          {item.name}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.facilityTypeLabel}
                        </p>
                      </div>
                      <FacilityStatus active={item.isActive} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                      <div>
                        <span className="block text-[10px] text-slate-400">
                          المحافظة
                        </span>
                        <strong className="font-semibold text-slate-700">
                          {item.governorate}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">
                          الإدارة الصحية
                        </span>
                        <strong className="font-semibold text-slate-700">
                          {item.healthAdmin}
                        </strong>
                      </div>
                    </div>

                    {hasLocation && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 text-xs font-bold text-teal-800"
                      >
                        <MapPin className="h-4 w-4" />
                        فتح الموقع
                      </a>
                    )}
                  </article>
                )
              })}
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            صفحة {result.page.toLocaleString('en-US')} من{' '}
            {Math.max(1, result.totalPages).toLocaleString('en-US')} —{' '}
            {result.total.toLocaleString('en-US')} منشأة
          </p>

          <div className="flex items-center gap-2">
            {result.page > 1 && (
              <Link
                href={buildPageHref(result.page - 1, filters)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Link>
            )}

            {result.page < result.totalPages && (
              <Link
                href={buildPageHref(result.page + 1, filters)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>
    </V2PageContainer>
  )
}
