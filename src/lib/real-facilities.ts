// 27 Stable Governorates of Egypt
export const realEgyptianGovernorates = [
  { id: 'gov-cairo', name: 'القاهرة', region: 'القاهرة الكبرى' },
  { id: 'gov-giza', name: 'الجيزة', region: 'القاهرة الكبرى' },
  { id: 'gov-alex', name: 'الإسكندرية', region: 'وجه بحري' },
  { id: 'gov-qalyubia', name: 'القليوبية', region: 'القاهرة الكبرى' },
  { id: 'gov-beheira', name: 'البحيرة', region: 'وجه بحري' },
  { id: 'gov-portsaid', name: 'بورسعيد', region: 'مدن القناة' },
  { id: 'gov-ismailia', name: 'الإسماعيلية', region: 'مدن القناة' },
  { id: 'gov-suez', name: 'السويس', region: 'مدن القناة' },
  { id: 'gov-gharbia', name: 'الغربية', region: 'وجه بحري' },
  { id: 'gov-monufia', name: 'المنوفية', region: 'وجه بحري' },
  { id: 'gov-dakahlia', name: 'الدقهلية', region: 'وجه بحري' },
  { id: 'gov-sharqia', name: 'الشرقية', region: 'وجه بحري' },
  { id: 'gov-kafrelsheikh', name: 'كفر الشيخ', region: 'وجه بحري' },
  { id: 'gov-damietta', name: 'دمياط', region: 'وجه بحري' },
  { id: 'gov-fayoum', name: 'الفيوم', region: 'شمال الصعيد' },
  { id: 'gov-benisuef', name: 'بني سويف', region: 'شمال الصعيد' },
  { id: 'gov-minya', name: 'المنيا', region: 'شمال الصعيد' },
  { id: 'gov-assiut', name: 'أسيوط', region: 'وسط الصعيد' },
  { id: 'gov-sohag', name: 'سوهاج', region: 'جنوب الصعيد' },
  { id: 'gov-qena', name: 'قنا', region: 'جنوب الصعيد' },
  { id: 'gov-luxor', name: 'الأقصر', region: 'جنوب الصعيد' },
  { id: 'gov-aswan', name: 'أسوان', region: 'جنوب الصعيد' },
  { id: 'gov-redsea', name: 'البحر الأحمر', region: 'حدودية' },
  { id: 'gov-newvalley', name: 'الوادي الجديد', region: 'حدودية' },
  { id: 'gov-matrouh', name: 'مطروح', region: 'حدودية' },
  { id: 'gov-sinai-north', name: 'شمال سيناء', region: 'حدودية' },
  { id: 'gov-sinai-south', name: 'جنوب سيناء', region: 'حدودية' },
]

// 51 Real Egyptian Medical Facilities (34 Hospitals, 10 Family Health Centers, 7 Supply Warehouses)
export const realEgyptianMedicalFacilities = [
  // ================= HOSPITALS (34) =================
  {
    id: 'fac-real-1',
    name: 'مستشفى معهد ناصر للبحوث والعلاج',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'كورنيش النيل، روض الفرج، شبرا، القاهرة',
    is_active: true,
    latitude: 30.0783,
    longitude: 31.2339,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-real-3',
    name: 'مستشفى المنيرة العام',
    facility_type: 'مستشفى عام',
    address: 'شارع نوبار، السيدة زينب، القاهرة',
    is_active: true,
    latitude: 30.0336,
    longitude: 31.2384,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-real-4',
    name: 'مستشفى أحمد ماهر التعليمي',
    facility_type: 'مستشفى تعليمي',
    address: 'شارع بورسعيد، باب الخلق، القاهرة',
    is_active: true,
    latitude: 30.0416,
    longitude: 31.2536,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-real-7',
    name: 'مستشفى الهلال لجراحة العظام',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'شارع رمسيس، وسط البلد، القاهرة',
    is_active: true,
    latitude: 30.0620,
    longitude: 31.2480,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-real-6',
    name: 'مستشفى القاهرة الجديدة العام',
    facility_type: 'مستشفى عام',
    address: 'شارع الشباب، التجمع الثالث، القاهرة الجديدة',
    is_active: true,
    latitude: 30.0076,
    longitude: 31.4468,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-real-2',
    name: 'مستشفى أم المصريين العام',
    facility_type: 'مستشفى عام',
    address: 'شارع ربيع الجيزي، الجيزة',
    is_active: true,
    latitude: 30.0135,
    longitude: 31.2144,
    governorate_id: 'gov-giza',
    governorates: { name: 'الجيزة' }
  },
  {
    id: 'fac-real-5',
    name: 'مستشفى الشيخ زايد التخصصي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'المحور المركزي، مدينة الشيخ زايد، الجيزة',
    is_active: true,
    latitude: 30.0483,
    longitude: 30.9856,
    governorate_id: 'gov-giza',
    governorates: { name: 'الجيزة' }
  },
  {
    id: 'fac-real-8',
    name: 'مستشفى كرموز العمالي',
    facility_type: 'مستشفى تأمين صحي',
    address: 'شارع ستفان كرموز، الإسكندرية',
    is_active: true,
    latitude: 31.1895,
    longitude: 29.9144,
    governorate_id: 'gov-alex',
    governorates: { name: 'الإسكندرية' }
  },
  {
    id: 'fac-real-11',
    name: 'مستشفى رأس التين العام',
    facility_type: 'مستشفى عام',
    address: 'شارع الأنفوشي، الجمرك، الإسكندرية',
    is_active: true,
    latitude: 31.2064,
    longitude: 29.8789,
    governorate_id: 'gov-alex',
    governorates: { name: 'الإسكندرية' }
  },
  {
    id: 'fac-real-12',
    name: 'مستشفى بنها التعليمي',
    facility_type: 'مستشفى تعليمي',
    address: 'شارع سعد زغلول، بنها، القليوبية',
    is_active: true,
    latitude: 30.4611,
    longitude: 31.1861,
    governorate_id: 'gov-qalyubia',
    governorates: { name: 'القليوبية' }
  },
  {
    id: 'fac-real-10',
    name: 'مستشفى دمنهور التعليمي',
    facility_type: 'مستشفى تعليمي',
    address: 'شارع الروضة، دمنهور، البحيرة',
    is_active: true,
    latitude: 31.0375,
    longitude: 30.4694,
    governorate_id: 'gov-beheira',
    governorates: { name: 'البحيرة' }
  },
  {
    id: 'fac-real-9',
    name: 'مستشفى السلام بورسعيد العام',
    facility_type: 'مستشفى (الهيئة العامة للرعاية الصحية)',
    address: 'شارع مصطفى كامل، بورسعيد',
    is_active: true,
    latitude: 31.2612,
    longitude: 32.3021,
    governorate_id: 'gov-portsaid',
    governorates: { name: 'بورسعيد' }
  },
  {
    id: 'fac-real-13',
    name: 'مستشفى النصر التخصصي للأطفال',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'شارع الاستاد، العرب، بورسعيد',
    is_active: true,
    latitude: 31.2589,
    longitude: 32.2844,
    governorate_id: 'gov-portsaid',
    governorates: { name: 'بورسعيد' }
  },
  {
    id: 'fac-real-14',
    name: 'مجمع الإسماعيلية الطبي',
    facility_type: 'مستشفى (الهيئة العامة للرعاية الصحية)',
    address: 'شارع صبري مبدي، حي ثالث، الإسماعيلية',
    is_active: true,
    latitude: 30.6011,
    longitude: 32.2744,
    governorate_id: 'gov-ismailia',
    governorates: { name: 'الإسماعيلية' }
  },
  {
    id: 'fac-real-15',
    name: 'مستشفى السويس العام',
    facility_type: 'مستشفى عام',
    address: 'شارع الجيش، السويس',
    is_active: true,
    latitude: 29.9739,
    longitude: 32.5261,
    governorate_id: 'gov-suez',
    governorates: { name: 'السويس' }
  },
  {
    id: 'fac-real-16',
    name: 'مستشفى المنشاوي العام',
    facility_type: 'مستشفى عام',
    address: 'شارع مدرسة الصنايع، طنطا، الغربية',
    is_active: true,
    latitude: 30.7836,
    longitude: 30.9964,
    governorate_id: 'gov-gharbia',
    governorates: { name: 'الغربية' }
  },
  {
    id: 'fac-real-17',
    name: 'مستشفى شبين الكوم التعليمي',
    facility_type: 'مستشفى تعليمي',
    address: 'شارع جمال عبد الناصر، شبين الكوم، المنوفية',
    is_active: true,
    latitude: 30.5583,
    longitude: 31.0089,
    governorate_id: 'gov-monufia',
    governorates: { name: 'المنوفية' }
  },
  {
    id: 'fac-real-18',
    name: 'مستشفى المنصورة الدولي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'شارع عبد السلام عارف، المنصورة، الدقهلية',
    is_active: true,
    latitude: 31.0361,
    longitude: 31.3789,
    governorate_id: 'gov-dakahlia',
    governorates: { name: 'الدقهلية' }
  },
  {
    id: 'fac-real-19',
    name: 'مستشفى الأحرار التعليمي',
    facility_type: 'مستشفى تعليمي',
    address: 'طريق الأحرار، الزقازيق، الشرقية',
    is_active: true,
    latitude: 30.5694,
    longitude: 31.5025,
    governorate_id: 'gov-sharqia',
    governorates: { name: 'الشرقية' }
  },
  {
    id: 'fac-real-20',
    name: 'مستشفى كفر الشيخ العام',
    facility_type: 'مستشفى عام',
    address: 'شارع الجيش، كفر الشيخ',
    is_active: true,
    latitude: 31.1083,
    longitude: 30.9442,
    governorate_id: 'gov-kafrelsheikh',
    governorates: { name: 'كفر الشيخ' }
  },
  {
    id: 'fac-real-21',
    name: 'مستشفى دمياط التخصصي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'شارع كورنيش النيل، الأعصر، دمياط',
    is_active: true,
    latitude: 31.4172,
    longitude: 31.8144,
    governorate_id: 'gov-damietta',
    governorates: { name: 'دمياط' }
  },
  {
    id: 'fac-real-22',
    name: 'مستشفى الفيوم العام',
    facility_type: 'مستشفى عام',
    address: 'شارع النبوي المهندس، الفيوم',
    is_active: true,
    latitude: 29.3089,
    longitude: 30.8421,
    governorate_id: 'gov-fayoum',
    governorates: { name: 'الفيوم' }
  },
  {
    id: 'fac-real-23',
    name: 'مستشفى بني سويف التخصصي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'شارع الروضة، بني سويف',
    is_active: true,
    latitude: 29.0744,
    longitude: 31.0978,
    governorate_id: 'gov-benisuef',
    governorates: { name: 'بني سويف' }
  },
  {
    id: 'fac-real-24',
    name: 'مستشفى ملوي التخصصي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'شارع المجيدي، ملوي، المنيا',
    is_active: true,
    latitude: 27.7312,
    longitude: 30.8422,
    governorate_id: 'gov-minya',
    governorates: { name: 'المنيا' }
  },
  {
    id: 'fac-real-25',
    name: 'مستشفى أسيوط العام',
    facility_type: 'مستشفى عام',
    address: 'شارع الجلاء، أسيوط',
    is_active: true,
    latitude: 27.1803,
    longitude: 31.1894,
    governorate_id: 'gov-assiut',
    governorates: { name: 'أسيوط' }
  },
  {
    id: 'fac-real-26',
    name: 'مستشفى سوهاج التعليمي',
    facility_type: 'مستشفى تعليمي',
    address: 'شارع الكورنيش الشرقي، سوهاج',
    is_active: true,
    latitude: 26.5564,
    longitude: 31.6961,
    governorate_id: 'gov-sohag',
    governorates: { name: 'سوهاج' }
  },
  {
    id: 'fac-real-27',
    name: 'مستشفى قنا العام',
    facility_type: 'مستشفى عام',
    address: 'شارع معبد دندرة، قنا',
    is_active: true,
    latitude: 26.1612,
    longitude: 32.7244,
    governorate_id: 'gov-qena',
    governorates: { name: 'قنا' }
  },
  {
    id: 'fac-real-28',
    name: 'مستشفى الكرنك الدولي',
    facility_type: 'مستشفى (الهيئة العامة للرعاية الصحية)',
    address: 'شارع كورنيش النيل، الأقصر',
    is_active: true,
    latitude: 25.7112,
    longitude: 32.6512,
    governorate_id: 'gov-luxor',
    governorates: { name: 'الأقصر' }
  },
  {
    id: 'fac-real-29',
    name: 'مستشفى أسوان التخصصي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'حي الصداقة الجديدة، أسوان',
    is_active: true,
    latitude: 24.0889,
    longitude: 32.8989,
    governorate_id: 'gov-aswan',
    governorates: { name: 'أسوان' }
  },
  {
    id: 'fac-real-30',
    name: 'مستشفى الغردقة العام',
    facility_type: 'مستشفى عام',
    address: 'شارع المستشفى، الدهار، الغردقة، البحر الأحمر',
    is_active: true,
    latitude: 27.2589,
    longitude: 33.8112,
    governorate_id: 'gov-redsea',
    governorates: { name: 'البحر الأحمر' }
  },
  {
    id: 'fac-real-31',
    name: 'مستشفى الخارجة التخصصي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'شارع جمال عبد الناصر، الخارجة، الوادي الجديد',
    is_active: true,
    latitude: 25.4389,
    longitude: 30.5489,
    governorate_id: 'gov-newvalley',
    governorates: { name: 'الوادي الجديد' }
  },
  {
    id: 'fac-real-32',
    name: 'مستشفى العلمين النموذجي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'طريق إسكندرية مطروح الساحلي، العلمين، مطروح',
    is_active: true,
    latitude: 30.8244,
    longitude: 28.9544,
    governorate_id: 'gov-matrouh',
    governorates: { name: 'مطروح' }
  },
  {
    id: 'fac-real-33',
    name: 'مستشفى العريش العام',
    facility_type: 'مستشفى عام',
    address: 'شارع الجيش، العريش، شمال سيناء',
    is_active: true,
    latitude: 31.1312,
    longitude: 33.8012,
    governorate_id: 'gov-sinai-north',
    governorates: { name: 'شمال سيناء' }
  },
  {
    id: 'fac-real-34',
    name: 'مستشفى شرم الشيخ الدولي',
    facility_type: 'مستشفى تخصصي (أمانة المراكز الطبية)',
    address: 'حي النور، شرم الشيخ، جنوب سيناء',
    is_active: true,
    latitude: 27.9156,
    longitude: 34.3312,
    governorate_id: 'gov-sinai-south',
    governorates: { name: 'جنوب سيناء' }
  },

  // ================= PRIMARY HEALTHCARE CENTERS (10) =================
  {
    id: 'fac-phc-1',
    name: 'مركز طبي النزهة الجديدة الشامل',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'شارع طه حسين، النزهة الجديدة، القاهرة',
    is_active: true,
    latitude: 30.1211,
    longitude: 31.3654,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-phc-2',
    name: 'مركز طبي التجمع الأول المطور',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'بجوار سنترال التجمع الأول، القاهرة الجديدة، القاهرة',
    is_active: true,
    latitude: 30.0522,
    longitude: 31.4589,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-phc-3',
    name: 'مركز صحة أسرة الشيخ زايد المتميز',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'الحي الأول، مدينة الشيخ زايد، الجيزة',
    is_active: true,
    latitude: 30.0384,
    longitude: 30.9989,
    governorate_id: 'gov-giza',
    governorates: { name: 'الجيزة' }
  },
  {
    id: 'fac-phc-4',
    name: 'مركز صحة أسرة المطرية النموذجي',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'شارع المطراوي، المطرية، القاهرة',
    is_active: true,
    latitude: 30.1264,
    longitude: 31.3021,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-phc-5',
    name: 'مركز طبي المحروسة المطور',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'قرية المحروسة، الخانكة، القليوبية',
    is_active: true,
    latitude: 30.1611,
    longitude: 31.2589,
    governorate_id: 'gov-qalyubia',
    governorates: { name: 'القليوبية' }
  },
  {
    id: 'fac-phc-6',
    name: 'مركز صحة أسرة جليم النموذجي',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'شارع جليم، الرمل، الإسكندرية',
    is_active: true,
    latitude: 31.2389,
    longitude: 29.9721,
    governorate_id: 'gov-alex',
    governorates: { name: 'الإسكندرية' }
  },
  {
    id: 'fac-phc-7',
    name: 'مركز رعاية طفل العرب العام',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'شارع النصر، حي العرب، بورسعيد',
    is_active: true,
    latitude: 31.2544,
    longitude: 32.2989,
    governorate_id: 'gov-portsaid',
    governorates: { name: 'بورسعيد' }
  },
  {
    id: 'fac-phc-8',
    name: 'مركز طبي الحوامدية التخصصي',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'طريق الحوامدية الزراعي، الحوامدية، الجيزة',
    is_active: true,
    latitude: 29.8944,
    longitude: 31.2689,
    governorate_id: 'gov-giza',
    governorates: { name: 'الجيزة' }
  },
  {
    id: 'fac-phc-9',
    name: 'مركز طب أسرة غرب أسوان النموذجي',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'قرية غرب أسوان، أسوان',
    is_active: true,
    latitude: 24.1112,
    longitude: 32.8689,
    governorate_id: 'gov-aswan',
    governorates: { name: 'أسوان' }
  },
  {
    id: 'fac-phc-10',
    name: 'مركز طب أسرة الشيخ شحات',
    facility_type: 'مركز رعاية صحية أولية وطب أسرة',
    address: 'منطقة الشيخ شحات، قنا',
    is_active: true,
    latitude: 26.1589,
    longitude: 32.7312,
    governorate_id: 'gov-qena',
    governorates: { name: 'قنا' }
  },

  // ================= MEDICAL WAREHOUSES (7) =================
  {
    id: 'fac-war-1',
    name: 'المخزن الإقليمي للتموين الطبي بالعباسية',
    facility_type: 'مخزن تموين طبي وإمداد دوائي رئيسي',
    address: 'شارع السكة البيضاء، العباسية، القاهرة',
    is_active: true,
    latitude: 30.0684,
    longitude: 31.2789,
    governorate_id: 'gov-cairo',
    governorates: { name: 'القاهرة' }
  },
  {
    id: 'fac-war-2',
    name: 'مخزن المستلزمات الطبية المركزي بالدقي',
    facility_type: 'مخزن تموين طبي وإمداد دوائي رئيسي',
    address: 'شارع التحرير، الدقي، الجيزة',
    is_active: true,
    latitude: 30.0401,
    longitude: 31.2052,
    governorate_id: 'gov-giza',
    governorates: { name: 'الجيزة' }
  },
  {
    id: 'fac-war-3',
    name: 'مخازن الإمداد الدوائي الإقليمية بالعامرية',
    facility_type: 'مخزن تموين طبي وإمداد دوائي رئيسي',
    address: 'المنطقة الصناعية بالعامرية، الإسكندرية',
    is_active: true,
    latitude: 31.0264,
    longitude: 29.8112,
    governorate_id: 'gov-alex',
    governorates: { name: 'الإسكندرية' }
  },
  {
    id: 'fac-war-4',
    name: 'مخزن الطعوم واللقاحات المركزي بالبطل أحمد عبد العزيز',
    facility_type: 'مخزن تموين طبي وإمداد دوائي رئيسي',
    address: 'شارع البطل أحمد عبد العزيز، المهندسين، الجيزة',
    is_active: true,
    latitude: 30.0489,
    longitude: 31.2112,
    governorate_id: 'gov-giza',
    governorates: { name: 'الجيزة' }
  },
  {
    id: 'fac-war-5',
    name: 'مخزن الإمداد الدوائي الإقليمي بأسيوط',
    facility_type: 'مخزن تموين طبي وإمداد دوائي رئيسي',
    address: 'منطقة الوليدية، أسيوط',
    is_active: true,
    latitude: 27.1844,
    longitude: 31.1812,
    governorate_id: 'gov-assiut',
    governorates: { name: 'أسيوط' }
  },
  {
    id: 'fac-war-6',
    name: 'مخزن التموين الطبي المركزي ببنها',
    facility_type: 'مخزن تموين طبي وإمداد دوائي رئيسي',
    address: 'شارع فريد ندا، بنها، القليوبية',
    is_active: true,
    latitude: 30.4589,
    longitude: 31.1821,
    governorate_id: 'gov-qalyubia',
    governorates: { name: 'القليوبية' }
  },
  {
    id: 'fac-war-7',
    name: 'مخزن الإمداد الطبي ببورسعيد المطور',
    facility_type: 'مخزن تموين طبي وإمداد دوائي رئيسي',
    address: 'شارع عاطف السادات، بورسعيد',
    is_active: true,
    latitude: 31.2512,
    longitude: 32.2912,
    governorate_id: 'gov-portsaid',
    governorates: { name: 'بورسعيد' }
  }
]

// 21 Real MOHP Organizational Units for قطاع الطب العلاجي
export const realEgyptianMinistryUnits = [
  {
    id: 'therapeutic-sector',
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
      'الإشراف والرقابة العليا على جميع الإدارات المركزية والعامة التابعة للقطاع',
      'التوجيه بإعادة توزيع الموارد والكوادر الطبية بما يخدم الاحتياجات الميدانية والمواطنين',
      'إقرار التعديلات الهيكلية واعتماد لجان التفتيش والرقابة الفنية بوزارة الصحة'
    ],
    director: 'أ.د. خالد عبد الغفار (رئيس القطاع)',
    staffCount: 18,
    levelIndex: 0
  },
  // الإدارات المركزية
  {
    id: 'central-therapeutic',
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
      'الإشراف والرقابة الصيدلانية وتوافر المستلزمات الطبية والعهد الدوائية',
      'تقييم وتطوير أقسام العلاج الطبيعي والتأهيل الطبي بمختلف المحافظات'
    ],
    director: 'د. أشرف الأتربي (رئيس الإدارة المركزية)',
    staffCount: 34,
    levelIndex: 1
  },
  {
    id: 'central-plasma',
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
    director: 'د. نهاد محمد (رئيس الإدارة المركزية)',
    staffCount: 25,
    levelIndex: 1
  },
  {
    id: 'central-emergency',
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
    director: 'د. شريف وديع (رئيس الإدارة المركزية)',
    staffCount: 42,
    levelIndex: 1
  },
  {
    id: 'central-specialized',
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
    director: 'د. مها إبراهيم (رئيس الإدارة المركزية والأمانة)',
    staffCount: 50,
    levelIndex: 1
  },
  // الإدارات العامة التابعة للطب العلاجي
  {
    id: 'gen-medical-boards',
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
    director: 'د. محمد زيدان (مدير عام الإدارة)',
    staffCount: 22,
    levelIndex: 2
  },
  {
    id: 'gen-radiology',
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
    director: 'د. سهام السعدني (مدير عام الإدارة)',
    staffCount: 16,
    levelIndex: 2
  },
  {
    id: 'gen-dental',
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
    director: 'د. وليد حسن (مدير عام الإدارة)',
    staffCount: 20,
    levelIndex: 2
  },
  {
    id: 'gen-hospitals',
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
    director: 'د. أحمد سعفان (مدير عام الإدارة)',
    staffCount: 45,
    levelIndex: 2
  },
  {
    id: 'gen-physiotherapy',
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
    director: 'د. أحمد البغدادي (مدير عام الإدارة)',
    staffCount: 14,
    levelIndex: 2
  },
  {
    id: 'gen-pharmacy',
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
    director: 'صيدلانية غادة علي (مدير عام الإدارة)',
    staffCount: 38,
    levelIndex: 2
  },
  // إدارات عمليات الدم
  {
    id: 'gen-blood-centers',
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
    director: 'د. نانسي الجندي (مدير عام الإدارة)',
    staffCount: 19,
    levelIndex: 2
  },
  {
    id: 'gen-plasma-centers',
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
    director: 'د. أسامة شاهين (مدير عام الإدارة)',
    staffCount: 22,
    levelIndex: 2
  },
  {
    id: 'gen-standards-eval',
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
    director: 'د. ياسمين مجدي (مدير عام الإدارة)',
    staffCount: 15,
    levelIndex: 2
  },
  // إدارات الطوارئ والرعاية الحرجة
  {
    id: 'gen-health-mobilization',
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
    director: 'د. خالد الخطيب (مدير عام الإدارة)',
    staffCount: 18,
    levelIndex: 2
  },
  {
    id: 'gen-operations-run',
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
    director: 'د. مصطفى غنيم (مدير عام الإدارة)',
    staffCount: 28,
    levelIndex: 2
  },
  {
    id: 'gen-emergency-special',
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
    director: 'د. محمد الغباشي (مدير عام الإدارة)',
    staffCount: 30,
    levelIndex: 2
  },
  // إدارات أمانة المراكز المتخصصة
  {
    id: 'gen-specialized-care',
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
    director: 'د. شادي سالم (مدير عام الإدارة)',
    staffCount: 26,
    levelIndex: 2
  },
  {
    id: 'gen-fin-admin',
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
    director: 'أ. محمود طه (مدير عام الإدارة)',
    staffCount: 34,
    levelIndex: 2
  },
  // الوظائف الإشرافية الملحقة للقطاع
  {
    id: 'sup-caravans',
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
    director: 'د. وفاء الصادق (مدير الإدارة والمشرف العام)',
    staffCount: 16,
    levelIndex: 3
  },
  {
    id: 'sup-nutrition',
    name: 'إدارة التغذية العلاجية',
    level: 'المستوى الثالث: الوظائف الإشرافية الملحقة (المستوى الأول أ)',
    type: 'إدارة إشرافية وتنفيذية ملحقة',
    icon: 'Activity',
    parent: 'therapeutic-sector',
    color: 'linear-gradient(135deg, #00acc1 0%, #006064 100%)',
    badgeColor: '#00acc1',
    description: 'تنظيم ورقابة الوجبات والتغذية العلاجية للمرضى المقيمين بالمستشفيات وصياغة بروتوكولات التغذية السليمة لحالات العنايات الحرجة.',
    coreTasks: [
      'التفتيش والرقابة الفنية على مطابخ ومخازن الأغذية والوجبات بجميع المستشفيات بمصر',
      'وضع وتحديث بروتوكولات التغذية السليمة لمرضى العناية المركزة والفشل الكلوي',
      'الإشراف وتدريب أخصائيي ومفتشي التغذية العلاجية وتأكيد شروط التخزين الجاف والمبرد'
    ],
    director: 'د. سلوى عبد الرحمن (مدير الإدارة الفني)',
    staffCount: 12,
    levelIndex: 3
  }
]
