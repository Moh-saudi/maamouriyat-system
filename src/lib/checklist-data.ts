export type ChecklistItem = {
  id: string
  text: string
  answer_type: 'yes_no'
  is_required: boolean
  violation_priority: 'low' | 'medium' | 'high' | 'critical'
  correction_dept: string
}

export type ChecklistSection = {
  id: string
  name: string
  items: ChecklistItem[]
}

export const departmentChecklists: Record<string, ChecklistSection[]> = {
  'إدارة مكافحة العدوى': [
    {
      id: 'sec-inf-1',
      name: 'السلامة ونظافة المرافق الطبية',
      items: [
        {
          id: 'item-inf-1',
          text: 'هل تلتزم المنشأة بفصل النفايات الطبية الخطرة في الأكياس الحمراء المخصصة لها؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'high',
          correction_dept: 'إدارة مكافحة العدوى',
        },
        {
          id: 'item-inf-2',
          text: 'هل تتوفر أجهزة التعقيم بالبخار (Autoclave) وتعمل بكفاءة مع وجود مؤشرات بيولوجية؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'critical',
          correction_dept: 'إدارة مكافحة العدوى',
        },
        {
          id: 'item-inf-3',
          text: 'هل تتوفر المطهرات الكحولية لتعقيم أيدي الأطباء والممرضين بجوار أسرة المرضى؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'medium',
          correction_dept: 'إدارة مكافحة العدوى',
        },
      ],
    },
  ],
  'إدارة الصيدلة والمستلزمات': [
    {
      id: 'sec-phm-1',
      name: 'تخزين وصلاحية الأدوية',
      items: [
        {
          id: 'item-phm-1',
          text: 'هل يتم حفظ الأدوية والمستلزمات الحيوية (كالأنسولين) في ثلاجات عند درجة الحرارة المقررة (2-8 مئوية)؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'critical',
          correction_dept: 'إدارة الصيدلة والمستلزمات',
        },
        {
          id: 'item-phm-2',
          text: 'هل تتوفر بالصيدلية أي أدوية منتهية الصلاحية أو مجهولة المصدر دون عزلها في مكان مخصص للتخلص؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'critical',
          correction_dept: 'إدارة الصيدلة والمستلزمات',
        },
        {
          id: 'item-phm-3',
          text: 'هل دفاتر العهدة والمخازن للصيدلية منتظمة ومحدثة ومطابقة للأرصدة الفعلية؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'low',
          correction_dept: 'إدارة الصيدلة والمستلزمات',
        },
      ],
    },
  ],
  'إدارة صيانة الأجهزة الطبية': [
    {
      id: 'sec-maint-1',
      name: 'كفاءة وصيانة الأجهزة الطبية الحيوية',
      items: [
        {
          id: 'item-maint-1',
          text: 'هل أجهزة الطوارئ (مثل جهاز صدمات القلب ومولدات الأكسجين) تعمل بالبطارية الاحتياطية بكفاءة؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'critical',
          correction_dept: 'إدارة صيانة الأجهزة الطبية',
        },
        {
          id: 'item-maint-2',
          text: 'هل توجد عقود صيانة دورية سارية المفعول ومعتمدة للأجهزة الطبية الحيوية بالمنشأة؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'high',
          correction_dept: 'إدارة صيانة الأجهزة الطبية',
        },
      ],
    },
  ],
  'إدارة الجودة': [
    {
      id: 'sec-qty-1',
      name: 'معايير الجودة والتوثيق الطبي',
      items: [
        {
          id: 'item-qty-1',
          text: 'هل يتم تدوين السجلات الطبية والملفات الورقية أو الإلكترونية للمرضى بشكل متكامل ومنتظم؟',
          answer_type: 'yes_no',
          is_required: true,
          violation_priority: 'medium',
          correction_dept: 'إدارة الجودة',
        },
        {
          id: 'item-qty-2',
          text: 'هل تتوفر لوحات إرشادية واضحة للمرضى توضح حقوقهم وواجباتهم داخل المنشأة الطبية؟',
          answer_type: 'yes_no',
          is_required: false,
          violation_priority: 'low',
          correction_dept: 'إدارة الجودة',
        },
      ],
    },
  ],
}

// Default fallback checklist when a department is not matching
export const defaultChecklist: ChecklistSection[] = [
  {
    id: 'sec-gen-1',
    name: 'ملاحظات المرور والالتزام العام',
    items: [
      {
        id: 'item-gen-1',
        text: 'هل تلتزم المنشأة الطبية بتواجد الطاقم الطبي النوبتجي بالكامل في غرف الطوارئ والاستقبال؟',
        answer_type: 'yes_no',
        is_required: true,
        violation_priority: 'high',
        correction_dept: 'إدارة متابعة غياب الموظفين',
      },
      {
        id: 'item-gen-2',
        text: 'هل النظافة العامة والتعقيم العام لممرات المنشأة وغرف الاستقبال مرضية وفقاً للمعايير الصحية؟',
        answer_type: 'yes_no',
        is_required: true,
        violation_priority: 'medium',
        correction_dept: 'إدارة الجودة',
      },
    ],
  },
]

export function getChecklistByDepartment(department?: string | null): ChecklistSection[] {
  if (!department) return defaultChecklist
  
  // Clean department name
  const cleanedDept = department.trim()
  return departmentChecklists[cleanedDept] ?? defaultChecklist
}
