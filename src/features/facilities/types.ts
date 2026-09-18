export type V2FacilityDirectoryItem = {
  id: string
  name: string
  facilityTypeLabel: string
  organizationId: string
  governorate: string
  healthAdmin: string
  urbanRural: string | null
  villageCity: string | null
  latitude: number
  longitude: number
  isActive: boolean
  visitCount: number
  lastVisitAt: string | null
  updatedAt: string | null
  lastAuditAt: string | null
  lastAuditActorName: string | null
}

export type V2HealthAdministrationOption = {
  id: string
  name: string
  governorate: string
}

export type V2FacilityDirectoryData = {
  facilities: V2FacilityDirectoryItem[]
  healthAdministrations: V2HealthAdministrationOption[]
  facilityTypes: string[]
  ministryTotal: number
  activeTotal: number
  governorateCount: number
}

export type V2FacilityManagementUi = {
  isInformationCenter: boolean
  canCreate: boolean
  canEdit: boolean
  canDeactivate: boolean
  canAudit: boolean
  anchors: Array<{
    organizationId: string
    level: number
    governorate: string | null
  }>
}
