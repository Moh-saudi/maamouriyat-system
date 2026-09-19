import Link from 'next/link'
import { ClipboardCheck, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { MissionWorkspacePanel } from '@/features/missions/components/MissionWorkspacePanel'
import { hasV2Permission } from '@/server/authorization'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2MissionsPage() {
  const { access } = await requireV2PagePermission('missions.view')

  const canCreate =
    (hasV2Permission(access, 'missions.create') &&
      hasV2Permission(access, 'missions.assign')) ||
    (hasV2Permission(access, 'missions.prepare') &&
      hasV2Permission(access, 'missions.propose_team'))

  const canApprove = hasV2Permission(access, 'missions.approve')

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="المأموريات الميدانية"
        description="مساحة العمل اليومية لمتابعة ما كُلّفت به، وما أصدرته، والمأموريات الواقعة داخل نطاق إشرافك."
        actions={
          canCreate || canApprove ? (
            <div className="flex flex-wrap gap-2">
              {canApprove && (
                <Link
                  href="/v2/missions/approvals"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  اعتماد التكليفات
                </Link>
              )}

              {canCreate && (
                <Link
                  href="/v2/missions/new"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 text-[11px] font-bold text-white shadow-sm hover:bg-teal-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إعداد تكليف
                </Link>
              )}
            </div>
          ) : undefined
        }
      />

      <MissionWorkspacePanel defaultMode={canCreate ? 'issued' : 'assigned'} />
    </V2PageContainer>
  )
}
