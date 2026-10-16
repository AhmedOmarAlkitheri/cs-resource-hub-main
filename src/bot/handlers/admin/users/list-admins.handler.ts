import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { UsersService } from 'src/user/services/user.service';

@Update()
export class ListAdminsHandler {
  constructor(private readonly usersService: UsersService) {}

  @Action('admin_list_admins')
  async showAdminsAndStats(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const allUsers = await this.usersService.getAll();
    const admins = allUsers.filter((u) => u.isAdmin);
    const regularUsersCount = allUsers.length - admins.length;

    let text =
      '📊 <b>إحصائيات المستخدمين والمشرفين</b>\n\n' +
      `👥 <b>إجمالي المستخدمين النشطين:</b> ${allUsers.length}\n` +
      `👤 <b>المستخدمون العاديون:</b> ${regularUsersCount}\n` +
      `🛡️ <b>عدد المشرفين (Admins):</b> ${admins.length}\n\n` +
      '👑 <b>قائمة المشرفين الحاليين:</b>\n';

    if (admins.length === 0) {
      text += '<i>لا يوجد مشرفين إضافيين مسجلين حالياً.</i>';
    } else {
      admins.forEach((admin, index) => {
        const name =
          [admin.firstName, admin.lastName].filter(Boolean).join(' ') ||
          'بدون اسم';
        const userTag = admin.username ? `@${admin.username}` : 'لا يوجد';
        text +=
          `\n${index + 1}. <b>${this.escapeHtml(name)}</b>\n` +
          `   • المعرّف: <code>${admin.telegramId}</code>\n` +
          `   • اليوزر: ${userTag}\n`;
      });
    }

    const demoteButtons = admins.map((admin) => [
      Markup.button.callback(
        `⬇️ تنزيل المشرف: ${admin.username ? '@' + admin.username : admin.telegramId}`,
        `admin_quick_demote/${admin.telegramId}`,
      ),
    ]);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        ...demoteButtons,
        [Markup.button.callback('🔙 قسم إدارة المستخدمين', 'admin_users')],
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
      ]),
    });
  }

  @Action(/^admin_quick_demote\/(.+)$/)
  async handleQuickDemote(@Ctx() ctx: Context): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const telegramId = callbackQuery.data.split('/')[1];
    const user = await this.usersService.getByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('المستخدم غير موجود', { show_alert: true });
      return;
    }

    await this.usersService.updateRole(telegramId, false);
    await ctx.answerCbQuery('تم تنزيل المشرف بنجاح');

    // Refresh view
    await this.showAdminsAndStats(ctx);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
