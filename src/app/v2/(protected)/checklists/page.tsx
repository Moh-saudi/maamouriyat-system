import { FileText } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { ChecklistLibraryPanel } from '@/features/checklists/components/ChecklistLibraryPanel'
import { requireAnyV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2ChecklistsPage() {
  await requireAnyV2PagePermission([
    'checklists.library',
    'checklists.design',
    'checklists.view',
  ])

  return (
    <V2PageContainer>
      <PageHeader
        title="استماراتي ونماذج المرور"
        description="مكتبتك الشخصية من استمارات المرور التي أنشأتها أو حفظتها من النماذج المتاحة في المنظومة."
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
