import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { CourseService } from 'src/course/services/course.service';
import { BotEventService } from 'src/bot/services/bot-event.service';

@Update()
export class DeleteCourseHandler {
  constructor(
    private readonly courseService: CourseService,
    private readonly botEventService: BotEventService,
  ) {}

  // ============================================================
  // بدء عملية حذف كورس
  // ============================================================

  @Action('dc')
  async start(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    await this.renderCoursesPage(ctx, 1);
  }

  // ============================================================
  // تصفح الكورسات للحذف
  // ============================================================

  @Action(/^dc_p\/(\d+)$/)
  async handlePage(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const page = Number(callbackQuery.data.split('/')[1]);
    await this.renderCoursesPage(ctx, page);
  }

  private async renderCoursesPage(ctx: Context, page: number): Promise<void> {
    const limit = 6;
    const result = await this.courseService.getCoursesPaginated(page, limit);

    if (!result.courses || result.courses.length === 0) {
      await this.editOrReply(
        ctx,
        'ℹ️ لا توجد كورسات مضافة في النظام حالياً.',
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ إضافة كورس جديد', 'ach')],
          [Markup.button.callback('🔙 العودة لقسم الكورسات', 'admin_courses')],
        ]),
      );
      return;
    }

    const courseButtons = result.courses.map((c) => [
      Markup.button.callback(`🗑️ ${c.name}`, `dc_confirm/${c.id}/${page}`),
    ]);

    const navButtons: any[] = [];
    if (page > 1) {
      navButtons.push(
        Markup.button.callback('⬅️ السابق', `dc_p/${page - 1}`),
      );
    }
    navButtons.push(
      Markup.button.callback(
        `📄 ${page} / ${result.totalPages}`,
        'noop_dc',
      ),
    );
    if (page < result.totalPages) {
      navButtons.push(
        Markup.button.callback('التالي ➡️', `dc_p/${page + 1}`),
      );
    }

    await this.editOrReply(
      ctx,
      '🗑️ <b>حذف كورس من النظام</b>\n\n' +
        'اختر الكورس المطلوب حذفه:\n' +
        '⚠️ <i>تنبيه: حذف الكورس سيؤدي إلى حذف جميع الملازم والاختبارات المرتبطة به.</i>',
      Markup.inlineKeyboard([
        ...courseButtons,
        navButtons,
        [Markup.button.callback('🔙 العودة لقسم الكورسات', 'admin_courses')],
      ]),
    );
  }

  @Action('noop_dc')
  async handleNoop(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
  }

  // ============================================================
  // شاشة تأكيد الحذف
  // ============================================================

  @Action(/^dc_confirm\/(\d+)\/(\d+)$/)
  async confirmDeleteCourse(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const parts = callbackQuery.data.split('/');
    const courseId = Number(parts[1]);
    const page = Number(parts[2]);

    const course = await this.courseService.getCourseById(courseId);

    if (!course) {
      await this.editOrReply(ctx, '❌ لم يتم العثور على الكورس.');
      return;
    }

    await this.editOrReply(
      ctx,
      '⚠️ <b>تأكيد حذف الكورس</b>\n\n' +
        `📚 <b>اسم الكورس:</b> ${this.escapeHtml(course.name)}\n` +
        `🆔 <b>المعرّف:</b> <code>${course.id}</code>\n\n` +
        '❗ هل أنت متأكد تماماً من رغبتك بحذف هذا الكورس مع كافة محتوياته؟ لا يمكن التراجع عن هذا الإجراء.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '⚠️ نعم، احذف الكورس نهائياً',
            `dc_exec/${course.id}/${page}`,
          ),
        ],
        [Markup.button.callback('❌ إلغاء وتراجع', `dc_p/${page}`)],
      ]),
    );
  }

  // ============================================================
  // تنفيذ الحذف
  // ============================================================

  @Action(/^dc_exec\/(\d+)\/(\d+)$/)
  async executeDeleteCourse(@Ctx() ctx: Context): Promise<void> {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const parts = callbackQuery.data.split('/');
    const courseId = Number(parts[1]);
    const page = Number(parts[2]);

    try {
      const course = await this.courseService.getCourseById(courseId);
      const courseName = course ? course.name : '';

      await this.courseService.deleteCourse(courseId);
      await ctx.answerCbQuery('تم الحذف بنجاح');

      await this.editOrReply(
        ctx,
        `✅ <b>تم حذف الكورس بنجاح</b>\n\n` +
          `📚 الكورس المحذوف: <b>${this.escapeHtml(courseName)}</b>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🗑️ حذف كورس آخر', `dc_p/${page}`)],
          [Markup.button.callback('📖 قسم الكورسات', 'admin_courses')],
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
      );
    } catch (error) {
      console.error('Failed to delete course:', error);
      await ctx.answerCbQuery('تعذر حذف الكورس');
      await this.editOrReply(
        ctx,
        '❌ حدث خطأ أثناء محاولة حذف الكورس.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 رجوع', `dc_p/${page}`)],
        ]),
      );
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async editOrReply(
    ctx: Context,
    text: string,
    keyboard?: ReturnType<typeof Markup.inlineKeyboard>,
  ): Promise<void> {
    const extra = {
      parse_mode: 'HTML' as const,
      ...(keyboard ?? {}),
    };

    try {
      if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
        await ctx.editMessageText(text, extra);
        return;
      }
    } catch (error) {
      // ignore
    }

    await ctx.reply(text, extra);
  }
}
