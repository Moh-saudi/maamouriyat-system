import Link from 'next/link'
import { ArrowRight, FolderKanban } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { FacilityProgramsManager } from '@/features/facilities/components/FacilityProgramsManager'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2FacilityProgramsPage() {
  await requireV2PagePermission('facility_programs.manage')

  return (
    <V2PageContainer fluid>
      <PageHeader
        title="برامج ومشروعات المنشآت"
        description="تعريف مجموعات المنشآت المرتبطة بمبادرة أو مشروع مثل حياة كريمة، لاستخدامها لاحقًا في التكليفات والتقارير."
        breadcrumbs={[
          { label: 'المنشآت الصحية', href: '/v2/facilities' },
          { label: 'البرامج والمشروعات' },
        ]}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-800">
            <FolderKanban className="h-3 w-3" />
            مجموعات تشغيلية
          </span>
        }
        actions={
          <Link
            href="/v2/facilities"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            العودة للمنشآت
          </Link>
        }
      />

      <FacilityProgramsManager />
    </V2PageContainer>
  )
}
