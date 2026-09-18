import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2UsersPage() {
  await requireV2PagePermission('users.view')
  return (
    <V2Placeholder
      title="المستخدمون والفرق"
      moduleId="users"
      description="إدارة حسابات القيادات والمشرفين والمفتشين الميدانيين وتوزيع الأدوار وفرق العمل."
    />
  )
}
