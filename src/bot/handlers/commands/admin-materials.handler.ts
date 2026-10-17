import { Update, Action, Ctx } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

import { UsersService } from 'src/user/services/user.service';

@Update()
export class AdminMaterialsHandler {
  constructor(private readonly usersService: UsersService) {}

  @Action('admin_materials')
  async handleAdminMaterials(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const telegramId = String(ctx.from?.id);
    const hasPerm = await this.usersService.hasPermission(telegramId, 'MATERIALS');
    if (!hasPerm) {
      await ctx.answerCbQuery('⛔ ليس لديك صلاحية لإدارة الملازم والمذكرات.', {
        show_alert: true,
      });
      return;
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ إضافة ملزمة', 'am'),
        Markup.button.callback('🗑️ حذف ملزمة', 'dm'),
      ],
      [Markup.button.callback('🔙 العودة للقائمة الرئيسية', 'main_menu')],
    ]);

    await ctx.editMessageText(
      '📂 **قسم إدارة الملازم والمقررات:**\nاختر الإجراء المطلوب:',
      {
        parse_mode: 'Markdown',
        ...keyboard,
      },
    );
  }
}
