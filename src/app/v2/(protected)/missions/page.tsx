import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2MissionsPage() {
  await requireV2PagePermission('missions.view')
  return (
    <V2Placeholder
      title="المأموريات الميدانية"
      moduleId="missions"
      description="إدارة وجدولة وتنفيذ ومتابعة زيارات المرور الميداني والتفتيش الدوري والنوعي على المنشآت الصحية."
    />
  )
}
