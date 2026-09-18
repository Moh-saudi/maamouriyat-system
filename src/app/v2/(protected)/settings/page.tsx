import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { RoleManagementPanel } from '@/features/settings/components/RoleManagementPanel'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2SettingsPage() {
  await requireV2PagePermission('settings.view')

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="الإعدادات"
        description="إعداد أنواع العمل والصلاحيات الإدارية الخاصة بالمنظومة."
      />

      <RoleManagementPanel />
    </V2PageContainer>
  )
}
