import { Markup } from 'telegraf';

function getSuperUserIds(): number[] {
  const envSuperAdmins = (process.env.SUPER_ADMIN_ID || '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => !isNaN(id) && id > 0);

  return [837535368, 8521015752, ...envSuperAdmins];
}

export function mainMenuKeyboard(
  isAdmin: boolean = false,
  userId?: number,
  permissions: string[] = [],
) {
  // أزرار المستخدم العادي
  const userButtons = [
    [
      Markup.button.callback('📚 الملازم والمقررات', 'sm'),
      Markup.button.callback('📝 الاختبارات', 'se'),
    ],
    [
      Markup.button.callback('🔗 المصادر', 'er'),
      Markup.button.callback('ℹ️ عن البوت', 'ab'),
    ],
  ];

  const superUserIds = getSuperUserIds();
  const isSuperUser = userId !== undefined && superUserIds.includes(userId);
  const isFullAdmin = isSuperUser || permissions.includes('ALL') || (isAdmin && permissions.length === 0);

  const adminRows: any[][] = [];

  if (isFullAdmin) {
    adminRows.push([
      Markup.button.callback('📂 إدارة الملازم', 'admin_materials'),
      Markup.button.callback('📝 إدارة الامتحانات', 'admin_exams'),
    ]);
    adminRows.push([
      Markup.button.callback('📖 إدارة الكورسات', 'admin_courses'),
      Markup.button.callback('🏛️ إدارة الهيكل الجامعي', 'admin_structure'),
    ]);
    adminRows.push([
      Markup.button.callback('👥 إدارة المستخدمين', 'admin_users'),
      Markup.button.callback('🔗 إدارة المصادر الخارجية', 'admin_sources'),
    ]);
  } else if (isAdmin) {
    // بناء الأزرار ديناميكياً بحسب صلاحيات المشرف المخصص
    const granted: any[] = [];

    if (permissions.includes('MATERIALS')) {
      granted.push(Markup.button.callback('📂 إدارة الملازم', 'admin_materials'));
    }
    if (permissions.includes('EXAMS')) {
      granted.push(Markup.button.callback('📝 إدارة الامتحانات', 'admin_exams'));
    }
    if (permissions.includes('COURSES')) {
      granted.push(Markup.button.callback('📖 إدارة الكورسات', 'admin_courses'));
    }
    if (permissions.includes('STRUCTURE')) {
      granted.push(Markup.button.callback('🏛️ إدارة الهيكل الجامعي', 'admin_structure'));
    }
    if (permissions.includes('USERS')) {
      granted.push(Markup.button.callback('👥 إدارة المستخدمين', 'admin_users'));
    }
    if (permissions.includes('EXTERNAL')) {
      granted.push(Markup.button.callback('🔗 إدارة المصادر الخارجية', 'admin_sources'));
    }

    // تقسيمها إلى صفوف ثنائية
    for (let i = 0; i < granted.length; i += 2) {
      adminRows.push(granted.slice(i, i + 2));
    }
  }

  const finalButtons = [...adminRows, ...userButtons];

  return Markup.inlineKeyboard(finalButtons);
}
