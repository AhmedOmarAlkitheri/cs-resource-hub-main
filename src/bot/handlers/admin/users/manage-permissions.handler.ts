import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UsersService } from 'src/user/services/user.service';
import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';

export const PERMISSION_LABELS: Record<string, string> = {
  COURSES: '📚 إدارة المقررات والكورسات',
  MATERIALS: '📑 إدارة الملازم والمذكرات',
  EXAMS: '📝 إدارة الامتحانات والاختبارات',
  EXTERNAL: '🌐 المصادر الخارجية والباحث الذكي',
  STRUCTURE: '🏛️ الهيكل الجامعي (السنوات والكليات)',
  USERS: '👥 إدارة المستخدمين والصلاحيات',
};

@Update()
export class ManagePermissionsHandler {
  constructor(
    private readonly usersService: UsersService,
    private readonly botEventService: BotEventService,
  ) {}

  @Action('admin_manage_permissions')
  async start(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const telegramId = String(ctx.from?.id);
    const superAdminId = process.env.SUPER_ADMIN_ID;

    // التحقق من صلاحية إدارة المستخدمين أو المشرف العام
    const canManage =
      (superAdminId && telegramId === String(superAdminId)) ||
      (await this.usersService.hasPermission(telegramId, 'USERS'));

    if (!canManage) {
      await ctx.answerCbQuery(
        '⛔ عذراً، لا تملك صلاحية إدارة المستخدمين والصلاحيات.',
        { show_alert: true },
      );
      return;
    }

    this.botEventService.set({
      userId: Number(telegramId),
      chatId: String(ctx.chat?.id),
      messageId: ctx.callbackQuery?.message?.message_id || 0,
      event: BotEventType.WAITING_USER_PERMISSIONS_SEARCH,
    });

    await ctx.reply(
      '🛡️ <b>إدارة الصلاحيات المخصصة</b>\n\n' +
        'أرسل <b>معرف المستخدم (Telegram ID)</b> أو <b>اسم المستخدم (@username)</b> لتعيين صلاحياته المخصصة:',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 رجوع لإدارة المستخدمين', callback_data: 'admin_users' }],
          ],
        },
      },
    );
  }

  // عرض بطاقة الصلاحيات
  async showPermissionsCard(
    ctx: Context,
    user: any,
    isEdit = false,
  ): Promise<void> {
    const perms: string[] = (user.permissions as string[]) || [];
    const isFullAdmin = perms.includes('ALL');

    const keyboard: any[][] = [];

    // أزرار التبديل لكل صلاحية
    for (const [key, label] of Object.entries(PERMISSION_LABELS)) {
      const active = isFullAdmin || perms.includes(key);
      const icon = active ? '✅' : '❌';
      keyboard.push([
        {
          text: `${icon} ${label}`,
          callback_data: `perm_toggle/${user.id}/${key}`,
        },
      ]);
    }

    // أزرار الإجراءات السريعة
    keyboard.push([
      {
        text: isFullAdmin
          ? '👑 يملك كافة الصلاحيات (مفعل)'
          : '👑 منح كافة الصلاحيات (كل شيء)',
        callback_data: `perm_all/${user.id}`,
      },
    ]);

    keyboard.push([
      {
        text: '❌ سحب كافة الصلاحيات (إلغاء الإشراف)',
        callback_data: `perm_none/${user.id}`,
      },
    ]);

    keyboard.push([
      { text: '🔙 رجوع لإدارة المستخدمين', callback_data: 'admin_users' },
    ]);

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'بدون اسم';
    const username = user.username ? `@${user.username}` : 'بدون معرف';

    const text =
      '🛡️ <b>لوحة الصلاحيات المخصصة للمشرف</b>\n\n' +
      `👤 <b>الاسم:</b> ${name}\n` +
      `🔖 <b>المعرف:</b> ${username}\n` +
      `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
      `🎖️ <b>الحالة:</b> ${user.isAdmin ? (isFullAdmin ? 'مشرف عام (كل الصلاحيات)' : 'مشرف مخصص') : 'مستخدم عادي'}\n\n` +
      '<i>اضغط على أي صلاحية أدناه لتفعيلها أو إلغائها فورياً:</i>';

    if (isEdit) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  }

  // تبديل صلاحية فردية
  @Action(/^perm_toggle\/(\d+)\/([A-Z_]+)$/)
  async togglePermission(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const data = (ctx.callbackQuery as any)?.data || '';
    const match = data.match(/^perm_toggle\/(\d+)\/([A-Z_]+)$/);
    if (!match) return;

    const dbUserId = Number(match[1]);
    const permKey = match[2];

    const allUsers = await this.usersService.getAll();
    const targetUser = allUsers.find((u) => u.id === dbUserId);
    if (!targetUser) {
      await ctx.answerCbQuery('المستخدم غير موجود.', { show_alert: true });
      return;
    }

    let currentPerms: string[] = (targetUser.permissions as string[]) || [];

    // إذا كان يملك ALL وأراد تبديل واحدة، نحول ALL إلى باقي الصلاحيات عدا هذه
    if (currentPerms.includes('ALL')) {
      currentPerms = Object.keys(PERMISSION_LABELS).filter((k) => k !== permKey);
    } else if (currentPerms.includes(permKey)) {
      currentPerms = currentPerms.filter((p) => p !== permKey);
    } else {
      currentPerms.push(permKey);
    }

    const updated = await this.usersService.updatePermissions(
      targetUser.telegramId,
      currentPerms,
    );

    await this.showPermissionsCard(ctx, updated, true);
  }

  // منح كافة الصلاحيات
  @Action(/^perm_all\/(\d+)$/)
  async grantAll(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery('تم منح كافة الصلاحيات بنجاح!');
    const data = (ctx.callbackQuery as any)?.data || '';
    const match = data.match(/^perm_all\/(\d+)$/);
    if (!match) return;

    const dbUserId = Number(match[1]);
    const allUsers = await this.usersService.getAll();
    const targetUser = allUsers.find((u) => u.id === dbUserId);
    if (!targetUser) return;

    const updated = await this.usersService.updatePermissions(
      targetUser.telegramId,
      ['ALL'],
    );
    await this.showPermissionsCard(ctx, updated, true);
  }

  // سحب كافة الصلاحيات
  @Action(/^perm_none\/(\d+)$/)
  async revokeAll(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery('تم سحب كافة الصلاحيات!');
    const data = (ctx.callbackQuery as any)?.data || '';
    const match = data.match(/^perm_none\/(\d+)$/);
    if (!match) return;

    const dbUserId = Number(match[1]);
    const allUsers = await this.usersService.getAll();
    const targetUser = allUsers.find((u) => u.id === dbUserId);
    if (!targetUser) return;

    const updated = await this.usersService.updatePermissions(
      targetUser.telegramId,
      [],
    );
    await this.usersService.updateRole(targetUser.telegramId, false);
    await this.showPermissionsCard(ctx, updated, true);
  }
}
