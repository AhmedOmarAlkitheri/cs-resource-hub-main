import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { AcademicService } from 'src/academic/services/academic.services';
import { BotEventService } from 'src/bot/services/bot-event.service';

@Update()
export class CloneYearHandler {
  constructor(
    private readonly academicService: AcademicService,
    private readonly botEventService: BotEventService,
  ) {}

  // ============================================================
  // بدء عملية نسخ مقررات سنة
  // ============================================================

  @Action('ac_clone_year')
  async start(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const years = await this.academicService.getAcademicYears();

    if (!years || years.length < 2) {
      await this.editOrReply(
        ctx,
        '⚠️ <b>يتطلب توفر سنتين دراسيتين على الأقل في النظام لتتمكن من نسخ المقررات.</b>',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 العودة لقسم الكورسات', 'admin_courses')],
        ]),
      );
      return;
    }

    const buttons = years.map((y) => [
      Markup.button.callback(
        `📅 ${y.startYear} - ${y.endYear}`,
        `ac_cy_s/${y.id}`,
      ),
    ]);

    await this.editOrReply(
      ctx,
      '🔄 <b>نسخ مقررات سنة دراسية إلى سنة أخرى</b>\n\n' +
        '<b>الخطوة 1 من 2:</b> اختر <b>السنة المصدر</b> (التي تريد نسخ مقرراتها):',
      Markup.inlineKeyboard([
        ...buttons,
        [Markup.button.callback('🔙 رجوع', 'admin_courses')],
      ]),
    );
  }

  // ============================================================
  // اختيار السنة المصدر
  // ============================================================

  @Action(/^ac_cy_s\/(\d+)$/)
  async selectSourceYear(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const sourceYearId = Number(callbackQuery.data.split('/')[1]);
    const sourceYear =
      await this.academicService.getAcademicYearById(sourceYearId);

    if (!sourceYear) {
      await this.editOrReply(ctx, '❌ السنة المصدر غير صالحة.');
      return;
    }

    const offerings =
      await this.academicService.getOfferingsByAcademicYear(sourceYearId);

    if (!offerings || offerings.length === 0) {
      await this.editOrReply(
        ctx,
        `⚠️ السنة الدراسية <b>${sourceYear.startYear} - ${sourceYear.endYear}</b> لا تحتوي على أي مقررات مسندة لنسخها!`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 اختيار سنة أخرى', 'ac_clone_year')],
          [Markup.button.callback('🏠 قسم الكورسات', 'admin_courses')],
        ]),
      );
      return;
    }

    const years = await this.academicService.getAcademicYears();
    const targetYears = years.filter((y) => y.id !== sourceYearId);

    const buttons = targetYears.map((y) => [
      Markup.button.callback(
        `🎯 نسخ إلى: ${y.startYear} - ${y.endYear}`,
        `ac_cy_t/${sourceYearId}/${y.id}`,
      ),
    ]);

    await this.editOrReply(
      ctx,
      '🔄 <b>نسخ مقررات سنة دراسية</b>\n\n' +
        `📅 <b>السنة المصدر:</b> ${sourceYear.startYear} - ${sourceYear.endYear}\n` +
        `📚 <b>عدد المقررات المسندة:</b> ${offerings.length} مقرر\n\n` +
        '<b>الخطوة 2 من 2:</b> اختر <b>السنة الهدف</b> (التي تريد إضافة المقررات إليها):',
      Markup.inlineKeyboard([
        ...buttons,
        [Markup.button.callback('🔙 اختيار سنة مصدر أخرى', 'ac_clone_year')],
      ]),
    );
  }

  // ============================================================
  // تأكيد النسخ
  // ============================================================

  @Action(/^ac_cy_t\/(\d+)\/(\d+)$/)
  async confirmCloneYear(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const parts = callbackQuery.data.split('/');
    const sourceYearId = Number(parts[1]);
    const targetYearId = Number(parts[2]);

    const sourceYear =
      await this.academicService.getAcademicYearById(sourceYearId);
    const targetYear =
      await this.academicService.getAcademicYearById(targetYearId);

    if (!sourceYear || !targetYear) {
      await this.editOrReply(ctx, '❌ بيانات السنوات غير صالحة.');
      return;
    }

    const offerings =
      await this.academicService.getOfferingsByAcademicYear(sourceYearId);

    await this.editOrReply(
      ctx,
      '⚠️ <b>تأكيد نسخ المقررات الدراسية</b>\n\n' +
        `📅 <b>من سنة:</b> ${sourceYear.startYear} - ${sourceYear.endYear} (تحتوي ${offerings.length} مقرر)\n` +
        `🎯 <b>إلى سنة:</b> ${targetYear.startYear} - ${targetYear.endYear}\n\n` +
        'ℹ️ <b>ملاحظة:</b> سيتم نسخ جميع المقررات بتفاصيلها (القسم، التخصص، المستوى، الترم) تلقائياً، مع تخطي أي مقرر مضاف مسبقاً لتجنب التكرار.\n\n' +
        'هل تود بدء النسخ الآن؟',
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ نعم، ابدأ عملية النسخ',
            `ac_cy_exec/${sourceYearId}/${targetYearId}`,
          ),
        ],
        [
          Markup.button.callback(
            '❌ إلغاء والعودة',
            `ac_cy_s/${sourceYearId}`,
          ),
        ],
      ]),
    );
  }

  // ============================================================
  // تنفيذ النسخ
  // ============================================================

  @Action(/^ac_cy_exec\/(\d+)\/(\d+)$/)
  async executeCloneYear(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery('جاري نسخ المقررات...');

    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) return;

    const parts = callbackQuery.data.split('/');
    const sourceYearId = Number(parts[1]);
    const targetYearId = Number(parts[2]);

    try {
      const result = await this.academicService.cloneYearOfferings(
        sourceYearId,
        targetYearId,
      );

      const sourceYear =
        await this.academicService.getAcademicYearById(sourceYearId);
      const targetYear =
        await this.academicService.getAcademicYearById(targetYearId);

      await this.editOrReply(
        ctx,
        '🎉 <b>اكتملت عملية نسخ المقررات بنجاح!</b>\n\n' +
          `📅 <b>السنة المصدر:</b> ${sourceYear?.startYear} - ${sourceYear?.endYear}\n` +
          `🎯 <b>السنة الهدف:</b> ${targetYear?.startYear} - ${targetYear?.endYear}\n\n` +
          `📥 <b>المقررات التي تم نسخها بنجاح:</b> ${result.copied}\n` +
          `⏭️ <b>المقررات التي تم تخطيها (موجودة مسبقاً):</b> ${result.skipped}\n` +
          `📊 <b>إجمالي المقررات في المصدر:</b> ${result.totalSource}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 نسخ سنة أخرى', 'ac_clone_year')],
          [Markup.button.callback('📖 قسم الكورسات', 'admin_courses')],
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
      );
    } catch (error) {
      console.error('Failed to clone year offerings:', error);
      await this.editOrReply(
        ctx,
        '❌ حدث خطأ غير متوقع أثناء عملية نسخ المقررات.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 العودة لقسم الكورسات', 'admin_courses')],
        ]),
      );
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

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
