export type RoleTemplateId =
  | 'information_center'
  | 'field_inspector'
  | 'sector_manager'
  | 'central_admin_manager'
  | 'general_admin_manager'
  | 'directorate_manager'
  | 'health_admin_manager'

export type RoleTemplateDefinition = {
  id: RoleTemplateId
  label: string
  description: string
  sourceSystemRoleCode?: string
  permissionKeys?: readonly string[]
  preferredScope?: readonly string[]
}

export const ROLE_TEMPLATE_CATALOG: readonly RoleTemplateDefinition[] = [
  {
    id: 'information_center',
    label: 'مسؤول مركز معلومات',
    description:
      'إدارة الحسابات والدعم التشغيلي وتصحيح بيانات المنشآت داخل النطاق الإداري المسموح، بدون صلاحيات تفتيش ميداني.',
    sourceSystemRoleCode: 'information_center',
  },
  {
    id: 'field_inspector',
    label: 'مفتش / عضو فريق مرور ميداني',
    description:
      'تنفيذ الزيارات والمأموريات المكلف بها وتسجيل نتائج المرور والمخالفات.',
    sourceSystemRoleCode: 'field_inspector',
  },
  {
    id: 'health_admin_manager',
    label: 'مدير إدارة صحية',
    description:
      'إدارة ومتابعة المأموريات والمنشآت التابعة للإدارة الصحية.',
    sourceSystemRoleCode: 'health_admin_manager',
  },
  {
    id: 'directorate_manager',
    label: 'مدير مديرية الشؤون الصحية',
    description:
      'الإشراف على أعمال المديرية واعتماد ومتابعة المأموريات على مستوى المحافظة.',
    sourceSystemRoleCode: 'directorate_manager',
  },
  {
    id: 'general_admin_manager',
    label: 'مدير عام إدارة عامة',
    description:
      'إدارة ومتابعة أعمال الإدارة العامة والمأموريات والمستهدفات التابعة لها.',
    sourceSystemRoleCode: 'general_admin_manager',
  },
  {
    id: 'central_admin_manager',
    label: 'رئيس إدارة مركزية',
    description:
      'إدارة الإدارات العامة التابعة للإدارة المركزية ومتابعة أعمالها.',
    sourceSystemRoleCode: 'central_admin_manager',
  },
  {
    id: 'sector_manager',
    label: 'رئيس قطاع / وكيل وزارة',
    description:
      'إشراف قيادي على أعمال القطاع والجهات الواقعة داخل نطاقه.',
    sourceSystemRoleCode: 'sector_manager',
  },
] as const
