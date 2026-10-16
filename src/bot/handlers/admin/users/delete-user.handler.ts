import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { UsersService } from 'src/user/services/user.service';
import { BotEventService, BotEventType } from 'src/bot/services/bot-event.service';
import { BotEventConflictService } from 'src/bot/services/bot-conflict.service';

@Update()
export class DeleteUserHandler {
  constructor(
    private readonly usersService: UsersService,
    private readonly botEventService: BotEventService,
    private readonly botEventConflictService: BotEventConflictService,
  ) {}

  // ============================================================
  // بدء عملية حذف/حظر مستخدم
  // ============================================================

  @Action('admin_delete_user')
  async start(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    const existingEvent = this.botEventService.get(userId);
    if (existingEvent) {
      await this.botEventConflictService.showConflict(ctx, existingEvent);
      return;
    }

    const message = await ctx.reply(
      '❌ <b>حذف / حظر مستخدم من البوت</b>\n\n' +
        'أرسل <b>Username</b> المستخدم أو <b>Telegram ID</b>:\n\n' +
        'أمثلة:\n' +
        '• <code>@username</code>\n' +
        '• <code>123456789</code>',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 إلغاء والعودة', 'admin_users')],
        ]),
      },
    );

    this.botEventService.set({
      userId,
      event: BotEventType.WAITING_DELETE_USER,
      messageId: message.message_id,
      chatId: String(ctx.chat?.id ?? ''),
    });
  }

  // ============================================================
  // استقبال المعرّف أو اليوزر نيم
  // ============================================================

  async handleInput(@Ctx() ctx: Context): Promise<void> {
    const adminId = ctx.from?.id;
    if (!adminId) return;

    if (!ctx.message || !('text' in ctx.message)) return;

    const event = this.botEventService.get(adminId);
    if (!event || event.event !== BotEventType.WAITING_DELETE_USER) return;

    let input = ctx.message.text.trim();
    if (input.startsWith('@')) {
      input = input.substring(1);
    }
    input = input.trim();

    if (!input) {
      await ctx.reply('❌ يرجى إرسال Username أو Telegram ID صالح.');
      return;
    }

    const isNumericId = /^\d+$/.test(input);
    const user = isNumericId
      ? await this.usersService.getByTelegramId(input)
      : await this.usersService.getByUsername(input);

    if (!user) {
      this.botEventService.delete(adminId);
      await ctx.reply(
        `❌ لم يتم العثور على مستخدم بـ <b>${
          isNumericId ? 'ID' : 'Username'
        }: ${this.escapeHtml(input)}</b> في قاعدة البيانات.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 قسم إدارة المستخدمين', 'admin_users')],
          ]),
        },
      );
      return;
    }

    this.botEventService.delete(adminId);

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'غير معروف';

    await ctx.reply(
      '⚠️ <b>تأكيد حذف / حظر المستخدم</b>\n\n' +
        `👤 <b>الاسم:</b> ${this.escapeHtml(name)}\n` +
        `🏷️ <b>Username:</b> ${user.username ? '@' + this.escapeHtml(user.username) : 'لا يوجد'}\n` +
        `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
        `🛡️ <b>الرتبة:</b> ${user.isAdmin ? 'مشرف (Admin)' : 'مستخدم عادي'}\n\n` +
        'هل أنت متأكد من حذف هذا الحساب؟',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '⚠️ نعم، احذف المستخدم',
              `admin_del_u_exec/${user.telegramId}`,
            ),
          ],
          [Markup.button.callback('❌ إلغاء وتراجع', 'admin_users')],
        ]),
      },
    );
  }

  // ============================================================
  // تنفيذ الحذف
  // ============================================================

  @Action(/^admin_del_u_exec\/(.+)$/)
  async executeDelete(@Ctx() ctx: Context): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const telegramId = callbackQuery.data.split('/')[1];

    try {
      await this.usersService.delete(telegramId);
      await ctx.answerCbQuery('تم حذف المستخدم');

      await ctx.editMessageText(
        '✅ <b>تم حذف المستخدم بنجاح!</b>\n\n' +
          `🆔 <b>Telegram ID:</b> <code>${telegramId}</code>\n\n` +
          'تم تعطيل الحساب من الوصول للبوت.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('👥 إدارة المستخدمين', 'admin_users')],
            [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
          ]),
        },
      );
    } catch (error) {
      console.error('Failed to delete user:', error);
      await ctx.answerCbQuery('فشل الحذف');
      await ctx.editMessageText('❌ حدث خطأ أثناء محاولة حذف المستخدم.', {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 رجوع', 'admin_users')],
        ]),
      });
    }
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
