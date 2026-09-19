import Link from 'next/link'
import { FileText, ListChecks } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { ChecklistLibraryPanel } from '@/features/checklists/components/ChecklistLibraryPanel'
import { hasV2Permission } from '@/server/authorization'
import { requireAnyV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2ChecklistsPage() {
  const { access } = await requireAnyV2PagePermission([
    'checklists.library',
    'checklists.design',
    'checklists.view',
    'missions.checklist_change',
  ])

  const canManageMissionChecklists = hasV2Permission(
    access,
    'missions.checklist_change'
  )

  return (
    <V2PageContainer>
      <PageHeader
        title="استماراتي ونماذج المرور"
        description="مكتبتك الشخصية من استمارات المرور التي أنشأتها أو حفظتها من النماذج المتاحة في المنظومة."
        actions={
          canManageMissionChecklists ? (
            <Link
              href="/v2/checklists/missions"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[10px] font-black text-violet-800 hover:bg-violet-100"
            >
              <ListChecks className="h-4 w-4" />
              استمارات المأموريات
            </Link>
          ) : undefined
        }
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800">
            <FileText className="h-3 w-3" />
            مكتبة شخصية
          </span>
        }
      />

      <ChecklistLibraryPanel />
    </V2PageContainer>
  )
}
