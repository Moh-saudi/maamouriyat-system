export const V2_TERMINOLOGY = {
  findingsModule: 'الملاحظات والتصحيح',
  finding: 'ملاحظة',
  findingPlural: 'الملاحظات',
  findingRegister: 'سجل الملاحظات الرقابية',
  correctionOrganization: 'الجهة المسؤولة عن التصحيح',
  correctionCompleted: 'تم تنفيذ التصحيح',
  verificationCompleted: 'تم التحقق من التصحيح',
  escalation: 'تصعيد المتابعة',
  voidFinding: 'استبعاد الملاحظة',
  workType: 'نوع العمل داخل المنظومة',
} as const

export const V2_CORRECTION_WORKFLOW_STEPS = [
  {
    key: 'observe',
    title: 'رصد الملاحظة',
    description:
      'يسجل فريق المرور الملاحظة من داخل المنشأة مع الوصف والتصنيف والتوثيق.',
  },
  {
    key: 'route',
    title: 'توجيهها للجهة المختصة',
    description:
      'تُوجَّه الملاحظة إلى جهة تنظيمية حقيقية داخل الهيكل، مثل مركز المعلومات أو مكافحة العدوى.',
  },
  {
    key: 'correct',
    title: 'تنفيذ التصحيح',
    description:
      'تستلم الجهة المختصة الملاحظة وتسجل ما تم تنفيذه وترفق دليل التصحيح عند الحاجة.',
  },
  {
    key: 'verify',
    title: 'التحقق من التصحيح',
    description:
      'تراجع جهة مخولة ما تم تنفيذه قبل اعتماد الإغلاق، بدل أن تغلق الجهة المصححة الملاحظة بنفسها.',
  },
  {
    key: 'escalate',
    title: 'تصعيد المتابعة عند التأخر',
    description:
      'إذا انتهت المهلة، تُصعَّد المتابعة للمستوى الأعلى مع بقاء الجهة الأصلية مسؤولة عن التصحيح.',
  },
  {
    key: 'close',
    title: 'الإغلاق أو الاستبعاد الموثق',
    description:
      'تُغلق الملاحظة بعد التحقق، أو تُستبعد بسبب موثق دون حذف أثرها الرقابي من السجل.',
  },
] as const
