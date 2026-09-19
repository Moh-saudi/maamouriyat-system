import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { FacilitiesExplorer } from '@/features/facilities/components/FacilitiesExplorer'
import type {
  V2FacilityDirectoryData,
  V2FacilityManagementUi,
} from '@/features/facilities/types'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import { getFacilityManagementCapabilities } from '@/server/facilities/management-access'
import { loadV2FacilityDirectory } from '@/server/services/facilities/load-directory'


function filterInformationCenterDirectory(input: {
  data: V2FacilityDirectoryData
  management: V2FacilityManagementUi
}): V2FacilityDirectoryData {
  const { data, management } = input

  if (!management.isInformationCenter) return data

  const matchesFacility = (item: V2FacilityDirectoryData['facilities'][number]) =>
    management.anchors.some((anchor) => {
      if (anchor.organizationTypeCode === 'ministry') return true

      if (anchor.organizationTypeCode === 'health_directorate') {
        return Boolean(
          anchor.governorate && item.governorate === anchor.governorate
        )
      }

      return item.organizationId === anchor.organizationId
    })

  const matchesHealthAdministration = (
    item: V2FacilityDirectoryData['healthAdministrations'][number]
  ) =>
    management.anchors.some((anchor) => {
      if (anchor.organizationTypeCode === 'ministry') return true

      if (anchor.organizationTypeCode === 'health_directorate') {
        return Boolean(
          anchor.governorate && item.governorate === anchor.governorate
        )
      }

      return item.id === anchor.organizationId
    })

  const facilities = data.facilities.filter(matchesFacility)
  const healthAdministrations = data.healthAdministrations.filter(
    matchesHealthAdministration
  )

  return {
    facilities,
    healthAdministrations,
    facilityTypes: [
      ...new Set(facilities.map((item) => item.facilityTypeLabel)),
    ].sort((a, b) => a.localeCompare(b, 'ar')),
    ministryTotal: facilities.length,
    activeTotal: facilities.filter((item) => item.isActive).length,
    governorateCount: new Set(
      facilities.map((item) => item.governorate).filter(Boolean)
    ).size,
  }
}

export default async function V2FacilitiesPage() {
  const { user, access } = await requireV2PagePermission('facilities.view')

  const management = await getFacilityManagementCapabilities({
    user,
    access,
  })

  const fullDirectory = await loadV2FacilityDirectory({
    includeAuditSummary: management.canAudit,
  })

  const managementUi: V2FacilityManagementUi = {
    isInformationCenter: management.isInformationCenter,
    canCreate: management.canCreate,
    canEdit: management.canEdit,
    canDeactivate: management.canDeactivate,
    canAudit: management.canAudit,
    anchors: management.anchors,
  }

  const data = filterInformationCenterDirectory({
    data: fullDirectory,
    management: managementUi,
  })

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="المنشآت الصحية"
        description="استعراض بيانات المنشآت الصحية ومواقعها وحالتها وسجل المرور عليها."
      />

      <FacilitiesExplorer
        data={data}
        management={managementUi}
      />
    </V2PageContainer>
  )
}
