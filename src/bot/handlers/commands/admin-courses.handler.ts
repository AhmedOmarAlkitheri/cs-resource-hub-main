import { Update, Action, Ctx } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

import { UsersService } from 'src/user/services/user.service';

@Update()
export class AdminCoursesHandler {
  constructor(private readonly usersService: UsersService) {}

  @Action('admin_courses')
  async handleAdminCourses(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const telegramId = String(ctx.from?.id);
    const hasPerm = await this.usersService.hasPermission(telegramId, 'COURSES');
    if (!hasPerm) {
      await ctx.answerCbQuery('⛔ ليس لديك صلاحية لإدارة المقررات والكورسات.', {
        show_alert: true,
      });
      return;
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ إضافة كورس', 'ach'),
        Markup.button.callback('✏️ تعديل كورس', 'ec'),
      ],
      [
        Markup.button.callback('🗑️ حذف كورس', 'dc'),
        Markup.button.callback('📌 إسناد كورس لفصل', 'ac'),
      ],
      [
        Markup.button.callback('📋 عرض وتعديل المقررات المسندة للفصول', 'ac_manage'),
      ],
      [
        Markup.button.callback('🔄 نسخ مقررات سنة دراسية', 'ac_clone_year'),
      ],
      [Markup.button.callback('🔙 العودة للقائمة الرئيسية', 'main_menu')],
    ]);

    await ctx.editMessageText(
      '📖 <b>قسم إدارة الكورسات والمقررات</b>\n\n' +
        'اختر الإجراء المطلوب إدارته أدناه:\n' +
        '• <b>إضافة / تعديل / حذف:</b> إدارة أسماء الكورسات.\n' +
        '• <b>إسناد كورس:</b> ربط الكورس بكلية ومستوى وفصل وسنة.\n' +
        '• <b>عرض وتعديل المقررات المسندة:</b> مراجعة فصول المقررات ونقلها بين الفصول بضغطة زر.\n' +
        '• <b>نسخ مقررات سنة:</b> نسخ جميع المقررات من سنة لأخرى دفعة واحدة.',
      {
        parse_mode: 'HTML',
        ...keyboard,
      },
    );
  }
}
