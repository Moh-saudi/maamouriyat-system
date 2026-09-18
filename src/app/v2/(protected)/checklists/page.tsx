import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2ChecklistsPage() {
  await requireV2PagePermission('checklists.design')
  return (
    <V2Placeholder
      title="نماذج التقييم"
      moduleId="checklists"
      description="القوائم المرجعية ومعايير التفتيش الفنية والبنود التقييمية لمختلف تخصصات المرور الصحي."
    />
  )
}
