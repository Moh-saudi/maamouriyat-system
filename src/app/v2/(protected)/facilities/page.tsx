import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2FacilitiesPage() {
  await requireV2PagePermission('facilities.view')
  return (
    <V2Placeholder
      title="المنشآت الصحية"
      moduleId="facilities"
      description="دليل المستشفيات والمراكز ووحدات الرعاية الأولية ومكاتب الصحة ومستودعات التموين الطبي."
    />
  )
}
