import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Ahl Al-Hadith University academic seed...');

  // ============================================================
  // 1. Departments (الكليات)
  // ============================================================
  const departmentNames = [
    'كلية العلوم التطبيقية والإنسانية',
    'كلية الشريعة والقانون',
  ];

  const departments: Record<string, any> = {};

  for (const name of departmentNames) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    departments[name] = dept;
  }

  console.log('✅ Colleges (Departments) seeded');

  // ============================================================
  // 2. Levels (المستويات) - حالياً المستوى الأول والثاني
  // ============================================================
  const levelsData = [
    { number: 1, name: 'المستوى الأول' },
    { number: 2, name: 'المستوى الثاني' },
  ];

  const levels: Record<number, any> = {};

  for (const lvl of levelsData) {
    const level = await prisma.level.upsert({
      where: { number: lvl.number },
      update: { name: lvl.name },
      create: lvl,
    });
    levels[lvl.number] = level;
  }

  console.log('✅ Levels seeded (المستوى الأول والثاني)');

  // ============================================================
  // 3. Terms (الفصول الدراسية)
  // ============================================================
  const termsData = [
    { number: 1, name: 'الترم الأول' },
    { number: 2, name: 'الترم الثاني' },
  ];

  const terms: Record<number, any> = {};

  for (const trm of termsData) {
    const term = await prisma.term.upsert({
      where: { number: trm.number },
      update: { name: trm.name },
      create: trm,
    });
    terms[trm.number] = term;
  }

  console.log('✅ Terms seeded');

  // ============================================================
  // 4. Academic Years (السنوات الدراسية)
  // ============================================================
  const academicYearValues = [
    { startYear: 2024, endYear: 2025 },
    { startYear: 2025, endYear: 2026 },
    { startYear: 2026, endYear: 2027 },
  ];

  const academicYears: any[] = [];

  for (const year of academicYearValues) {
    const academicYear = await prisma.academicYear.upsert({
      where: {
        startYear_endYear: {
          startYear: year.startYear,
          endYear: year.endYear,
        },
      },
      update: {},
      create: year,
    });
    academicYears.push(academicYear);
  }

  console.log('✅ Academic years seeded');

  // ============================================================
  // 5. Tracks (التخصصات لكل كلية)
  // ============================================================
  const tracksConfig = [
    {
      college: 'كلية العلوم التطبيقية والإنسانية',
      tracks: ['تخصص الدراسات الإسلامية', 'تخصص إدارة الأعمال'],
    },
    {
      college: 'كلية الشريعة والقانون',
      tracks: ['تخصص الفقه وأصوله', 'تخصص القانون'],
    },
  ];

  const tracks: Record<string, any> = {};

  for (const item of tracksConfig) {
    const dept = departments[item.college];
    if (!dept) continue;

    for (const trackName of item.tracks) {
      const track = await prisma.track.upsert({
        where: {
          departmentId_name: {
            departmentId: dept.id,
            name: trackName,
          },
        },
        update: {},
        create: {
          name: trackName,
          departmentId: dept.id,
        },
      });
      tracks[trackName] = track;
    }
  }

  console.log('✅ Tracks (Majors) seeded');

  // ============================================================
  // 6. Sample Initial Courses & Offerings
  // ============================================================
  const initialCoursesData: Array<{
    name: string;
    college: string;
    track: string;
    levelNumber: number;
    termNumber: number;
  }> = [
    // كلية العلوم التطبيقية والإنسانية - تخصص الدراسات الإسلامية
    { name: 'علوم القرآن الكريم', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص الدراسات الإسلامية', levelNumber: 1, termNumber: 1 },
    { name: 'مصطلح الحديث 1', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص الدراسات الإسلامية', levelNumber: 1, termNumber: 1 },
    { name: 'السيرة النبوية العطرة', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص الدراسات الإسلامية', levelNumber: 1, termNumber: 1 },
    { name: 'العقيدة الإسلامية 1', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص الدراسات الإسلامية', levelNumber: 1, termNumber: 1 },
    { name: 'النحو والصرف 1', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص الدراسات الإسلامية', levelNumber: 1, termNumber: 1 },
    { name: 'تفسير آيات الأحكام', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص الدراسات الإسلامية', levelNumber: 1, termNumber: 2 },
    { name: 'أحاديث العقيدة', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص الدراسات الإسلامية', levelNumber: 1, termNumber: 2 },

    // كلية العلوم التطبيقية والإنسانية - تخصص إدارة الأعمال
    { name: 'مبادئ إدارة الأعمال', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص إدارة الأعمال', levelNumber: 1, termNumber: 1 },
    { name: 'مبادئ المحاسبة المالية 1', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص إدارة الأعمال', levelNumber: 1, termNumber: 1 },
    { name: 'مبادئ الاقتصاد الجزئي', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص إدارة الأعمال', levelNumber: 1, termNumber: 1 },
    { name: 'مهارات الحاسوب وتطبيقاته', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص إدارة الأعمال', levelNumber: 1, termNumber: 1 },
    { name: 'السلوك التنظيمي', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص إدارة الأعمال', levelNumber: 1, termNumber: 2 },
    { name: 'إدارة التسويق', college: 'كلية العلوم التطبيقية والإنسانية', track: 'تخصص إدارة الأعمال', levelNumber: 1, termNumber: 2 },

    // كلية الشريعة والقانون - تخصص الفقه وأصوله
    { name: 'المدخل إلى الفقه الإسلامي', college: 'كلية الشريعة والقانون', track: 'تخصص الفقه وأصوله', levelNumber: 1, termNumber: 1 },
    { name: 'أصول الفقه 1', college: 'كلية الشريعة والقانون', track: 'تخصص الفقه وأصوله', levelNumber: 1, termNumber: 1 },
    { name: 'فقه العبادات 1', college: 'كلية الشريعة والقانون', track: 'تخصص الفقه وأصوله', levelNumber: 1, termNumber: 1 },
    { name: 'تاريخ التشريع الإسلامي', college: 'كلية الشريعة والقانون', track: 'تخصص الفقه وأصوله', levelNumber: 1, termNumber: 1 },
    { name: 'فقه العبادات 2', college: 'كلية الشريعة والقانون', track: 'تخصص الفقه وأصوله', levelNumber: 1, termNumber: 2 },
    { name: 'القواعد الفقهية 1', college: 'كلية الشريعة والقانون', track: 'تخصص الفقه وأصوله', levelNumber: 1, termNumber: 2 },

    // كلية الشريعة والقانون - تخصص القانون
    { name: 'المدخل إلى علم القانون', college: 'كلية الشريعة والقانون', track: 'تخصص القانون', levelNumber: 1, termNumber: 1 },
    { name: 'القانون الدستوري والنظم السياسية', college: 'كلية الشريعة والقانون', track: 'تخصص القانون', levelNumber: 1, termNumber: 1 },
    { name: 'تاريخ القانون', college: 'كلية الشريعة والقانون', track: 'تخصص القانون', levelNumber: 1, termNumber: 1 },
    { name: 'مبادئ علم الإجرام والعقاب', college: 'كلية الشريعة والقانون', track: 'تخصص القانون', levelNumber: 1, termNumber: 1 },
    { name: 'القانون المدني (مصادر الالتزام)', college: 'كلية الشريعة والقانون', track: 'تخصص القانون', levelNumber: 1, termNumber: 2 },
    { name: 'القانون الإداري 1', college: 'كلية الشريعة والقانون', track: 'تخصص القانون', levelNumber: 1, termNumber: 2 },
  ];

  const currentYear = academicYears[0];

  for (const item of initialCoursesData) {
    let course = await prisma.course.findFirst({
      where: { name: item.name },
    });

    if (!course) {
      course = await prisma.course.create({
        data: { name: item.name },
      });
    }

    const dept = departments[item.college];
    const trk = tracks[item.track];
    const lvl = levels[item.levelNumber];
    const trm = terms[item.termNumber];

    if (dept && trk && lvl && trm && currentYear) {
      const existingOffering = await prisma.courseOffering.findFirst({
        where: {
          courseId: course.id,
          departmentId: dept.id,
          trackId: trk.id,
          levelId: lvl.id,
          termId: trm.id,
          academicYearId: currentYear.id,
        },
      });

      if (!existingOffering) {
        await prisma.courseOffering.create({
          data: {
            courseId: course.id,
            departmentId: dept.id,
            trackId: trk.id,
            levelId: lvl.id,
            termId: trm.id,
            academicYearId: currentYear.id,
          },
        });
      }
    }
  }

  console.log('✅ Initial foundational courses & offerings seeded');
  console.log('🎉 Seed completed successfully for جامعة أهل الحديث!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
