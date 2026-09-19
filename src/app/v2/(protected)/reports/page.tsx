import { BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { ReportsSummaryPanel } from '@/features/reports/components/ReportsSummaryPanel'
import { requireAnyV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2ReportsPage() {
  await requireAnyV2PagePermission([
    'reports.missions_view',
    'reports.finance_view',
  ])

  return (
    <V2PageContainer>
      <PageHeader
        title="التقارير"
        description="ملخصات تشغيلية ومالية تتغير حسب صلاحيات الحساب ونطاقه التنظيمي."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">
            <BarChart3 className="h-3 w-3" />
            حسب الصلاحيات
          </span>
        }
      />

      <ReportsSummaryPanel />
    </V2PageContainer>
  )
}
