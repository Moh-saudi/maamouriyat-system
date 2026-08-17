import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const targetFile = path.resolve(__dirname, '../src/lib/real-facilities.ts')
const content = fs.readFileSync(targetFile, 'utf8')

// Cut at "// 21 Real MOHP Organizational Units"
const splitMarker = '// 21 Real MOHP Organizational Units'
const idx = content.indexOf(splitMarker)

if (idx === -1) {
  console.error('Marker not found!')
  process.exit(1)
}

const baseContent = content.substring(0, idx)

const newUnitsSection = `// ========================================================
// الهيكل التنظيمي والقطاعات المعتمدة لديوان عام وزارة الصحة والسكان
// ========================================================

export type MinistrySector = {
  id: string
  code: string
  name: string
  shortName: string
  headTitle: string
  description: string
  color: string
  badgeColor: string
}

export type MinistryUnit = {
  id: string
  sectorId: string
  name: string
  level: string
  type: string
  icon: string
  parent: string | null
  color: string
  badgeColor: string
  description: string
  coreTasks: string[]
  director: string
  staffCount: number
  levelIndex: number
  isCustom?: boolean
}

export const realEgyptianSectors: MinistrySector[] = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    code: 'PHC',
    name: 'قطاع الرعاية الصحية الأولية وتنمية الأسرة',
    shortName: 'الرعاية الأساسية وتنمية الأسرة',
    headTitle: 'رئيس قطاع الرعاية الصحية الأولية وتنمية الأسرة',
    description: 'القطاع المسئول عن حوكمة طب الأسرة، مراكز ووحدات الرعاية الأولية، رعاية الأمومة والطفولة، التطعيمات، والمشروع القومي لتنمية الأسرة المصرية.',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b'
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    code: 'CUR',
    name: 'قطاع الطب العلاجي',
    shortName: 'الطب العلاجي',
    headTitle: 'رئيس قطاع الطب العلاجي',
    description: 'القطاع المسئول عن رسم السياسات العلاجية ومتابعة جودة الخدمات الطبية بالمستشفيات العامة والتخصصية ومراكز البلازما وبنوك الدم والرعايات الحرجة.',
    color: 'linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)',
    badgeColor: '#d4af37'
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    code: 'PRV',
    name: 'قطاع الصحة الوقائية',
    shortName: 'الطب الوقائي',
    headTitle: 'رئيس قطاع الطب الوقائي',
    description: 'القطاع المسئول عن الترصد الوبائي ومكافحة العدوى وصحة البيئة والأغذية والحجر الصحي بالموانئ والمطارات.',
    color: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
    badgeColor: '#1e88e5'
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    code: 'TRN',
    name: 'قطاع التدريب وتطوير الكفاءات',
    shortName: 'التدريب والبحوث',
    headTitle: 'رئيس قطاع التدريب والبحوث',
    description: 'القطاع المعني بتأهيل الكوادر الطبية والتمريضية والتعليم الطبي المستمر والبعثات والتدريب الميداني.',
    color: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
    badgeColor: '#8e24aa'
  },
  {
    id: '00000000-0000-0000-0000-000000000014',
    code: 'GOV',
    name: 'قطاع الحوكمة والتطوير المؤسسي',
    shortName: 'الحوكمة والمتابعة',
    headTitle: 'رئيس قطاع الحوكمة والتطوير المؤسسي',
    description: 'القطاع المسئول عن المتابعة المركزية والرقمنة والتفتيش الإداري وضمان الجودة والتحول الرقمي.',
    color: 'linear-gradient(135deg, #e65100 0%, #bf360c 100%)',
    badgeColor: '#e65100'
  }
]

export const realEgyptianMinistryUnits: MinistryUnit[] = [
  // ========================================================
  // 1. قطاع الرعاية الصحية الأولية وتنمية الأسرة (PHC)
  // ========================================================
  {
    id: 'phc-sector',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'رئيس قطاع الرعاية الصحية الأولية وتنمية الأسرة',
    level: 'قمة القطاع (المستوى الممتاز)',
    type: 'القطاع الرئيسي ديوان عام الوزارة',
    icon: 'Compass',
    parent: null,
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'القيادة العليا لقطاع الرعاية الأولية وتنمية الأسرة بوزارة الصحة، والمسئول عن رسم السياسات الوقائية وصحة الأسرة والطفل وتطوير منظومة طب الأسرة والمراكز الصحية ووحدات الرعاية الأولية على مستوى الجمهورية.',
    coreTasks: [
      'رسم السياسات القومية لخدمات الرعاية الصحية الأولية وطب الأسرة ومبادرات الصحة العامة',
      'الإشراف والحوكمة على الإدارات المركزية والعامة للرعاية المتكاملة وتنمية الأسرة',
      'حوكمة وتطوير وحدات ومراكز الرعاية الأولية ومتابعة تقديم خدمات طب الأسرة بالمحافظات',
      'التنسيق مع المبادرات الرئاسية لتعزيز صحة المرأة والطفل والحد من الزيادة السكانية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 0
  },

  // 1.1 الإدارة المركزية لتنمية الأسرة
  {
    id: 'central-family-dev',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة المركزية لتنمية الأسرة',
    level: 'المستوى الأول: الإدارات المركزية (المستوى العالي)',
    type: 'إدارة مركزية رئيسية',
    icon: 'Building2',
    parent: 'phc-sector',
    color: 'linear-gradient(135deg, #00796b 0%, #004d40 100%)',
    badgeColor: '#00796b',
    description: 'الإدارة المركزية المسئولة عن رسم وتنفيذ استراتيجيات تنمية الأسرة المصرية، خدمات تنظيم الأسرة، الصحة الإنجابية، والتربية السكانية الشاملة.',
    coreTasks: [
      'الإشراف على تنفيذ المشروع القومي لتنمية الأسرة المصرية ومتابعة مؤشراته',
      'حوكمة وتوفير وسائل وخدمات تنظيم الأسرة والصحة الإنجابية في كافة الوحدات',
      'تنفيذ برامج التوعية والإعلام والتربية السكانية لرفع الوعي المجتمعي',
      'دعم نوادي المرأة ومراكز المشورة الأسرية لتنمية مهارات وصحة المرأة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 1
  },
  {
    id: 'gen-family-planning',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة لتنظيم الأسرة والصحة الإنجابية',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Activity',
    parent: 'central-family-dev',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'الإدارة المعنية بتوفير وتوزيع وسائل تنظيم الأسرة الآمنة، وتدريب الأطقم الطبية، وتسيير قوافل خدمات الصحة الإنجابية بالمناطق الأكثر احتياجاً.',
    coreTasks: [
      'توفير ومتابعة المخزون الاستراتيجي لوسائل تنظيم الأسرة بجميع الإدارات الصحية',
      'تدريب أطباء وتمريض الرعاية الأساسية على أحدث معايير تقديم المشورة والصحة الإنجابية',
      'تنظيم الحملات والقوافل المجانية (حقك تنظمي) بالمحافظات والقرى'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-population-awareness',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة للإعلام والتربية السكانية',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Compass',
    parent: 'central-family-dev',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'تخطيط وتنفيذ حملات التوعية المجتمعية والتربية السكانية وتصحيح المفاهيم الخاطئة ودعم الرائدات الريفيات في التوعية الميدانية.',
    coreTasks: [
      'إعداد ونشر الحملات الإعلامية والتثقيفية لضبط معدلات النمو السكاني',
      'الإشراف على منظومة الرائدات الريفيات وتوجيه الزيارات المنزلية التوعوية',
      'التنسيق مع وزارات التعليم والأوقاف والمجتمع المدني للتوعية بالقضايا السكانية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-women-development',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة لصحة وتنمية المرأة ونوادي الأسرة',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Building',
    parent: 'central-family-dev',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'تشغيل وتطوير نوادي المرأة بالوحدات الصحية لتدريب السيدات على المهارات الحرفية والصحية وتمكينهن اقتصادياً واجتماعياً.',
    coreTasks: [
      'تجهيز ومتابعة نوادي المرأة ومراكز خدمة الأسرة بالوحدات الصحية',
      'تقديم المعارض والبرامج التدريبية لدعم التمكين الاقتصادي للمرأة المعيلة',
      'ربط برامج التمكين الاقتصادي بالالتزام ببرامج الرعاية الصحية الدورية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-population-research',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة للبحوث والإحصاء السكاني',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Database',
    parent: 'central-family-dev',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'رصد وتحليل المؤشرات الديموغرافية والخصوبة بالمحافظات وإعداد التقارير الإحصائية الموجهة لمتخذي القرار.',
    coreTasks: [
      'تحليل البيانات الشهرية للمترددين واستخدام الوسائل بالوحدات الصحية',
      'إعداد تقارير المؤشرات السكانية والخرائط الجغرافية للمناطق ذات الكثافة العالية',
      'تقديم التوصيات والسياسات الإحصائية لدعم استراتيجية تنمية الأسرة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },

  // 1.2 الإدارة المركزية للرعاية المتكاملة
  {
    id: 'central-integrated-care',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة المركزية للرعاية المتكاملة',
    level: 'المستوى الأول: الإدارات المركزية (المستوى العالي)',
    type: 'إدارة مركزية رئيسية',
    icon: 'Activity',
    parent: 'phc-sector',
    color: 'linear-gradient(135deg, #00695c 0%, #004d40 100%)',
    badgeColor: '#00695c',
    description: 'الإدارة المركزية المعنية بتطوير وتكامل خدمات طب الأسرة، مراكز صحة الأم والطفل، برامج التطعيمات الأساسية، ورعاية كبار السن والمبادرات الرئاسية بالوحدات الصحية.',
    coreTasks: [
      'تطبيق معايير منظومة طب الأسرة وتأهيل وحدات الرعاية الصحية الأولية',
      'حوكمة وتوسيع برامج رعاية الأمومة والطفولة والفحص المبكر للأمراض الوراثية',
      'الإشراف على سلسلة التبريد ومنظومة التطعيمات الأساسية والروتينية',
      'متابعة وتنفيذ المبادرات الرئاسية للصحة العامة (100 مليون صحة) بوحدات الرعاية الأولية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 1
  },
  {
    id: 'gen-family-medicine',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة لطب الأسرة وتطوير المراكز الصحية',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Building2',
    parent: 'central-integrated-care',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'حوكمة تطبيق حزم خدمات طب الأسرة الشاملة، ومتابعة ملفات طب الأسرة الإلكترونية وتأهيل الوحدات للاعتماد.',
    coreTasks: [
      'تطبيق الملف العائلي الموحد وحزم الفحص الدوري الشامل للأسرة',
      'حوكمة نظام الإحالة من وحدات الرعاية الأولية إلى المستشفيات العامة والتخصصية',
      'متابعة معايير الجودة والاعتماد الصادرة عن هيئة الاعتماد والرقابة الصحية (GAHAR)'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-maternal-child',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة لصحة الأم والطفل ورعاية المبتسرين',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Activity',
    parent: 'central-integrated-care',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'الإشراف على متابعة الحوامل، الفحص الشامل لحديثي الولادة، برامج تغذية الرضع، ومتابعة منحنيات نمو وتطور الأطفال.',
    coreTasks: [
      'متابعة برنامج المسح القومي للأمراض الوراثية وضعف السمع لحديثي الولادة',
      'حوكمة صرف الألبان العلاجية وشبيهة لبن الأم للأطفال المستحقين',
      'متابعة بروتوكولات رعاية الحوامل للحد من وفيات الأمهات والأجنة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-vaccines-immunization',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة للتطعيمات والخدمات الوقائية الأساسية',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'CheckCircle2',
    parent: 'central-integrated-care',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'إدارة ومراقبة سلسلة التبريد وتوفير وتوزيع الطعوم الإجبارية للأطفال والجرعات التنشيطية وتسيير الحملات القومية للتطعيم.',
    coreTasks: [
      'التفتيش الدوري على ثلاجات حفظ الطعوم وسلسلة التبريد بجميع الوحدات',
      'متابعة معدلات التغطية بالتطعيمات الروتينية للأطفال للوصول لنسبة 100%',
      'التخطيط وتنفيذ حملات التطعيم القومية والمحدودة ضد شلل الأطفال والحصبة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-elderly-care',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة للرعاية الصحية لكبار السن والمسنين',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Compass',
    parent: 'central-integrated-care',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'الإشراف على برنامج الرعاية الصحية المستمرة لكبار السن وتقديم الفحوصات الدورية والدعم الطبي والنفسي بالوحدات الصحية.',
    coreTasks: [
      'تطبيق كارت المتابعة الصحية الدورية لكبار السن فوق 65 عاماً بالوحدات',
      'الفحص الدوري للكشف المبكر عن الضغط، السكر، الاعتلال الكلوي، والدهون',
      'تقديم خدمات الرعاية المنزلية التلطيفية للحالات غير القادرة على الحركة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-presidential-initiatives-phc',
    sectorId: '00000000-0000-0000-0000-000000000010',
    name: 'الإدارة العامة للمبادرات الرئاسية للرعاية الأولية',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Compass',
    parent: 'central-integrated-care',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'التنسيق والمتابعة الميدانية لتشغيل المبادرات الرئاسية للصحة العامة (صحة المرأة، المقبلين على الزواج، الأورام السرطانية) بوحدات الرعاية الأولية.',
    coreTasks: [
      'متابعة انتظام العمل بفرق المبادرات الرئاسية داخل المراكز والوحدات الصحية',
      'توفير الكواشف والأجهزة والمستلزمات الطبية المخصصة للمبادرات القومية',
      'حوكمة تسجيل وتدقيق بيانات المفحوصين على المنظومة الرقمية المركزية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },

  // ========================================================
  // 2. قطاع الطب العلاجي (Curative)
  // ========================================================
  {
    id: 'therapeutic-sector',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'رئيس قطاع الطب العلاجي',
    level: 'قمة القطاع (المستوى الممتاز)',
    type: 'القطاع الرئيسي ديوان عام الوزارة',
    icon: 'Compass',
    parent: null,
    color: 'linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)',
    badgeColor: '#d4af37',
    description: 'القيادة العليا لقطاع العلاجي بوزارة الصحة، والمسئول عن رسم السياسات العلاجية ومتابعة جودة الخدمات الطبية المقدمة للمواطنين بكافة المستشفيات التابعة للجمهورية.',
    coreTasks: [
      'رسم السياسات العلاجية والخطط الاستراتيجية لتقديم الخدمات الطبية في مصر',
      'الإشراف والحوكمة العليا على جميع الإدارات المركزية والعامة التابعة للقطاع',
      'التوجيه بإعادة توزيع الموارد والكوادر الطبية بما يخدم الاحتياجات الميدانية والمواطنين',
      'إقرار التعديلات الهيكلية واعتماد لجان التفتيش والحوكمة الفنية بوزارة الصحة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 0
  },
  // الإدارات المركزية للطب العلاجي
  {
    id: 'central-therapeutic',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة المركزية للشئون العلاجية',
    level: 'المستوى الأول: الإدارات المركزية (المستوى العالي)',
    type: 'إدارة مركزية رئيسية',
    icon: 'Building2',
    parent: 'therapeutic-sector',
    color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
    badgeColor: '#00897b',
    description: 'الإدارة المعنية بتنظيم وتطوير الشئون العلاجية، وتضم إدارات المستشفيات، الأسنان، الأشعة، الصيدلة، والعلاج الطبيعي لضمان تكامل الخدمة العلاجية.',
    coreTasks: [
      'إعداد السياسات وخطط التشغيل للمستشفيات العلاجية بالجمهورية',
      'تنظيم ومتابعة أعمال طب الأسنان والأشعة بكافة المرافق الطبية العامة',
      'الإشراف والحوكمة الصيدلانية وتوافر المستلزمات الطبية والعهد الدوائية',
      'تقييم وتطوير أقسام العلاج الطبيعي والتأهيل الطبي بمختلف المحافظات'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 1
  },
  {
    id: 'central-plasma',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة المركزية لعمليات الدم وتجميع البلازما',
    level: 'المستوى الأول: الإدارات المركزية (المستوى العالي)',
    type: 'إدارة مركزية رئيسية',
    icon: 'Activity',
    parent: 'therapeutic-sector',
    color: 'linear-gradient(135deg, #d32f2f 0%, #8e0000 100%)',
    badgeColor: '#d32f2f',
    description: 'الإدارة المركزية المسئولة عن تنظيم وتطوير بنوك الدم القومية وتأسيس وتفتيش مراكز تجميع البلازما لتحقيق الاكتفاء الذاتي من مشتقات الدم.',
    coreTasks: [
      'الإشراف على المشروع القومي لتجميع البلازما وتصنيع مشتقاتها محلياً',
      'متابعة كفاءة وأمان بنوك الدم التابعة لوزارة الصحة والقطاع الخاص',
      'وضع المعايير القياسية لسلامة نقل وتخزين الدم ومشتقاته',
      'التقييم المستمر لجودة أداء بنوك الدم ومراكز البلازما وتطبيق معايير الاعتماد الفني'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 1
  },
  {
    id: 'central-emergency',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة المركزية للطوارئ والرعاية الحرجة',
    level: 'المستوى الأول: الإدارات المركزية (المستوى العالي)',
    type: 'إدارة مركزية رئيسية',
    icon: 'Compass',
    parent: 'therapeutic-sector',
    color: 'linear-gradient(135deg, #f57c00 0%, #b26a00 100%)',
    badgeColor: '#f57c00',
    description: 'الإدارة الإستراتيجية لإدارة الأزمات، والرعايات المركزة، وأقسام الاستقبال والطوارئ وحضانات الأطفال بكافة مستشفيات الجمهورية.',
    coreTasks: [
      'إدارة وتنسيق المشروع القومي لرعايات وحضانات الأطفال بالوزارة',
      'التفتيش والمتابعة المستمرة لأقسام الاستقبال والطوارئ بالمستشفيات',
      'تنسيق الاستجابة والتحرك الميداني السريع أثناء الأزمات والكوارث القومية',
      'مراقبة تشغيل غرف العمليات وسلامة أداء شبكات الغازات والأكسجين بالمستشفيات'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 1
  },
  {
    id: 'central-specialized',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة المركزية لأمانة المراكز الطبية المتخصصة',
    level: 'المستوى الأول: الإدارات المركزية (المستوى العالي)',
    type: 'إدارة مركزية رئيسية',
    icon: 'Building',
    parent: 'therapeutic-sector',
    color: 'linear-gradient(135deg, #7b1fa2 0%, #4a148c 100%)',
    badgeColor: '#7b1fa2',
    description: 'الإدارة المسئولة عن تنظيم عمل المستشفيات التخصصية والمراكز المتميزة (كأورام ناصر، معاهد الأبحاث والقلب) لضمان تقديم علاج طبي عالي الدقة.',
    coreTasks: [
      'متابعة الجاهزية والجودة بمستشفيات أمانة المراكز الطبية المتخصصة',
      'إدارة وتوزيع التخصصات الطبية النادرة والدقيقة بالمعاهد التخصصية القومية',
      'الإشراف الإداري والمالي لمؤسسات ومستشفيات الأمانة واعتماد موازنتها',
      'التفتيش والاعتماد الطبي للخدمات المقدمة بمستشفيات وجراحات اليوم الواحد'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 1
  },

  // الإدارات العامة للطب العلاجي
  {
    id: 'gen-medical-boards',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للمجالس الطبية المتخصصة',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Building',
    parent: 'central-therapeutic',
    color: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
    badgeColor: '#1e88e5',
    description: 'إدارة وتوجيه اللجان الطبية المتخصصة لقرارات العلاج على نفقة الدولة، وفحوصات تراخيص القيادة، وتقارير العجز الطبي اللجان المتخصصة.',
    coreTasks: [
      'تسيير قرارات وتكلفة العلاج على نفقة الدولة للمواطنين الأكثر احتياجاً',
      'إدارة اللجان الطبية الموزعة بجميع المحافظات لتحديد العجز والنسب التأمينية',
      'مراقبة جودة التقارير الطبية الصادرة عن اللجان الفرعية وتراخيص القيادة الطبية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-radiology',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للأشعة',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Database',
    parent: 'central-therapeutic',
    color: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
    badgeColor: '#1e88e5',
    description: 'تنظيم وتراخيص وتفتيش أقسام الأشعة التشخيصية والعلاجية، ومتابعة برامج الصيانة والوقاية من الإشعاع للعاملين والمرضى.',
    coreTasks: [
      'التفتيش الدوري على أقسام الرنين والمقطعية والأشعة العادية بجميع المستشفيات',
      'متابعة معايير السلامة الإشعاعية والوقاية للأطقم الفنية والمرضى بمصر',
      'توزيع أجهزة الأشعة الحديثة وترقية كفاءة الكوادر الفنية وأخصائيي الأشعة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-dental',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة لشئون طب الأسنان',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Activity',
    parent: 'central-therapeutic',
    color: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
    badgeColor: '#1e88e5',
    description: 'تنظيم وتفتيش عيادات طب الأسنان بالمستشفيات والوحدات الصحية وتأكيد توفر الخامات المعقمة والتجهيزات الفنية للعيادات.',
    coreTasks: [
      'الإشراف المباشر على تجهيزات عيادات وجراحات الفم والأسنان بالمحافظات',
      'التفتيش على توافر المستلزمات الطبية وأدوات الحشو والتعقيم بعيادات الأسنان',
      'تنظيم القوافل التوعوية والوقائية للعناية بصحة الأسنان بالوحدات المدرسية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-hospitals',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة لشئون المستشفيات',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Building2',
    parent: 'central-therapeutic',
    color: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
    badgeColor: '#1e88e5',
    description: 'المسئول الأول عن تنظيم العمل اليومي، وتقييم مؤشرات الأداء، وتفتيش وتطوير الخدمات الطبية في المستشفيات العامة والتخصصية بمصر.',
    coreTasks: [
      'متابعة مؤشرات أداء المستشفيات ونسب إشغال الأسرة ورصد المعوقات اليومية',
      'حل مشكلات التشغيل الميداني وتنسيق الإعارات الطبية والفرق الاستشارية',
      'التنسيق مع مديريات الشئون الصحية بالمحافظات لإجراء حملات تفتيشية دورية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-physiotherapy',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للعلاج الطبيعي',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Activity',
    parent: 'central-therapeutic',
    color: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
    badgeColor: '#1e88e5',
    description: 'الإشراف على خدمات وعيادات العلاج الطبيعي والتأهيل الطبي بالمستشفيات العامة وتأهيل الكوادر الفنية وتجهيز العيادات.',
    coreTasks: [
      'رصد جاهزية أجهزة العلاج الطبيعي والتأهيل الحركي بالمستشفيات العامة',
      'وضع بروتوكولات التأهيل الطبي لمرضى الحوادث والجلطات والرعايات الحرجة',
      'التفتيش الفني على مراكز العلاج الطبيعي الخاصة بالتعاون مع إدارات التراخيص'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-pharmacy',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للشئون الصيدلية',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Server',
    parent: 'central-therapeutic',
    color: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
    badgeColor: '#1e88e5',
    description: 'الإشراف على الصيدليات والعهد الدوائية وحركة النواقص الدوائية وتطبيق معايير التخزين الجيد بكافة المرافق الصحية.',
    coreTasks: [
      'حصر وجدولة النواقص الدوائية وتوفير البدائل العلاجية فوراً للمرضى',
      'التفتيش الصيدلاني الدوري والمفاجئ على صيدليات المستشفيات والمخازن الإقليمية',
      'مراقبة سلامة استخدام وتوزيع الأدوية ذات الطبيعة الخاصة وحفظ العهد'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-blood-centers',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة لمراكز عمليات الدم',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Activity',
    parent: 'central-plasma',
    color: 'linear-gradient(135deg, #e53935 0%, #b71c1c 100%)',
    badgeColor: '#e53935',
    description: 'التفتيش الفني على بنوك الدم الإقليمية وبنوك دم المستشفيات وتأكيد توفر فصائل الدم ومستلزمات الفحص والتحليل الآمن.',
    coreTasks: [
      'التفتيش على شروط السلامة الفنية بمراكز بنوك الدم الإقليمية بمصر',
      'توفير احتياطي كافٍ من فصائل الدم النادرة ومتابعة الصرف للحالات الحرجة',
      'مراقبة كواشف الفحص ومجموعات الاختبار الخاصة بأمان أكياس الدم'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-plasma-centers',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة لتجميع البلازما',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Warehouse',
    parent: 'central-plasma',
    color: 'linear-gradient(135deg, #e53935 0%, #b71c1c 100%)',
    badgeColor: '#e53935',
    description: 'التشغيل والمتابعة الفنية للمشروع القومي لتجميع البلازما، واعتماد معايير الجودة والتبرع الآمن في مراكز البلازما.',
    coreTasks: [
      'مراقبة جاهزية أجهزة تجميع وفصل البلازما في مراكز التبرع القومية',
      'متابعة عقود التوريد واللوجستيات لعمليات الشحن المبرد لبلازما الدم',
      'تطبيق بروتوكولات الفرز والاستبعاد الآمن للمتبرعين بالبلازما لضمان النقاوة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-standards-eval',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للمعايير والتقييم الفني ومتابعة التشغيل',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'CheckCircle2',
    parent: 'central-plasma',
    color: 'linear-gradient(135deg, #e53935 0%, #b71c1c 100%)',
    badgeColor: '#e53935',
    description: 'التقييم المستمر لجودة أداء بنوك الدم ومراكز البلازما وتطبيق معايير الاعتماد الفني والمراقبة المستمرة.',
    coreTasks: [
      'إجراء التقييم الفني السنوي لجميع بنوك الدم ومطابقتها للمواصفات الدولية',
      'إعداد لوحات مؤشرات الجودة ومراقبة حدوث أي مضاعفات للمتبرعين',
      'تحديث المعايير الفنية لنقل الدم وبحوث البلازما بالتنسيق مع الجهات الأكاديمية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-health-mobilization',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للتعبئة الصحية',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Database',
    parent: 'central-emergency',
    color: 'linear-gradient(135deg, #fb8c00 0%, #ef6c00 100%)',
    badgeColor: '#fb8c00',
    description: 'التنسيق الاستراتيجي للقوى البشرية والامدادات الطبية وتجهيزات مخزون الأزمات تحسباً لأي طوارئ قومية.',
    coreTasks: [
      'التخطيط لحصر الكوادر الطبية والقوى البشرية لتعبئتها وقت الأزمات العامة',
      'مراقبة المخزون الاستراتيجي للأدوات والمستلزمات الطبية في مخازن الأزمات',
      'إجراء التدريبات والمناورات الافتراضية للتعامل مع حوادث الطوارئ الكبرى'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-operations-run',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للتشغيل والعمليات',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Activity',
    parent: 'central-emergency',
    color: 'linear-gradient(135deg, #fb8c00 0%, #ef6c00 100%)',
    badgeColor: '#fb8c00',
    description: 'مراقبة تشغيل غرف العمليات وسلامة أداء شبكات الغازات والأكسجين والصيانة الدورية للمرافق الحرجة بالمستشفيات.',
    coreTasks: [
      'متابعة تشغيل شبكات الأكسجين والغازات وتوفر المولدات البديلة للكهرباء بالمستشفيات',
      'الإشراف الفني الميداني على غرف وجراحات اليوم الواحد لتأكيد سلامة الأجهزة الملحقة',
      'إدارة الأزمات الفنية المفاجئة بالمستشفيات (أعطال مصاعد، تعطل غلايات أو محطات المياه)'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-emergency-special',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للطوارئ والتخصصات الطبية الحرجة',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Compass',
    parent: 'central-emergency',
    color: 'linear-gradient(135deg, #fb8c00 0%, #ef6c00 100%)',
    badgeColor: '#fb8c00',
    description: 'التفتيش الميداني المستمر على أقسام الرعاية المركزة والعمليات والتخصصات الحرجة كالحروق وجراحات القلب لضمان الجاهزية.',
    coreTasks: [
      'التفتيش على الاستقبال والطوارئ ومطابقة كود الإنقاذ السريع للمرضى',
      'مراقبة نسب إشغال الرعايات المركزة وحضانات المبتسرين للحد من أزمة الأسرة',
      'متابعة الجاهزية الفنية لمراكز علاج الحروق وأقسام السموم بالمستشفيات الحكومية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-specialized-care',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للرعاية الطبية المتخصصة',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة تخصصية',
    icon: 'Building2',
    parent: 'central-specialized',
    color: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
    badgeColor: '#8e24aa',
    description: 'التفتيش والاعتماد الطبي للخدمات المقدمة بمستشفيات ومراكز أمانة المراكز الطبية المتخصصة كمعاهد الأورام ومستشفيات جراحات اليوم الواحد.',
    coreTasks: [
      'التفتيش الطبي الفني على مستشفيات الأمانة (معهد ناصر، دار الشفاء، هرمل)',
      'وضع واعتماد بروتوكولات الأورام والجراحات التخصصية الدقيقة والمعقدة بمصر',
      'متابعة أداء الأطقم الطبية وتقديم التوجيهات لتسريع قوائم الانتظار للجراحات الحرجة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'gen-fin-admin',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'الإدارة العامة للشئون المالية والإدارية',
    level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
    type: 'إدارة عامة إدارية',
    icon: 'Database',
    parent: 'central-specialized',
    color: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
    badgeColor: '#8e24aa',
    description: 'إدارة الموازنات والمشتريات وحركة المخازن والملفات الوظيفية للأطقم والكوادر بمؤسسات أمانة المراكز الطبية.',
    coreTasks: [
      'إعداد ومراقبة الموازنات والميزانيات الخاصة بجميع مستشفيات الأمانة التخصصية',
      'الإشراف على لجان المشتريات والمناقصات للأجهزة الطبية المعقدة والمكلفة',
      'تنظيم الملفات المالية للموظفين والحوافز والبدلات التشجيعية للكوادر المتميزة'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 2
  },
  {
    id: 'sup-caravans',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'إدارة القوافل الطبية ومتابعة التشغيل',
    level: 'المستوى الثالث: الوظائف الإشرافية الملحقة (المستوى الأول أ)',
    type: 'إدارة إشرافية وتنفيذية ملحقة',
    icon: 'Compass',
    parent: 'therapeutic-sector',
    color: 'linear-gradient(135deg, #00acc1 0%, #006064 100%)',
    badgeColor: '#00acc1',
    description: 'التخطيط والتسيير الميداني للقوافل الطبية العلاجية للمناطق النائية والأكثر احتياجاً، وحصر وتوجيه الموارد الميدانية.',
    coreTasks: [
      'إطلاق وتسيير القوافل الطبية والمجانية للقرى الأكثر احتياجاً ومناطق حياة كريمة',
      'توفير الأدوية والتجهيزات والأجهزة الطبية المتنقلة والعيادات المجهزة للقافلة',
      'التنسيق مع إدارات العلاج على نفقة الدولة لإحالة الحالات المعقدة للمستشفيات التخصصية'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 3
  },
  {
    id: 'sup-nutrition',
    sectorId: '00000000-0000-0000-0000-000000000011',
    name: 'إدارة التغذية العلاجية',
    level: 'المستوى الثالث: الوظائف الإشرافية الملحقة (المستوى الأول أ)',
    type: 'إدارة إشرافية وتنفيذية ملحقة',
    icon: 'Activity',
    parent: 'therapeutic-sector',
    color: 'linear-gradient(135deg, #00acc1 0%, #006064 100%)',
    badgeColor: '#00acc1',
    description: 'تنظيم وحوكمة الوجبات والتغذية العلاجية للمرضى المقيمين بالمستشفيات وصياغة بروتوكولات التغذية السليمة لحالات العنايات الحرجة.',
    coreTasks: [
      'التفتيش والحوكمة الفنية على مطابخ ومخازن الأغذية والوجبات بجميع المستشفيات بمصر',
      'وضع وتحديث بروتوكولات التغذية السليمة لمرضى العناية المركزة والفشل الكلوي',
      'الإشراف وتدريب أخصائيي ومفتشي التغذية العلاجية وتأكيد شروط التخزين الجاف والمبرد'
    ],
    director: '',
    staffCount: 0,
    levelIndex: 3
  }
]

// ========================================================
// جهات التبعية التنظيمية الرسمية لجمهورية مصر العربية
// ========================================================
export type FacilityAffiliationOption = {
  id: string
  code: string
  name: string
  affiliation_type: 'directorate' | 'central_entity' | 'authority' | 'other'
  type?: 'directorate' | 'central_entity' | 'authority' | 'other'
  governorate_code?: string | null
  sort_order?: number
  is_active: boolean
}

export const realEgyptianAffiliations: FacilityAffiliationOption[] = [
  { id: 'aff-dir-cai', code: 'DIR-CAI', name: 'مديرية الشؤون الصحية بالقاهرة', affiliation_type: 'directorate', governorate_code: 'CAI', sort_order: 10, is_active: true },
  { id: 'aff-dir-giz', code: 'DIR-GIZ', name: 'مديرية الشؤون الصحية بالجيزة', affiliation_type: 'directorate', governorate_code: 'GIZ', sort_order: 20, is_active: true },
  { id: 'aff-dir-kal', code: 'DIR-KAL', name: 'مديرية الشؤون الصحية بالقليوبية', affiliation_type: 'directorate', governorate_code: 'KAL', sort_order: 30, is_active: true },
  { id: 'aff-dir-alx', code: 'DIR-ALX', name: 'مديرية الشؤون الصحية بالإسكندرية', affiliation_type: 'directorate', governorate_code: 'ALX', sort_order: 40, is_active: true },
  { id: 'aff-dir-bhr', code: 'DIR-BHR', name: 'مديرية الشؤون الصحية بالبحيرة', affiliation_type: 'directorate', governorate_code: 'BHR', sort_order: 50, is_active: true },
  { id: 'aff-dir-mtr', code: 'DIR-MTR', name: 'مديرية الشؤون الصحية بمطروح', affiliation_type: 'directorate', governorate_code: 'MTR', sort_order: 60, is_active: true },
  { id: 'aff-dir-dmt', code: 'DIR-DMT', name: 'مديرية الشؤون الصحية بدمياط', affiliation_type: 'directorate', governorate_code: 'DMT', sort_order: 70, is_active: true },
  { id: 'aff-dir-dak', code: 'DIR-DAK', name: 'مديرية الشؤون الصحية بالدقهلية', affiliation_type: 'directorate', governorate_code: 'DAK', sort_order: 80, is_active: true },
  { id: 'aff-dir-kfs', code: 'DIR-KFS', name: 'مديرية الشؤون الصحية بكفر الشيخ', affiliation_type: 'directorate', governorate_code: 'KFS', sort_order: 90, is_active: true },
  { id: 'aff-dir-ghb', code: 'DIR-GHB', name: 'مديرية الشؤون الصحية بالغربية', affiliation_type: 'directorate', governorate_code: 'GHB', sort_order: 100, is_active: true },
  { id: 'aff-dir-mnf', code: 'DIR-MNF', name: 'مديرية الشؤون الصحية بالمنوفية', affiliation_type: 'directorate', governorate_code: 'MNF', sort_order: 110, is_active: true },
  { id: 'aff-dir-shr', code: 'DIR-SHR', name: 'مديرية الشؤون الصحية بالشرقية', affiliation_type: 'directorate', governorate_code: 'SHR', sort_order: 120, is_active: true },
  { id: 'aff-dir-pts', code: 'DIR-PTS', name: 'مديرية الشؤون الصحية ببورسعيد', affiliation_type: 'directorate', governorate_code: 'PTS', sort_order: 130, is_active: true },
  { id: 'aff-dir-ism', code: 'DIR-ISM', name: 'مديرية الشؤون الصحية بالإسماعيلية', affiliation_type: 'directorate', governorate_code: 'ISM', sort_order: 140, is_active: true },
  { id: 'aff-dir-suz', code: 'DIR-SUZ', name: 'مديرية الشؤون الصحية بالسويس', affiliation_type: 'directorate', governorate_code: 'SUZ', sort_order: 150, is_active: true },
  { id: 'aff-dir-nsi', code: 'DIR-NSI', name: 'مديرية الشؤون الصحية بشمال سيناء', affiliation_type: 'directorate', governorate_code: 'NSI', sort_order: 160, is_active: true },
  { id: 'aff-dir-ssi', code: 'DIR-SSI', name: 'مديرية الشؤون الصحية بجنوب سيناء', affiliation_type: 'directorate', governorate_code: 'SSI', sort_order: 170, is_active: true },
  { id: 'aff-dir-bns', code: 'DIR-BNS', name: 'مديرية الشؤون الصحية ببني سويف', affiliation_type: 'directorate', governorate_code: 'BNS', sort_order: 180, is_active: true },
  { id: 'aff-dir-fym', code: 'DIR-FYM', name: 'مديرية الشؤون الصحية بالفيوم', affiliation_type: 'directorate', governorate_code: 'FYM', sort_order: 190, is_active: true },
  { id: 'aff-dir-min', code: 'DIR-MIN', name: 'مديرية الشؤون الصحية بالمنيا', affiliation_type: 'directorate', governorate_code: 'MIN', sort_order: 200, is_active: true },
  { id: 'aff-dir-ast', code: 'DIR-AST', name: 'مديرية الشؤون الصحية بأسيوط', affiliation_type: 'directorate', governorate_code: 'AST', sort_order: 210, is_active: true },
  { id: 'aff-dir-shg', code: 'DIR-SHG', name: 'مديرية الشؤون الصحية بسوهاج', affiliation_type: 'directorate', governorate_code: 'SHG', sort_order: 220, is_active: true },
  { id: 'aff-dir-qna', code: 'DIR-QNA', name: 'مديرية الشؤون الصحية بقنا', affiliation_type: 'directorate', governorate_code: 'QNA', sort_order: 230, is_active: true },
  { id: 'aff-dir-lxr', code: 'DIR-LXR', name: 'مديرية الشؤون الصحية بالأقصر', affiliation_type: 'directorate', governorate_code: 'LXR', sort_order: 240, is_active: true },
  { id: 'aff-dir-asn', code: 'DIR-ASN', name: 'مديرية الشؤون الصحية بأسوان', affiliation_type: 'directorate', governorate_code: 'ASN', sort_order: 250, is_active: true },
  { id: 'aff-dir-rs', code: 'DIR-RS', name: 'مديرية الشؤون الصحية بالبحر الأحمر', affiliation_type: 'directorate', governorate_code: 'RS', sort_order: 260, is_active: true },
  { id: 'aff-dir-wjd', code: 'DIR-WJD', name: 'مديرية الشؤون الصحية بالوادي الجديد', affiliation_type: 'directorate', governorate_code: 'WJD', sort_order: 270, is_active: true },
  { id: 'aff-mohp-hq', code: 'MOHP-HQ', name: 'ديوان عام وزارة الصحة والسكان', affiliation_type: 'central_entity', governorate_code: null, sort_order: 300, is_active: true },
  { id: 'aff-mhs', code: 'MHS-SECRETARIAT', name: 'الأمانة العامة للصحة النفسية وعلاج الإدمان', affiliation_type: 'central_entity', governorate_code: null, sort_order: 310, is_active: true },
  { id: 'aff-smc', code: 'SMC-SECRETARIAT', name: 'أمانة المراكز الطبية المتخصصة', affiliation_type: 'central_entity', governorate_code: null, sort_order: 320, is_active: true },
  { id: 'aff-hio', code: 'HIO', name: 'الهيئة العامة للتأمين الصحي', affiliation_type: 'authority', governorate_code: null, sort_order: 330, is_active: true },
  { id: 'aff-uhia', code: 'UHIA', name: 'الهيئة العامة للرعاية الصحية', affiliation_type: 'authority', governorate_code: null, sort_order: 340, is_active: true },
  { id: 'aff-eao', code: 'EAO', name: 'هيئة الإسعاف المصرية', affiliation_type: 'authority', governorate_code: null, sort_order: 350, is_active: true },
  { id: 'aff-gotem', code: 'GOTEM', name: 'الهيئة العامة للمستشفيات والمعاهد التعليمية', affiliation_type: 'authority', governorate_code: null, sort_order: 355, is_active: true },
  { id: 'aff-cur', code: 'CURATIVE-ORG', name: 'المؤسسة العلاجية', affiliation_type: 'central_entity', governorate_code: null, sort_order: 360, is_active: true }
]

export function getSectorById(sectorId?: string | null): MinistrySector {
  if (!sectorId) return realEgyptianSectors[0]
  const matched = realEgyptianSectors.find(s => s.id === sectorId || s.code.toLowerCase() === sectorId.toLowerCase() || s.name.includes(sectorId))
  return matched || realEgyptianSectors[0]
}

export function getMinistryUnitsForSector(sectorId?: string | null, customUnits: MinistryUnit[] = []): MinistryUnit[] {
  const effectiveSector = getSectorById(sectorId)
  const defaultUnits = realEgyptianMinistryUnits.filter(u => u.sectorId === effectiveSector.id)
  const sectorCustom = customUnits.filter(u => u.sectorId === effectiveSector.id)
  return [...defaultUnits, ...sectorCustom]
}
`

const finalContent = baseContent + newUnitsSection
fs.writeFileSync(targetFile, finalContent, 'utf8')
console.log('Successfully updated real-facilities.ts!')
