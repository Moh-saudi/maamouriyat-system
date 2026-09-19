import { Target } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { TargetsWorkspacePanel } from '@/features/targets/components/TargetsWorkspacePanel'
import { hasV2Permission } from '@/server/authorization'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2TargetsPage() {
  const { access } = await requireV2PagePermission('targets.view')
  const canManage = hasV2Permission(access, 'targets.create')

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="المستهدفات والخطط"
        description="متابعة المستهدفات المسندة لمستخدمين بعينهم أو لنطاقات مكانية محددة، ومقارنة المطلوب بما تم تنفيذه فعليًا."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800">
            <Target className="h-3 w-3" />
            مستخدم أو مكان
          </span>
        }
      />

      <TargetsWorkspacePanel canManage={canManage} />
    </V2PageContainer>
  )
}
