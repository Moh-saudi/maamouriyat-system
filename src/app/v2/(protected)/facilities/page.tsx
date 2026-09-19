import Link from 'next/link'
import { FolderKanban } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { FacilitiesExplorer } from '@/features/facilities/components/FacilitiesExplorer'
import type {
  V2FacilityDirectoryData,
  V2FacilityManagementUi,
} from '@/features/facilities/types'
import { hasV2Permission } from '@/server/authorization'
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
        actions={
          hasV2Permission(access, 'facility_programs.manage') ? (
            <Link
              href="/v2/facilities/programs"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-bold text-indigo-800 hover:bg-indigo-100"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              برامج ومشروعات المنشآت
            </Link>
          ) : undefined
        }
      />

      <FacilitiesExplorer
        data={data}
        management={managementUi}
      />
    </V2PageContainer>
  )
}
