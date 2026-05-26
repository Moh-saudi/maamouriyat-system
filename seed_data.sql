-- =========================================================================
-- نظام إدارة المأموريات الميدانية وحوكمتها - وزارة الصحة والسكان المصرية
-- البيانات التجريبية والتأسيسية الكاملة (Comprehensive Seed Data)
-- =========================================================================

-- 1. بذر المحافظات الـ 27 الحقيقية لجمهورية مصر العربية
INSERT INTO governorates (id, code, name, region) VALUES
('gov-cairo', 'CAI', 'القاهرة', 'القاهرة الكبرى'),
('gov-giza', 'GIZ', 'الجيزة', 'القاهرة الكبرى'),
('gov-alex', 'ALX', 'الإسكندرية', 'وجه بحري'),
('gov-qalyubia', 'QAL', 'القليوبية', 'القاهرة الكبرى'),
('gov-beheira', 'BEH', 'البحيرة', 'وجه بحري'),
('gov-portsaid', 'PTS', 'بورسعيد', 'مدن القناة'),
('gov-ismailia', 'ISM', 'الإسماعيلية', 'مدن القناة'),
('gov-suez', 'SUZ', 'السويس', 'مدن القناة'),
('gov-gharbia', 'GHB', 'الغربية', 'وجه بحري'),
('gov-monufia', 'MNF', 'المنوفية', 'وجه بحري'),
('gov-dakahlia', 'DKA', 'الدقهلية', 'وجه بحري'),
('gov-sharqia', 'SHR', 'الشرقية', 'وجه بحري'),
('gov-kafrelsheikh', 'KFS', 'كفر الشيخ', 'وجه بحري'),
('gov-damietta', 'DAM', 'دمياط', 'وجه بحري'),
('gov-fayoum', 'FYM', 'الفيوم', 'شمال الصعيد'),
('gov-benisuef', 'BNS', 'بني سويف', 'شمال الصعيد'),
('gov-minya', 'MNY', 'المنيا', 'شمال الصعيد'),
('gov-assiut', 'AST', 'أسيوط', 'وسط الصعيد'),
('gov-sohag', 'SHG', 'سوهاج', 'جنوب الصعيد'),
('gov-qena', 'QNA', 'قنا', 'جنوب الصعيد'),
('gov-luxor', 'LXR', 'الأقصر', 'جنوب الصعيد'),
('gov-aswan', 'ASW', 'أسوان', 'جنوب الصعيد'),
('gov-redsea', 'RSC', 'البحر الأحمر', 'حدودية'),
('gov-newvalley', 'WAD', 'الوادي الجديد', 'حدودية'),
('gov-matrouh', 'MAT', 'مطروح', 'حدودية'),
('gov-sinai-north', 'NSI', 'شمال سيناء', 'حدودية'),
('gov-sinai-south', 'SSI', 'جنوب سيناء', 'حدودية')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  region = EXCLUDED.region;

-- 2. بذر الهيكل التنظيمي المكون من 21 إدارة ورقيباً لقطاع الطب العلاجي ديوان عام الوزارة
INSERT INTO organizational_units (id, code, name, unit_type, parent_id, level, sort_order) VALUES
-- قمة القطاع
('therapeutic-sector', 'TH-SECTOR', 'رئيس قطاع الطب العلاجي', 'sector', NULL, 0, 1),
-- الإدارات المركزية (مستوى 1)
('central-therapeutic', 'TH-CA-CURATIVE', 'الإدارة المركزية للشئون العلاجية', 'central_administration', 'therapeutic-sector', 1, 10),
('central-plasma', 'TH-CA-BLOOD-PLASMA', 'الإدارة المركزية لعمليات الدم وتجميع البلازما', 'central_administration', 'therapeutic-sector', 1, 20),
('central-emergency', 'TH-CA-EMERGENCY-CRITICAL', 'الإدارة المركزية للطوارئ والرعاية الحرجة', 'central_administration', 'therapeutic-sector', 1, 30),
('central-specialized', 'TH-CA-SPECIALIZED-CENTERS', 'الإدارة المركزية لأمانة المراكز الطبية المتخصصة', 'central_administration', 'therapeutic-sector', 1, 40),
-- الوظائف الإشرافية الملحقة بقمة القطاع (مستوى 3 للتكليف)
('sup-caravans', 'TH-SUP-MEDICAL-CONVOYS', 'إدارة القوافل الطبية ومتابعة التشغيل', 'supervisory_unit', 'therapeutic-sector', 3, 50),
('sup-nutrition', 'TH-SUP-THERAPEUTIC-NUTRITION', 'إدارة التغذية العلاجية', 'supervisory_unit', 'therapeutic-sector', 3, 60),
-- الإدارات العامة التابعة للشئون العلاجية (مستوى 2)
('gen-medical-boards', 'TH-GA-SPECIALIZED-MEDICAL-COUNCILS', 'الإدارة العامة للمجالس الطبية المتخصصة', 'general_administration', 'central-therapeutic', 2, 101),
('gen-radiology', 'TH-GA-RADIOLOGY', 'الإدارة العامة للأشعة', 'general_administration', 'central-therapeutic', 2, 102),
('gen-dental', 'TH-GA-DENTISTRY', 'الإدارة العامة لشئون طب الأسنان', 'general_administration', 'central-therapeutic', 2, 103),
('gen-hospitals', 'TH-GA-HOSPITALS', 'الإدارة العامة لشئون المستشفيات', 'general_administration', 'central-therapeutic', 2, 104),
('gen-physiotherapy', 'TH-GA-PHYSICAL-THERAPY', 'الإدارة العامة للعلاج الطبيعي', 'general_administration', 'central-therapeutic', 2, 105),
('gen-pharmacy', 'TH-GA-PHARMACEUTICAL-AFFAIRS', 'الإدارة العامة للشئون الصيدلية', 'general_administration', 'central-therapeutic', 2, 106),
-- الإدارات العامة التابعة لعمليات الدم (مستوى 2)
('gen-blood-centers', 'TH-GA-BLOOD-CENTERS', 'الإدارة العامة لمراكز عمليات الدم', 'general_administration', 'central-plasma', 2, 201),
('gen-plasma-centers', 'TH-GA-PLASMA-COLLECTION', 'الإدارة العامة لتجميع البلازما', 'general_administration', 'central-plasma', 2, 202),
('gen-standards-eval', 'TH-GA-STANDARDS-EVAL-OPS', 'الإدارة العامة للمعايير والتقييم الفني ومتابعة التشغيل', 'general_administration', 'central-plasma', 2, 203),
-- الإدارات العامة التابعة للطوارئ والرعاية الحرجة (مستوى 2)
('gen-health-mobilization', 'TH-GA-HEALTH-MOBILIZATION', 'الإدارة العامة للتعبئة الصحية', 'general_administration', 'central-emergency', 2, 301),
('gen-operations-run', 'TH-GA-OPERATIONS', 'الإدارة العامة للتشغيل والعمليات', 'general_administration', 'central-emergency', 2, 302),
('gen-emergency-special', 'TH-GA-EMERGENCY-CRITICAL-SPECIALTIES', 'الإدارة العامة للطوارئ والتخصصات الطبية الحرجة', 'general_administration', 'central-emergency', 2, 303),
-- الإدارات العامة التابعة لأمانة المراكز المتخصصة (مستوى 2)
('gen-specialized-care', 'TH-GA-SPECIALIZED-MEDICAL-CARE', 'الإدارة العامة للرعاية الطبية المتخصصة', 'general_administration', 'central-specialized', 2, 401),
('gen-fin-admin', 'TH-GA-FINANCE-ADMIN', 'الإدارة العامة للشئون المالية والإدارية', 'general_administration', 'central-specialized', 2, 402)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  unit_type = EXCLUDED.unit_type,
  parent_id = EXCLUDED.parent_id,
  level = EXCLUDED.level,
  sort_order = EXCLUDED.sort_order;

-- 3. بذر الـ 51 منشأة طبية وصيدلانية وإمداد تمويني حقيقية بكامل إحداثياتها وتفاصيلها الجغرافية
INSERT INTO facilities (id, name, facility_type, address, latitude, longitude, governorate_id, org_unit_id, is_active) VALUES
-- المستشفيات (34)
('fac-real-1', 'مستشفى معهد ناصر للبحوث والعلاج', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'كورنيش النيل، روض الفرج، شبرا، القاهرة', 30.07830000, 31.23390000, 'gov-cairo', 'gen-specialized-care', TRUE),
('fac-real-2', 'مستشفى أم المصريين العام', 'مستشفى عام', 'شارع ربيع الجيزي، الجيزة', 30.01350000, 31.21440000, 'gov-giza', 'gen-hospitals', TRUE),
('fac-real-3', 'مستشفى المنيرة العام', 'مستشفى عام', 'شارع نوبار، السيدة زينب، القاهرة', 30.03360000, 31.23840000, 'gov-cairo', 'gen-hospitals', TRUE),
('fac-real-4', 'مستشفى أحمد ماهر التعليمي', 'مستشفى تعليمي', 'شارع بورسعيد، باب الخلق، القاهرة', 30.04160000, 31.25360000, 'gov-cairo', 'gen-hospitals', TRUE),
('fac-real-5', 'مستشفى الشيخ زايد التخصصي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'المحور المركزي، مدينة الشيخ زايد، الجيزة', 30.04830000, 30.98560000, 'gov-giza', 'gen-specialized-care', TRUE),
('fac-real-6', 'مستشفى القاهرة الجديدة العام', 'مستشفى عام', 'شارع الشباب، التجمع الثالث، القاهرة الجديدة', 30.00760000, 31.44680000, 'gov-cairo', 'gen-hospitals', TRUE),
('fac-real-7', 'مستشفى الهلال لجراحة العظام', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'شارع رمسيس، وسط البلد، القاهرة', 30.06200000, 31.24800000, 'gov-cairo', 'gen-specialized-care', TRUE),
('fac-real-8', 'مستشفى كرموز العمالي', 'مستشفى تأمين صحي', 'شارع ستفان كرموز، الإسكندرية', 31.18950000, 29.91440000, 'gov-alex', 'gen-hospitals', TRUE),
('fac-real-9', 'مستشفى السلام بورسعيد العام', 'مستشفى (الهيئة العامة للرعاية الصحية)', 'شارع مصطفى كامل، بورسعيد', 31.26120000, 32.30210000, 'gov-portsaid', 'gen-hospitals', TRUE),
('fac-real-10', 'مستشفى دمنهور التعليمي', 'مستشفى تعليمي', 'شارع الروضة، دمنهور، البحيرة', 31.03750000, 30.46940000, 'gov-beheira', 'gen-hospitals', TRUE),
('fac-real-11', 'مستشفى رأس التين العام', 'مستشفى عام', 'شارع الأنفوشي، الجمرك، الإسكندرية', 31.20640000, 29.87890000, 'gov-alex', 'gen-hospitals', TRUE),
('fac-real-12', 'مستشفى بنها التعليمي', 'مستشفى تعليمي', 'شارع سعد زغلول، بنها، القليوبية', 30.46110000, 31.18610000, 'gov-qalyubia', 'gen-hospitals', TRUE),
('fac-real-13', 'مستشفى النصر التخصصي للأطفال', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'شارع الاستاد، العرب، بورسعيد', 31.25890000, 32.28440000, 'gov-portsaid', 'gen-specialized-care', TRUE),
('fac-real-14', 'مجمع الإسماعيلية الطبي', 'مستشفى (الهيئة العامة للرعاية الصحية)', 'شارع صبري مبدي، حي ثالث، الإسماعيلية', 30.60110000, 32.27440000, 'gov-ismailia', 'gen-hospitals', TRUE),
('fac-real-15', 'مستشفى السويس العام', 'مستشفى عام', 'شارع الجيش، السويس', 29.97390000, 32.52610000, 'gov-suez', 'gen-hospitals', TRUE),
('fac-real-16', 'مستشفى المنشاوي العام', 'مستشفى عام', 'شارع مدرسة الصنايع، طنطا، الغربية', 30.78360000, 30.99640000, 'gov-gharbia', 'gen-hospitals', TRUE),
('fac-real-17', 'مستشفى شبين الكوم التعليمي', 'مستشفى تعليمي', 'شارع جمال عبد الناصر، شبين الكوم، المنوفية', 30.55830000, 31.00890000, 'gov-monufia', 'gen-hospitals', TRUE),
('fac-real-18', 'مستشفى المنصورة الدولي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'شارع عبد السلام عارف، المنصورة، الدقهلية', 31.03610000, 31.37890000, 'gov-dakahlia', 'gen-specialized-care', TRUE),
('fac-real-19', 'مستشفى الأحرار التعليمي', 'مستشفى تعليمي', 'طريق الأحرار، الزقازيق، الشرقية', 30.56940000, 31.50250000, 'gov-sharqia', 'gen-hospitals', TRUE),
('fac-real-20', 'مستشفى كفر الشيخ العام', 'مستشفى عام', 'شارع الجيش، كفر الشيخ', 31.10830000, 30.94420000, 'gov-kafrelsheikh', 'gen-hospitals', TRUE),
('fac-real-21', 'مستشفى دمياط التخصصي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'شارع كورنيش النيل، الأعصر، دمياط', 31.41720000, 31.81440000, 'gov-damietta', 'gen-specialized-care', TRUE),
('fac-real-22', 'مستشفى الفيوم العام', 'مستشفى عام', 'شارع النبوي المهندس، الفيوم', 29.30890000, 30.84210000, 'gov-fayoum', 'gen-hospitals', TRUE),
('fac-real-23', 'مستشفى بني سويف التخصصي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'شارع الروضة، بني سويف', 29.07440000, 31.09780000, 'gov-benisuef', 'gen-specialized-care', TRUE),
('fac-real-24', 'مستشفى ملوي التخصصي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'شارع المجيدي، ملوي، المنيا', 27.73120000, 30.84220000, 'gov-minya', 'gen-specialized-care', TRUE),
('fac-real-25', 'مستشفى أسيوط العام', 'مستشفى عام', 'شارع الجلاء، أسيوط', 27.18030000, 31.18940000, 'gov-assiut', 'gen-hospitals', TRUE),
('fac-real-26', 'مستشفى سوهاج التعليمي', 'مستشفى تعليمي', 'شارع الكورنيش الشرقي، سوهاج', 26.55640000, 31.69610000, 'gov-sohag', 'gen-hospitals', TRUE),
('fac-real-27', 'مستشفى قنا العام', 'مستشفى عام', 'شارع معبد دندرة، قنا', 26.16120000, 32.72440000, 'gov-qena', 'gen-hospitals', TRUE),
('fac-real-28', 'مستشفى الكرنك الدولي', 'مستشفى (الهيئة العامة للرعاية الصحية)', 'شارع كورنيش النيل، الأقصر', 25.71120000, 32.65120000, 'gov-luxor', 'gen-hospitals', TRUE),
('fac-real-29', 'مستشفى أسوان التخصصي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'حي الصداقة الجديدة، أسوان', 24.08890000, 32.89890000, 'gov-aswan', 'gen-specialized-care', TRUE),
('fac-real-30', 'مستشفى الغردقة العام', 'مستشفى عام', 'شارع المستشفى، الدهار، الغردقة، البحر الأحمر', 27.25890000, 33.81120000, 'gov-redsea', 'gen-hospitals', TRUE),
('fac-real-31', 'مستشفى الخارجة التخصصي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'شارع جمال عبد الناصر، الخارجة، الوادي الجديد', 25.43890000, 30.54890000, 'gov-newvalley', 'gen-specialized-care', TRUE),
('fac-real-32', 'مستشفى العلمين النموذجي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'طريق إسكندرية مطروح الساحلي، العلمين، مطروح', 30.82440000, 28.95440000, 'gov-matrouh', 'gen-specialized-care', TRUE),
('fac-real-33', 'مستشفى العريش العام', 'مستشفى عام', 'شارع الجيش، العريش، شمال سيناء', 31.13120000, 33.80120000, 'gov-sinai-north', 'gen-hospitals', TRUE),
('fac-real-34', 'مستشفى شرم الشيخ الدولي', 'مستشفى تخصصي (أمانة المراكز الطبية)', 'حي النور، شرم الشيخ، جنوب سيناء', 27.91560000, 34.33120000, 'gov-sinai-south', 'gen-specialized-care', TRUE),

-- وحدات الرعاية الأولية وطب الأسرة (10)
('fac-phc-1', 'مركز طبي النزهة الجديدة الشامل', 'مركز رعاية صحية أولية وطب أسرة', 'شارع طه حسين، النزهة الجديدة، القاهرة', 30.12110000, 31.36540000, 'gov-cairo', 'gen-hospitals', TRUE),
('fac-phc-2', 'مركز طبي التجمع الأول المطور', 'مركز رعاية صحية أولية وطب أسرة', 'بجوار سنترال التجمع الأول، القاهرة الجديدة، القاهرة', 30.05220000, 31.45890000, 'gov-cairo', 'gen-hospitals', TRUE),
('fac-phc-3', 'مركز صحة أسرة الشيخ زايد المتميز', 'مركز رعاية صحية أولية وطب أسرة', 'الحي الأول، مدينة الشيخ زايد، الجيزة', 30.03840000, 30.99890000, 'gov-giza', 'gen-hospitals', TRUE),
('fac-phc-4', 'مركز صحة أسرة المطرية النموذجي', 'مركز رعاية صحية أولية وطب أسرة', 'شارع المطراوي، المطرية، القاهرة', 30.12640000, 31.30210000, 'gov-cairo', 'gen-hospitals', TRUE),
('fac-phc-5', 'مركز طبي المحروسة المطور', 'مركز رعاية صحية أولية وطب أسرة', 'قرية المحروسة، الخانكة، القليوبية', 30.16110000, 31.25890000, 'gov-qalyubia', 'gen-hospitals', TRUE),
('fac-phc-6', 'مركز صحة أسرة جليم النموذجي', 'مركز رعاية صحية أولية وطب أسرة', 'شارع جليم، الرمل، الإسكندرية', 31.23890000, 29.97210000, 'gov-alex', 'gen-hospitals', TRUE),
('fac-phc-7', 'مركز رعاية طفل العرب العام', 'مركز رعاية صحية أولية وطب أسرة', 'شارع النصر، حي العرب، بورسعيد', 31.25440000, 32.29890000, 'gov-portsaid', 'gen-hospitals', TRUE),
('fac-phc-8', 'مركز طبي الحوامدية التخصصي', 'مركز رعاية صحية أولية وطب أسرة', 'طريق الحوامدية الزراعي، الحوامدية، الجيزة', 29.89440000, 31.26890000, 'gov-giza', 'gen-hospitals', TRUE),
('fac-phc-9', 'مركز طب أسرة غرب أسوان النموذجي', 'مركز رعاية صحية أولية وطب أسرة', 'قرية غرب أسوان، أسوان', 24.11120000, 32.86890000, 'gov-aswan', 'gen-hospitals', TRUE),
('fac-phc-10', 'مركز طب أسرة الشيخ شحات', 'مركز رعاية صحية أولية وطب أسرة', 'منطقة الشيخ شحات، قنا', 26.15890000, 32.73120000, 'gov-qena', 'gen-hospitals', TRUE),

-- مستودعات ومخازن التموين الطبي المركزي الحساسة (7)
('fac-war-1', 'المخزن الإقليمي للتموين الطبي بالعباسية', 'مخزن تموين طبي وإمداد دوائي رئيسي', 'شارع السكة البيضاء، العباسية، القاهرة', 30.06840000, 31.27890000, 'gov-cairo', 'gen-pharmacy', TRUE),
('fac-war-2', 'مخزن المستلزمات الطبية المركزي بالدقي', 'مخزن تموين طبي وإمداد دوائي رئيسي', 'شارع التحرير، الدقي، الجيزة', 30.04010000, 31.20520000, 'gov-giza', 'gen-pharmacy', TRUE),
('fac-war-3', 'مخازن الإمداد الدوائي الإقليمية بالعامرية', 'مخزن تموين طبي وإمداد دوائي رئيسي', 'المنطقة الصناعية بالعامرية، الإسكندرية', 31.02640000, 29.81120000, 'gov-alex', 'gen-pharmacy', TRUE),
('fac-war-4', 'مخزن الطعوم واللقاحات المركزي بالبطل أحمد عبد العزيز', 'مخزن تموين طبي وإمداد دوائي رئيسي', 'شارع البطل أحمد عبد العزيز، المهندسين، الجيزة', 30.04890000, 31.21120000, 'gov-giza', 'gen-pharmacy', TRUE),
('fac-war-5', 'مخزن الإمداد الدوائي الإقليمي بأسيوط', 'مخزن تموين طبي وإمداد دوائي رئيسي', 'منطقة الوليدية، أسيوط', 27.18440000, 31.18120000, 'gov-assiut', 'gen-pharmacy', TRUE),
('fac-war-6', 'مخزن التموين الطبي المركزي ببنها', 'مخزن تموين طبي وإمداد دوائي رئيسي', 'شارع فريد ندا، بنها، القليوبية', 30.45890000, 31.18210000, 'gov-qalyubia', 'gen-pharmacy', TRUE),
('fac-war-7', 'مخزن الإمداد الطبي ببورسعيد المطور', 'مخزن تموين طبي وإمداد دوائي رئيسي', 'شارع عاطف السادات، بورسعيد', 31.25120000, 32.29120000, 'gov-portsaid', 'gen-pharmacy', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  facility_type = EXCLUDED.facility_type,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  governorate_id = EXCLUDED.governorate_id,
  org_unit_id = EXCLUDED.org_unit_id,
  is_active = EXCLUDED.is_active;

-- 4. بذر الـ 12 وحدة تصحيح إدارية المعتمدة للمخالفات
INSERT INTO correction_units (name, sort_order) VALUES
('إدارة الصيدلة والمستلزمات', 10),
('إدارة صيانة الأجهزة الطبية', 20),
('إدارة صيانة التكييفات والغازات', 30),
('إدارة مكافحة العدوى', 40),
('إدارة الجودة والاعتماد', 50),
('إدارة السلامة والصحة المهنية', 60),
('إدارة التراخيص الطبية', 70),
('إدارة متابعة غياب الأطقم والالتزام', 80),
('إدارة الشؤون القانونية والتحقيقات', 90),
('إدارة الأمن والسلامة المهنية', 100),
('إدارة التغذية والمطابخ', 110),
('إدارة التخلص من النفايات الطبية الخطرة', 120)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order;

-- 5. بذر صلاحيات الأدوار الافتراضية حوكمة الصفحات ديناميكياً
INSERT INTO role_permissions (role, allowed_pages) VALUES
('superadmin', ARRAY['dashboard', 'missions', 'violations', 'facilities', 'users', 'settings', 'checklists']),
('techadmin', ARRAY['dashboard', 'facilities', 'users', 'checklists', 'settings']),
('central', ARRAY['dashboard', 'missions', 'violations', 'facilities']),
('generalmanager', ARRAY['dashboard', 'missions', 'violations', 'facilities']),
('creator', ARRAY['dashboard', 'missions']),
('financial', ARRAY['dashboard', 'missions']),
('inspector', ARRAY['dashboard', 'missions', 'violations'])
ON CONFLICT (role) DO UPDATE SET
  allowed_pages = EXCLUDED.allowed_pages;

-- 6. بذر الكوادر الطبية والمستخدمين لتوافق الحسابات التجريبية (Demo Accounts Linked)
INSERT INTO users (id, full_name, job_title, level, department, email, phone, financial_code, org_unit_id, is_active) VALUES
-- حساب سوبر أدمن
('demo-u1', 'أحمد محمود العشري', 'مدير عام المتابعة والرقابة', 1, 'ديوان عام وزارة الصحة والسكان', 'admin@admin.com', '01012345678', 'FIN-100293', 'therapeutic-sector', TRUE),
-- حساب المفتش
('demo-u2', 'سارة خالد البشري', 'مفتش منشآت صحية ومكافحة عدوى', 7, 'إدارة مكافحة العدوى', 'inspector@inspector.com', '01122334455', 'FIN-200384', 'central-therapeutic', TRUE),
-- حساب المشرف
('demo-u3', 'محمد علي سليم', 'مشرف ميداني ومتابع تشغيل', 3, 'إدارة الصيدلة والمستلزمات', 'supervisor@supervisor.com', '01234567890', 'FIN-300482', 'central-therapeutic', TRUE),
-- حساب الدعم الفني التقني الفائق
('demo-u4', 'المهندس عمرو عبد العزيز', 'مدير الإدارة التقنية والدعم الفني', 0, 'نظم المعلومات والتحول الرقمي', 'techadmin@mohp.gov.eg', '01222222222', 'FIN-000001', 'therapeutic-sector', TRUE),
-- حساب مدير عام
('demo-u5', 'د. ميرفت أحمد الجندي', 'مدير عام المستشفيات العلاجية', 3, 'الإدارة العامة للمستشفيات', 'generalmanager@mohp.gov.eg', '01033333333', 'FIN-300100', 'gen-hospitals', TRUE),
-- حساب موظف تشغيل مختص
('demo-u6', 'د. ياسر جلال المنشاوي', 'موظف تكليف وتشغيل ميداني', 4, 'قسم التشغيل والتكليف', 'creator@mohp.gov.eg', '01044444444', 'FIN-400100', 'gen-hospitals', TRUE),
-- حساب مراجع مالي
('demo-u7', 'أ. طارق عبد الحميد', 'مفتش ومراجع مالي وإداري', 5, 'الإدارة الشؤون المالية والإدارية', 'financial@mohp.gov.eg', '01055555555', 'FIN-500100', 'gen-fin-admin', TRUE)
ON CONFLICT (financial_code) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  job_title = EXCLUDED.job_title,
  level = EXCLUDED.level,
  department = EXCLUDED.department,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  org_unit_id = EXCLUDED.org_unit_id,
  is_active = EXCLUDED.is_active;
