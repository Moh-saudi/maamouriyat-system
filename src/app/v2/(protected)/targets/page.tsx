import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2TargetsPage() {
  await requireV2PagePermission('targets.view')
  return (
    <V2Placeholder
      title="المستهدفات والخطط"
      moduleId="targets"
      description="مستهدفات القيادات وخطط المرور الدورية ومتابعة نسب التحقيق الفعلية للمرور الميداني."
    />
  )
}
