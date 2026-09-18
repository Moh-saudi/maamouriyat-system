import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2ViolationsPage() {
  await requireV2PagePermission('violations.view')
  return (
    <V2Placeholder
      title="سجل المخالفات"
      moduleId="violations"
      description="رصد وتصعيد ومتابعة معالجة المخالفات الطبية والإدارية المرصودة أثناء المأموريات الميدانية."
    />
  )
}
