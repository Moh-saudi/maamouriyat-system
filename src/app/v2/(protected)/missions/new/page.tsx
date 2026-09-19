import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { MissionAssignmentForm } from '@/features/missions/components/MissionAssignmentForm'
import { hasV2Permission } from '@/server/authorization'
import { requireAnyV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2NewMissionPage() {
  const { access } = await requireAnyV2PagePermission([
    'missions.create',
    'missions.prepare',
  ])

  const canChooseTeam =
    hasV2Permission(access, 'missions.assign') ||
    hasV2Permission(access, 'missions.propose_team')

  if (!canChooseTeam) {
    redirect('/v2/missions')
  }

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="تكليف بمأمورية جديدة"
        description="إصدار تكليف ميداني آمن حسب نطاقك: اختر المنشآت، نموذج المرور، فريق العمل والموعد ثم راجع التكليف قبل الإصدار."
        breadcrumbs={[
          { label: 'المأموريات الميدانية', href: '/v2/missions' },
          { label: 'تكليف جديد' },
        ]}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800">
            <ShieldCheck className="h-3 w-3" />
            V2
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

      <MissionAssignmentForm />
    </V2PageContainer>
  )
}
