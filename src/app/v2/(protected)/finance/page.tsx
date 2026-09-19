import { WalletCards } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { FinanceSettlementsPanel } from '@/features/finance/components/FinanceSettlementsPanel'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2FinancePage() {
  await requireV2PagePermission('finance.view')

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="الاستحقاقات المالية"
        description="مراجعة المأموريات المنفذة وإعداد البدلات والمكافآت، ثم الاعتماد وتسجيل الصرف حسب الصلاحيات الممنوحة."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
            <WalletCards className="h-3 w-3" />
            دورة مالية مستقلة
          </span>
        }
      />

      <FinanceSettlementsPanel />
    </V2PageContainer>
  )
}
