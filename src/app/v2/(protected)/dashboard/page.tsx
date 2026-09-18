import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2DashboardPage() {
  await requireV2PagePermission('dashboard.view')
  return (
    <V2Placeholder
      title="لوحة التحكم والمؤشرات"
      moduleId="dashboard"
      description="لوحة القيادة والمؤشرات الرئيسية لمنظومة مأموريات المرور والتفتيش الميداني. سيتم ربط المؤشرات التجميعية ونسب الإنجاز في المراحل القادمة."
    />
  )
}
