import { Update, Action, Ctx } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

@Update()
export class AdminUsersHandler {
  @Action('admin_users')
  async handleAdminUsers(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('⬆️ ترقية مشرف', 'puh'),
        Markup.button.callback('⬇️ تنزيل مشرف', 'dah'),
      ],
      [
        Markup.button.callback('👥 المشرفون والإحصائيات', 'admin_list_admins'),
        Markup.button.callback('❌ حذف / حظر مستخدم', 'admin_delete_user'),
      ],
      [Markup.button.callback('🔙 العودة للقائمة الرئيسية', 'main_menu')],
    ]);

    await ctx.editMessageText(
      '👥 <b>قسم إدارة المستخدمين والمشرفين</b>\n\n' +
        'اختر الإجراء المطلوب:\n' +
        '• <b>ترقية مشرف:</b> منح صلاحية الأدمن لمستخدم عبر المعرف أو اليوزر.\n' +
        '• <b>تنزيل مشرف:</b> سحب صلاحية الأدمن من مشرف.\n' +
        '• <b>المشرفون والإحصائيات:</b> عرض قائمة المشرفين وإجمالي مستخدمي البوت.\n' +
        '• <b>حذف / حظر مستخدم:</b> إيقاف وصول مستخدم للبوت.',
      {
        parse_mode: 'HTML',
        ...keyboard,
      },
    );
  }
}
