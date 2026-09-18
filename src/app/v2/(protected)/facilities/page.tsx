import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { FacilitiesExplorer } from '@/features/facilities/components/FacilitiesExplorer'
import { requireV2PagePermission } from '@/server/authorization/page-guard'
import { getFacilityManagementCapabilities } from '@/server/facilities/management-access'
import { loadV2FacilityDirectory } from '@/server/services/facilities/load-directory'

export default async function V2FacilitiesPage() {
  const { user, access } = await requireV2PagePermission('facilities.view')

  const management = await getFacilityManagementCapabilities({
    user,
    access,
  })

  const data = await loadV2FacilityDirectory({
    includeAuditSummary: management.canAudit,
  })

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="المنشآت الصحية"
        description="السجل الوزاري المشترك للمنشآت الصحية؛ البحث والخريطة يعملان على نفس البيانات دون تقييد المنشآت بقطاع المستخدم."
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">
              سجل وزاري مشترك
            </span>
            {management.isInformationCenter && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                مركز معلومات
              </span>
            )}
          </div>
        }
      />

      <FacilitiesExplorer
        data={data}
        management={{
          isInformationCenter: management.isInformationCenter,
          canCreate: management.canCreate,
          canEdit: management.canEdit,
          canDeactivate: management.canDeactivate,
          canAudit: management.canAudit,
          anchors: management.anchors,
        }}
      />
    </V2PageContainer>
  )
}
