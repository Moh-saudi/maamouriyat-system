import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { RoleManagementPanel } from '@/features/settings/components/RoleManagementPanel'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2SettingsPage() {
  await requireV2PagePermission('settings.view')

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="الإعدادات والصلاحيات"
        description="إدارة الأدوار والصلاحيات الديناميكية مع فصل كامل بين المستوى التنظيمي ودور المستخدم."
        breadcrumbs={[
          { label: 'المنظومة', href: '/v2/dashboard' },
          { label: 'الإعدادات والصلاحيات' },
        ]}
        badge={
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">
            تحكم مركزي
          </span>
        }
      />

      <RoleManagementPanel />
    </V2PageContainer>
  )
}
