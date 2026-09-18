import { V2Placeholder } from '@/components/ui/V2Placeholder'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2SettingsPage() {
  await requireV2PagePermission('settings.view')
  return (
    <V2Placeholder
      title="الإعدادات والنظام"
      moduleId="settings"
      description="إعدادات المنظومة وسجلات التدقيق وضبط الأمان والمعايير التشغيلية المعتمدة."
    />
  )
}
