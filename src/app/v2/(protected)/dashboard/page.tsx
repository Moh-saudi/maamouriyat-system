import Link from 'next/link'
import {
  Building2,
  ClipboardList,
  Network,
  Users,
  WalletCards,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { hasV2Permission } from '@/server/authorization'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2DashboardPage() {
  const { user, access } = await requireV2PagePermission('dashboard.view')

  const shortcutCandidates: Array<{
    title: string
    description: string
    href: string
    icon: LucideIcon
  } | null> = [
    hasV2Permission(access, 'missions.view')
      ? {
          title: 'المأموريات',
          description: 'متابعة المأموريات الميدانية والعمل الجاري.',
          href: '/v2/missions',
          icon: ClipboardList,
        }
      : null,
    hasV2Permission(access, 'facilities.view')
      ? {
          title: 'المنشآت الصحية',
          description: 'الوصول إلى المنشآت الواقعة داخل نطاقك.',
          href: '/v2/facilities',
          icon: Building2,
        }
      : null,
    hasV2Permission(access, 'organizations.view')
      ? {
          title: 'الهيكل التنظيمي',
          description: 'عرض الجهات وتبعيتها داخل الوزارة.',
          href: '/v2/organizations',
          icon: Network,
        }
      : null,
    hasV2Permission(access, 'users.view')
      ? {
          title: 'المستخدمون',
          description: 'إدارة الحسابات داخل نطاقك الإداري.',
          href: '/v2/users',
          icon: Users,
        }
      : null,
    hasV2Permission(access, 'finance.view')
      ? {
          title: 'الاستحقاقات المالية',
          description: 'مراجعة بدلات ومكافآت المأموريات المنفذة.',
          href: '/v2/finance',
          icon: WalletCards,
        }
      : null,
    hasV2Permission(access, 'reports.missions_view') ||
    hasV2Permission(access, 'reports.finance_view')
      ? {
          title: 'التقارير',
          description: 'ملخصات تشغيلية ومالية حسب صلاحيات حسابك.',
          href: '/v2/reports',
          icon: BarChart3,
        }
      : null,
  ]

  const shortcuts = shortcutCandidates.filter(
    (item): item is NonNullable<typeof item> => item !== null
  )

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="لوحة التحكم"
        description="وصول سريع إلى الأعمال المتاحة لك داخل المنظومة."
      />

      <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">مرحبًا،</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {user.fullName}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {user.jobTitle || 'مستخدم المنظومة'}
              {user.organizationName ? ` • ${user.organizationName}` : ''}
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            الحساب نشط
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-base font-extrabold text-slate-900">
            الوصول السريع
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            تظهر لك الأقسام المسموح لك بالعمل عليها فقط.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-teal-200 hover:shadow-sm"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 group-hover:text-teal-800">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </Link>
            )
          })}
        </div>
      </section>
    </V2PageContainer>
  )
}
