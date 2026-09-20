import { Banknote } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { EmployeeFinancialClaimsPanel } from '@/features/finance/components/EmployeeFinancialClaimsPanel'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function EmployeeFinancialClaimsPage() {
  await requireV2PagePermission('missions.execute')

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="طلبات الاستحقاق المالي"
        description="اجمع مأمورياتك المكتملة في طلب واحد، وسجّل بيانات الإقامة والمواصلات الفعلية لإرسالها إلى الشئون المالية."
        badge={<span className="inline-flex items-center gap-1 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800"><Banknote className="h-3 w-3" />طلب مستقل عن التقرير الفني</span>}
      />
      <EmployeeFinancialClaimsPanel />
    </V2PageContainer>
  )
}
