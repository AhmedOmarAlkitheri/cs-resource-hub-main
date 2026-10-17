import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { AcademicService } from 'src/academic/services/academic.services';
import { departmentKeyboard } from 'src/bot/keyboards/department.keyboard';
import { trackKeyboard } from 'src/bot/keyboards/track.keyboard';
import { levelKeyboard } from 'src/bot/keyboards/level.keyboard';
import { termKeyboard } from 'src/bot/keyboards/term.keyboard';
import { academicYearKeyboard } from 'src/bot/keyboards/academic-year.keyboard';

@Update()
export class ManageOfferingsHandler {
  constructor(private readonly academicService: AcademicService) {}

  // ============================================================
  // 1. بدء استعراض وإدارة المقررات المسندة
  // ============================================================

  @Action('ac_manage')
  async start(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const departments = await this.academicService.getDepartments();

    if (!departments.length) {
      await this.editCurrentMessage(ctx, '❌ لا توجد كليات حاليًا.');
      return;
    }

    await this.editCurrentMessage(
      ctx,
      '📋 <b>إدارة وتصفية المقررات المسندة</b>\n\n' +
        'اختر <b>الكلية</b> لعرض المقررات المسندة وإدارتها أو نقلها بين الفصول:',
      departmentKeyboard(departments, 'ac_manage'),
    );
  }

  // ============================================================
  // 2. اختيار الكلية
  // ============================================================

  @Action(/^ac_manage\/(\d+)$/)
  async selectDepartment(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.split('/');
    if (!match) return;

    const departmentId = Number(match[1]);
    const department = await this.academicService.getDepartmentById(departmentId);
    if (!department) return;

    const tracks = await this.academicService.getTracksByDepartmentId(departmentId);

    if (tracks.length > 0) {
      await this.editCurrentMessage(
        ctx,
        `🏛️ <b>الكلية:</b> <b>${this.escapeHtml(department.name)}</b>\n\n` +
          '🎯 <b>اختر التخصص:</b>',
        trackKeyboard(tracks, `ac_manage/${departmentId}`),
      );
      return;
    }

    const levels = await this.academicService.getLevels();
    await this.editCurrentMessage(
      ctx,
      `🏛️ <b>الكلية:</b> <b>${this.escapeHtml(department.name)}</b>\n\n` +
        '📚 <b>اختر المستوى:</b>',
      levelKeyboard(levels, `ac_manage/${departmentId}/0`),
    );
  }

  // ============================================================
  // 3. اختيار التخصص
  // ============================================================

  @Action(/^ac_manage\/(\d+)\/(\d+)$/)
  async selectTrack(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.split('/');
    if (!match) return;

    const departmentId = Number(match[1]);
    const trackId = Number(match[2]);

    const department = await this.academicService.getDepartmentById(departmentId);
    const track = trackId > 0 ? await this.academicService.getTrackById(trackId) : null;
    const levels = await this.academicService.getLevels();

    await this.editCurrentMessage(
      ctx,
      `🏛️ <b>الكلية:</b> <b>${this.escapeHtml(department?.name ?? '')}</b>\n` +
        (track ? `🎯 <b>التخصص:</b> <b>${this.escapeHtml(track.name)}</b>\n\n` : '\n') +
        '📚 <b>اختر المستوى:</b>',
      levelKeyboard(levels, `ac_manage/${departmentId}/${trackId}`),
    );
  }

  // ============================================================
  // 4. اختيار المستوى
  // ============================================================

  @Action(/^ac_manage\/(\d+)\/(\d+)\/(\d+)$/)
  async selectLevel(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.split('/');
    if (!match) return;

    const departmentId = Number(match[1]);
    const trackId = Number(match[2]);
    const levelId = Number(match[3]);

    const department = await this.academicService.getDepartmentById(departmentId);
    const track = trackId > 0 ? await this.academicService.getTrackById(trackId) : null;
    const level = await this.academicService.getLevelById(levelId);
    const terms = await this.academicService.getTerms();

    await this.editCurrentMessage(
      ctx,
      `🏛️ <b>الكلية:</b> <b>${this.escapeHtml(department?.name ?? '')}</b>\n` +
        (track ? `🎯 <b>التخصص:</b> <b>${this.escapeHtml(track.name)}</b>\n` : '') +
        `📚 <b>المستوى:</b> <b>${this.escapeHtml(level?.name ?? '')}</b>\n\n` +
        '🗓️ <b>اختر الفصل الدراسي:</b>',
      termKeyboard(terms, `ac_manage/${departmentId}/${trackId}/${levelId}`),
    );
  }

  // ============================================================
  // 5. اختيار الفصل
  // ============================================================

  @Action(/^ac_manage\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/)
  async selectTerm(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.split('/');
    if (!match) return;

    const departmentId = Number(match[1]);
    const trackId = Number(match[2]);
    const levelId = Number(match[3]);
    const termId = Number(match[4]);

    const department = await this.academicService.getDepartmentById(departmentId);
    const track = trackId > 0 ? await this.academicService.getTrackById(trackId) : null;
    const level = await this.academicService.getLevelById(levelId);
    const term = await this.academicService.getTermById(termId);
    const years = await this.academicService.getAcademicYears();

    await this.editCurrentMessage(
      ctx,
      `🏛️ <b>الكلية:</b> <b>${this.escapeHtml(department?.name ?? '')}</b>\n` +
        (track ? `🎯 <b>التخصص:</b> <b>${this.escapeHtml(track.name)}</b>\n` : '') +
        `📚 <b>المستوى:</b> <b>${this.escapeHtml(level?.name ?? '')}</b>\n` +
        `🗓️ <b>الفصل:</b> <b>${this.escapeHtml(term?.name ?? '')}</b>\n\n` +
        '📅 <b>اختر السنة الدراسية:</b>',
      academicYearKeyboard(years, `ac_manage/${departmentId}/${trackId}/${levelId}/${termId}`),
    );
  }

  // ============================================================
  // 6. عرض المقررات المسندة للفصل المحدد
  // ============================================================

  @Action(/^ac_manage\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/)
  async showOfferings(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.split('/');
    if (!match) return;

    const departmentId = Number(match[1]);
    const trackId = Number(match[2]);
    const levelId = Number(match[3]);
    const termId = Number(match[4]);
    const yearId = Number(match[5]);

    await this.renderOfferingsList(ctx, departmentId, trackId, levelId, termId, yearId);
  }

  private async renderOfferingsList(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
    termId: number,
    yearId: number,
  ) {
    const department = await this.academicService.getDepartmentById(departmentId);
    const track = trackId > 0 ? await this.academicService.getTrackById(trackId) : null;
    const level = await this.academicService.getLevelById(levelId);
    const term = await this.academicService.getTermById(termId);
    const academicYear = await this.academicService.getAcademicYearById(yearId);

    const offerings = await this.academicService.getCoursesByContext({
      departmentId,
      trackId: trackId > 0 ? trackId : undefined,
      levelId,
      termId,
      academicYearId: yearId,
    });

    const otherTermId = termId === 1 ? 2 : 1;
    const otherTermName = termId === 1 ? 'الترم الثاني' : 'الترم الأول';

    const buttons = offerings.map((o) => [
      Markup.button.callback(`📖 ${o.course.name}`, `ac_mo_item/${o.id}`),
    ]);

    const actionButtons = [
      [
        Markup.button.callback(
          '➕ إسناد مقرر آخر لهذا الفصل',
          `ac_same/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/1`,
        ),
      ],
      [
        Markup.button.callback(
          `🔄 الانتقال إلى ${otherTermName}`,
          `ac_manage/${departmentId}/${trackId}/${levelId}/${otherTermId}/${yearId}`,
        ),
      ],
      [
        Markup.button.callback(
          '🔙 اختيار فصل/سنة أخرى',
          `ac_manage/${departmentId}/${trackId}/${levelId}`,
        ),
        Markup.button.callback('🏠 قسم الكورسات', 'admin_courses'),
      ],
    ];

    const messageText =
      `📋 <b>قائمة المقررات المسندة:</b>\n\n` +
      `🏛️ الكلية: <b>${this.escapeHtml(department?.name ?? '')}</b>\n` +
      (track ? `🎯 التخصص: <b>${this.escapeHtml(track.name)}</b>\n` : '') +
      `📚 المستوى: <b>${this.escapeHtml(level?.name ?? '')}</b>\n` +
      `🗓️ الفصل: <b>${this.escapeHtml(term?.name ?? '')}</b>\n` +
      `📅 السنة: <b>${academicYear?.startYear} - ${academicYear?.endYear}</b>\n` +
      `📊 عدد المقررات المسندة: <b>${offerings.length}</b>\n\n` +
      (offerings.length === 0
        ? '⚠️ <i>لا توجد مقررات مسندة لهذا الفصل حتى الآن.</i>'
        : '💡 اضغط على اسم أي مقرر لنقله إلى الفصل الآخر أو حذفه:');

    await this.editCurrentMessage(ctx, messageText, Markup.inlineKeyboard([...buttons, ...actionButtons]));
  }

  // ============================================================
  // 7. تفاصيل مقرر مسند والتحكم به (نقل / حذف)
  // ============================================================

  @Action(/^ac_mo_item\/(\d+)$/)
  async viewOfferingItem(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.split('/');
    if (!match) return;

    const offeringId = Number(match[1]);
    const offering = await this.academicService.getCourseOfferingById(offeringId);

    if (!offering) {
      await ctx.answerCbQuery('المقرر غير موجود أو تم حذفه.', { show_alert: true });
      return;
    }

    const currentTermId = offering.termId;
    const targetTermId = currentTermId === 1 ? 2 : 1;
    const targetTermName = currentTermId === 1 ? 'الترم الثاني' : 'الترم الأول';

    const safeTrackId = offering.trackId || 0;
    const backCallback = `ac_manage/${offering.departmentId}/${safeTrackId}/${offering.levelId}/${offering.termId}/${offering.academicYearId}`;

    const text =
      `📖 <b>تفاصيل المقرر المسند:</b>\n\n` +
      `📚 المقرر: <b>${this.escapeHtml(offering.course.name)}</b>\n` +
      `🏛️ الكلية: <b>${this.escapeHtml(offering.department.name)}</b>\n` +
      (offering.track ? `🎯 التخصص: <b>${this.escapeHtml(offering.track.name)}</b>\n` : '') +
      `📚 المستوى: <b>${this.escapeHtml(offering.level.name)}</b>\n` +
      `🗓️ الفصل الحالي: <b>${this.escapeHtml(offering.term.name)}</b>\n` +
      `📅 السنة: <b>${offering.academicYear.startYear} - ${offering.academicYear.endYear}</b>\n\n` +
      `اختر الإجراء المطلوب:`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `🔄 نقل إلى ${targetTermName}`,
          `ac_mo_switch/${offering.id}/${targetTermId}`,
        ),
      ],
      [
        Markup.button.callback(
          '🗑️ إلغاء إسناد هذا المقرر',
          `ac_mo_del/${offering.id}`,
        ),
      ],
      [Markup.button.callback('🔙 العودة لقائمة المقررات', backCallback)],
    ]);

    await this.editCurrentMessage(ctx, text, keyboard);
  }

  // ============================================================
  // 8. نقل المقرر إلى الفصل الآخر بضغطة زر واحدة
  // ============================================================

  @Action(/^ac_mo_switch\/(\d+)\/(\d+)$/)
  async switchTerm(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.split('/');
    if (!match) return;

    const offeringId = Number(match[1]);
    const targetTermId = Number(match[2]);

    const offering = await this.academicService.getCourseOfferingById(offeringId);
    if (!offering) {
      await ctx.answerCbQuery('المقرر غير موجود.', { show_alert: true });
      return;
    }

    await this.academicService.updateCourseOfferingTerm(offeringId, targetTermId);

    const targetTermName = targetTermId === 1 ? 'الترم الأول' : 'الترم الثاني';
    await ctx.answerCbQuery(`✅ تم نقل مقرر "${offering.course.name}" إلى ${targetTermName} بنجاح!`, {
      show_alert: true,
    });

    const safeTrackId = offering.trackId || 0;
    await this.renderOfferingsList(
      ctx,
      offering.departmentId,
      safeTrackId,
      offering.levelId,
      targetTermId,
      offering.academicYearId,
    );
  }

  // ============================================================
  // 9. إلغاء إسناد المقرر (حذف الإسناد)
  // ============================================================

  @Action(/^ac_mo_del\/(\d+)$/)
  async deleteOffering(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.split('/');
    if (!match) return;

    const offeringId = Number(match[1]);
    const offering = await this.academicService.getCourseOfferingById(offeringId);
    if (!offering) {
      await ctx.answerCbQuery('المقرر غير موجود.', { show_alert: true });
      return;
    }

    await this.academicService.deleteCourseOffering(offeringId);

    await ctx.answerCbQuery(`✅ تم إلغاء إسناد مقرر "${offering.course.name}" بنجاح!`, {
      show_alert: true,
    });

    const safeTrackId = offering.trackId || 0;
    await this.renderOfferingsList(
      ctx,
      offering.departmentId,
      safeTrackId,
      offering.levelId,
      offering.termId,
      offering.academicYearId,
    );
  }

  // ============================================================
  // تعديل الرسالة
  // ============================================================

  private async editCurrentMessage(ctx: Context, text: string, keyboard?: any): Promise<void> {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      console.error('Failed to edit Telegram message:', error);
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
