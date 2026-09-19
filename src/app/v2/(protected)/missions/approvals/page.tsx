import Link from 'next/link'
import { ArrowRight, ClipboardCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { MissionApprovalPanel } from '@/features/missions/components/MissionApprovalPanel'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2MissionApprovalsPage() {
  await requireV2PagePermission('missions.approve')

  return (
    <V2PageContainer>
      <PageHeader
        title="اعتماد تكليفات المأموريات"
        description="مراجعة دفعات التكليف المعدة من السكرتارية أو الجهات التشغيلية واعتمادها أو إعادتها للمراجعة بسبب موثق."
        breadcrumbs={[
          { label: 'المأموريات الميدانية', href: '/v2/missions' },
          { label: 'اعتماد التكليفات' },
        ]}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
            <ClipboardCheck className="h-3 w-3" />
            اعتماد تشغيلي
          </span>
        }
        actions={
          <Link
            href="/v2/missions"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            العودة للمأموريات
          </Link>
        }
      />

      <MissionApprovalPanel />
    </V2PageContainer>
  )
}
