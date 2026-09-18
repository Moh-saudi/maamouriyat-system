import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2OrganizationsPage() {
  await requireV2PagePermission('organizations.view')
  return (
    <V2Placeholder
      title="الهيكل التنظيمي"
      moduleId="organizations"
      description="إدارة قطاعات الوزارة والإدارات المركزية والعامة ومديريات الشئون الصحية والإدارات التابعة."
    />
  )
}
