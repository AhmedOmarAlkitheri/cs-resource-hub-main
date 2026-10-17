import { Update, Action, Ctx } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

import { UsersService } from 'src/user/services/user.service';

@Update()
export class AdminExamsHandler {
  constructor(private readonly usersService: UsersService) {}

  @Action('admin_exams')
  async handleAdminExams(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const telegramId = String(ctx.from?.id);
    const hasPerm = await this.usersService.hasPermission(telegramId, 'EXAMS');
    if (!hasPerm) {
      await ctx.answerCbQuery('⛔ ليس لديك صلاحية لإدارة الامتحانات والاختبارات.', {
        show_alert: true,
      });
      return;
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ إضافة امتحان', 'ae'),
        Markup.button.callback('🗑️ حذف امتحان', 'de'),
      ],
      [Markup.button.callback('🔙 العودة للقائمة الرئيسية', 'main_menu')],
    ]);

    await ctx.editMessageText(
      '📝 **قسم إدارة الامتحانات والاختبارات:**\nاختر الإجراء المطلوب:',
      {
        parse_mode: 'Markdown',
        ...keyboard,
      },
    );
  }
}
