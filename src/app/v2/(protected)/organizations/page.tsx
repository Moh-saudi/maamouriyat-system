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
        description="دليل الجهات وتبعيتها داخل وزارة الصحة والسكان."
      />

      <OrganizationManagementPanel
        canCreate={hasV2Permission(access, 'organizations.create')}
        canEdit={hasV2Permission(access, 'organizations.edit')}
        canDelete={hasV2Permission(access, 'organizations.delete')}
        canManageCapabilities={hasV2Permission(
          access,
          'organizations.manage_capabilities'
        )}
        canViewCorrectionSpecialties={hasV2Permission(
          access,
          'organizations.view_correction_specialties'
        )}
        canManageCorrectionSpecialties={hasV2Permission(
          access,
          'organizations.manage_correction_specialties'
        )}
      />
    </V2PageContainer>
  )
}
