import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import { V2_TERMINOLOGY } from '@/config/terminology'

export default async function V2ViolationsPage() {
  await requireV2PagePermission('violations.view')
  return (
    <V2Placeholder
      title={V2_TERMINOLOGY.findingsModule}
      moduleId="violations"
      description="رصد الملاحظات أثناء المرور، توجيهها للجهة المختصة، متابعة التصحيح، التحقق، والتصعيد عند تجاوز المهلة."
    />
  )
}
