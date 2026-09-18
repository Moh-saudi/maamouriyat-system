import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { OrganizationManagementPanel } from '@/features/organizations/components/OrganizationManagementPanel'
import { hasV2Permission } from '@/server/authorization'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2OrganizationsPage() {
  const { access } = await requireV2PagePermission('organizations.view')

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="الهيكل التنظيمي"
        description="إدارة الجهات والوحدات وتبعيتها داخل الشجرة التنظيمية الرسمية، مع فصل قدرات الجهة عن صلاحيات المستخدم."
        breadcrumbs={[
          { label: 'المنظومة', href: '/v2/dashboard' },
          { label: 'الهيكل التنظيمي' },
        ]}
        badge={
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">
            شجرة تنظيمية موثوقة
          </span>
        }
      />

      <OrganizationManagementPanel
        canCreate={hasV2Permission(access, 'organizations.create')}
        canEdit={hasV2Permission(access, 'organizations.edit')}
        canManageCapabilities={hasV2Permission(
          access,
          'organizations.manage_capabilities'
        )}
      />
    </V2PageContainer>
  )
}
