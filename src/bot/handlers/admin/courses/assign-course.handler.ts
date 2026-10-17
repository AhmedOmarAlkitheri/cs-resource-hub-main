/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';

import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';

import { CourseService } from 'src/course/services/course.service';
import { AcademicService } from 'src/academic/services/academic.services';

import { courseKeyboard } from 'src/bot/keyboards/course.keyboard';
import { departmentKeyboard } from 'src/bot/keyboards/department.keyboard';
import { levelKeyboard } from 'src/bot/keyboards/level.keyboard';
import { termKeyboard } from 'src/bot/keyboards/term.keyboard';
import { academicYearKeyboard } from 'src/bot/keyboards/academic-year.keyboard';
import { trackKeyboard } from 'src/bot/keyboards/track.keyboard';

import { BotEventConflictService } from 'src/bot/services/bot-conflict.service';

@Update()
export class AssignCourseHandler {
  constructor(
    private readonly courseService: CourseService,
    private readonly academicService: AcademicService,
    private readonly botEventService: BotEventService,
    private readonly botEventConflictService: BotEventConflictService,
  ) {}

  // ============================================================
  // بدء عملية إسناد كورس
  // ============================================================

  @Action('ac')
  async start(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;

    if (!userId) {
      return;
    }

    const existingEvent = this.botEventService.get(userId);

    if (existingEvent) {
      await this.botEventConflictService.showConflict(ctx, existingEvent);

      return;
    }

    const page = 1;
    const limit = 8;

    const result = await this.courseService.getCoursesPaginated(page, limit);

    if (!result.courses.length) {
      await ctx.reply(
        '❌ لا توجد كورسات حاليًا.\n\n' + 'قم بإضافة كورس أولًا.',
      );

      return;
    }

    const message = await ctx.reply(
      '📚 <b>إسناد كورس إلى فصل</b>\n\n' + 'اختر الكورس:',
      {
        parse_mode: 'HTML',

        ...courseKeyboard(result.courses, 'ac', result.page, result.totalPages),
      },
    );

    this.botEventService.set({
      userId,

      event: BotEventType.WAITING_COURSE_OFFERING_COURSE,

      messageId: message.message_id,

      chatId: String(ctx.chat?.id ?? ''),

      data: {
        page,
      },
    });
  }

  // ============================================================
  // اختيار الكورس
  //
  // ac/courseId
  // ============================================================

  @Action(/^ac\/(\d+)$/)
  async selectCourse(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;

    if (!userId) {
      return;
    }

    const event = this.botEventService.get(userId);

    if (!event) {
      await ctx.answerCbQuery('انتهت عملية الإسناد.', {
        show_alert: true,
      });

      return;
    }

    if (event.event !== BotEventType.WAITING_COURSE_OFFERING_COURSE) {
      return;
    }

    const courseId = this.getCallbackId(ctx);

    if (!courseId) {
      return;
    }

    const course = await this.courseService.getCourseById(courseId);

    if (!course) {
      await ctx.answerCbQuery('الكورس غير موجود.', {
        show_alert: true,
      });

      return;
    }

    const departments = await this.academicService.getDepartments();

    if (!departments.length) {
      await this.editCurrentMessage(ctx, '❌ لا توجد أقسام دراسية حاليًا.');

      this.botEventService.delete(userId);

      return;
    }

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_COURSE_OFFERING_DEPARTMENT,

      data: {
        courseId,
      },
    });

    await this.editCurrentMessage(
      ctx,

      '📚 <b>الكورس:</b> ' +
        `<b>${this.escapeHtml(course.name)}</b>\n\n` +
        '🏫 اختر القسم:',

      departmentKeyboard(departments, `ac/${courseId}`),
    );
  }

  // ============================================================
  // اختيار القسم
  //
  // ac/courseId/departmentId
  // ============================================================

  // ============================================================
  // اختيار القسم
  //
  // ac/courseId/departmentId
  // ============================================================

  @Action(/^ac\/(\d+)\/(\d+)$/)
  async selectDepartment(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    const event = this.botEventService.get(userId);
    if (!event) {
      await ctx.answerCbQuery('انتهت عملية الإسناد.', { show_alert: true });
      return;
    }

    if (event.event !== BotEventType.WAITING_COURSE_OFFERING_DEPARTMENT) {
      return;
    }

    const ids = this.getCallbackIds(ctx, 2);
    if (!ids) return;

    const [courseId, departmentId] = ids;

    if (event.data?.courseId !== courseId) {
      await this.resetProcess(ctx, userId);
      return;
    }

    const department = await this.academicService.getDepartmentById(departmentId);
    if (!department) {
      await ctx.answerCbQuery('القسم غير موجود.', { show_alert: true });
      return;
    }

    // جلب التخصصات التابعة لهذا القسم
    const tracks = await this.academicService.getTracksByDepartmentId(departmentId);

    // إذا كان للقسم تخصصات، نعرض التخصصات أولاً
    if (tracks.length > 0) {
      this.botEventService.update(userId, {
        event: BotEventType.WAITING_COURSE_OFFERING_TRACK,
        data: {
          courseId,
          departmentId,
        },
      });

      await this.editCurrentMessage(
        ctx,
        `🏫 <b>القسم/الكلية:</b> <b>${this.escapeHtml(department.name)}</b>\n\n` +
          '🛤️ <b>اختر التخصص:</b>',
        trackKeyboard(tracks, `ac/${courseId}/${departmentId}`),
      );
      return;
    }

    // إذا لم يكن هناك تخصصات، نتخطى مباشرة إلى المستوى (trackId = 0)
    const levels = await this.academicService.getLevels();
    if (!levels.length) {
      await this.editCurrentMessage(ctx, '❌ لا توجد مستويات دراسية حاليًا.');
      this.botEventService.delete(userId);
      return;
    }

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_COURSE_OFFERING_LEVEL,
      data: {
        courseId,
        departmentId,
        trackId: 0,
      },
    });

    await this.editCurrentMessage(
      ctx,
      `🏫 <b>القسم/الكلية:</b> <b>${this.escapeHtml(department.name)}</b>\n\n` +
        '🎓 <b>اختر المستوى:</b>',
      levelKeyboard(levels, `ac/${courseId}/${departmentId}/0`),
    );
  }

  // ============================================================
  // اختيار التخصص
  //
  // ac/courseId/departmentId/trackId
  // ============================================================

  @Action(/^ac\/(\d+)\/(\d+)\/(\d+)$/)
  async selectTrack(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    const event = this.botEventService.get(userId);
    if (!event) return;

    const ids = this.getCallbackIds(ctx, 3);
    if (!ids) return;

    const [courseId, departmentId, trackId] = ids;

    if (
      event.data?.courseId !== courseId ||
      event.data?.departmentId !== departmentId
    ) {
      await this.resetProcess(ctx, userId);
      return;
    }

    // جلب المستويات
    const levels = await this.academicService.getLevels();
    if (!levels.length) {
      await this.editCurrentMessage(ctx, '❌ لا توجد مستويات دراسية حاليًا.');
      this.botEventService.delete(userId);
      return;
    }

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_COURSE_OFFERING_LEVEL,
      data: {
        courseId,
        departmentId,
        trackId,
      },
    });

    let trackName = '';
    if (trackId > 0) {
      const tracks = await this.academicService.getTracksByDepartmentId(departmentId);
      const track = tracks.find((t) => t.id === trackId);
      if (track) trackName = track.name;
    }

    await this.editCurrentMessage(
      ctx,
      (trackName ? `🛤️ <b>التخصص:</b> <b>${this.escapeHtml(trackName)}</b>\n\n` : '') +
        '🎓 <b>اختر المستوى:</b>',
      levelKeyboard(levels, `ac/${courseId}/${departmentId}/${trackId}`),
    );
  }

  // ============================================================
  // اختيار المستوى
  //
  // ac/courseId/departmentId/trackId/levelId
  // ============================================================

  @Action(/^ac\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/)
  async selectLevel(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    const event = this.botEventService.get(userId);
    if (!event) return;

    const ids = this.getCallbackIds(ctx, 4);
    if (!ids) return;

    const [courseId, departmentId, trackId, levelId] = ids;

    if (
      event.data?.courseId !== courseId ||
      event.data?.departmentId !== departmentId
    ) {
      await this.resetProcess(ctx, userId);
      return;
    }

    const level = await this.academicService.getLevelById(levelId);
    if (!level) {
      await ctx.answerCbQuery('المستوى غير موجود.', { show_alert: true });
      return;
    }

    const terms = await this.academicService.getTerms();
    if (!terms.length) {
      await this.editCurrentMessage(ctx, '❌ لا توجد ترمات دراسية حاليًا.');
      this.botEventService.delete(userId);
      return;
    }

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_COURSE_OFFERING_TERM,
      data: {
        courseId,
        departmentId,
        trackId,
        levelId,
      },
    });

    await this.editCurrentMessage(
      ctx,
      `🎓 <b>المستوى:</b> <b>${this.escapeHtml(level.name)}</b>\n\n` +
        '📖 <b>اختر الترم:</b>',
      termKeyboard(terms, `ac/${courseId}/${departmentId}/${trackId}/${levelId}`),
    );
  }

  // ============================================================
  // اختيار الترم
  //
  // ac/courseId/departmentId/trackId/levelId/termId
  // ============================================================

  @Action(/^ac\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/)
  async selectTerm(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    const event = this.botEventService.get(userId);
    if (!event) return;

    const ids = this.getCallbackIds(ctx, 5);
    if (!ids) return;

    const [courseId, departmentId, trackId, levelId, termId] = ids;

    if (
      event.data?.courseId !== courseId ||
      event.data?.departmentId !== departmentId ||
      event.data?.levelId !== levelId
    ) {
      await this.resetProcess(ctx, userId);
      return;
    }

    const term = await this.academicService.getTermById(termId);
    if (!term) {
      await ctx.answerCbQuery('الترم غير موجود.', { show_alert: true });
      return;
    }

    const years = await this.academicService.getAcademicYears();
    if (!years.length) {
      await this.editCurrentMessage(ctx, '❌ لا توجد سنوات دراسية حاليًا.');
      this.botEventService.delete(userId);
      return;
    }

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_COURSE_OFFERING_ACADEMIC_YEAR,
      data: {
        courseId,
        departmentId,
        trackId,
        levelId,
        termId,
      },
    });

    await this.editCurrentMessage(
      ctx,
      `📖 <b>الترم:</b> <b>${this.escapeHtml(term.name)}</b>\n\n` +
        '📅 <b>اختر السنة الدراسية:</b>',
      academicYearKeyboard(
        years,
        `ac/${courseId}/${departmentId}/${trackId}/${levelId}/${termId}`,
      ),
    );
  }

  // ============================================================
  // اختيار السنة الدراسية
  //
  // ac/courseId/departmentId/trackId/levelId/termId/academicYearId
  // ============================================================

  @Action(/^ac\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/)
  async selectAcademicYear(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    const event = this.botEventService.get(userId);
    if (!event) return;

    const ids = this.getCallbackIds(ctx, 6);
    if (!ids) return;

    const [courseId, departmentId, trackId, levelId, termId, academicYearId] = ids;

    if (
      event.data?.courseId !== courseId ||
      event.data?.departmentId !== departmentId ||
      event.data?.levelId !== levelId ||
      event.data?.termId !== termId
    ) {
      await this.resetProcess(ctx, userId);
      return;
    }

    await this.finishAssignment(ctx, userId, {
      courseId,
      departmentId,
      levelId,
      trackId: trackId > 0 ? trackId : undefined,
      termId,
      academicYearId,
    });
  }

  // ============================================================
  // الصفحة التالية
  // ============================================================

  @Action('ac/next')
  async nextCourses(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;

    if (!userId) {
      return;
    }

    const event = this.botEventService.get(userId);

    if (!event) {
      return;
    }

    if (event.event !== BotEventType.WAITING_COURSE_OFFERING_COURSE) {
      return;
    }

    const currentPage = Number(event.data?.page ?? 1);

    const nextPage = currentPage + 1;

    const result = await this.courseService.getCoursesPaginated(nextPage, 8);

    if (!result.courses.length) {
      return;
    }

    this.botEventService.update(userId, {
      data: {
        page: result.page,
      },
    });

    await ctx.editMessageReplyMarkup(
      courseKeyboard(result.courses, 'ac', result.page, result.totalPages)
        .reply_markup,
    );
  }

  // ============================================================
  // الصفحة السابقة
  // ============================================================

  @Action('ac/prev')
  async previousCourses(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;

    if (!userId) {
      return;
    }

    const event = this.botEventService.get(userId);

    if (!event) {
      return;
    }

    if (event.event !== BotEventType.WAITING_COURSE_OFFERING_COURSE) {
      return;
    }

    const currentPage = Number(event.data?.page ?? 1);

    if (currentPage <= 1) {
      return;
    }

    const previousPage = currentPage - 1;

    const result = await this.courseService.getCoursesPaginated(
      previousPage,
      8,
    );

    if (!result.courses.length) {
      return;
    }

    this.botEventService.update(userId, {
      data: {
        page: result.page,
      },
    });

    await ctx.editMessageReplyMarkup(
      courseKeyboard(result.courses, 'ac', result.page, result.totalPages)
        .reply_markup,
    );
  }

  // ============================================================
  // إسناد نفس المادة لسنة أخرى
  // ============================================================

  @Action('ac/repeat-year')
  async repeatYear(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;

    if (!userId) {
      return;
    }

    const event = this.botEventService.get(userId);

    if (!event?.data) {
      await ctx.answerCbQuery('انتهت بيانات العملية.', {
        show_alert: true,
      });

      return;
    }

    const years = await this.academicService.getAcademicYears();

    if (!years.length) {
      await this.editCurrentMessage(ctx, '❌ لا توجد سنوات دراسية حاليًا.');

      return;
    }

    const courseId = event.data.courseId;

    const departmentId = event.data.departmentId;

    const levelId = event.data.levelId;

    const trackId = event.data.trackId;

    const termId = event.data.termId;

    if (!courseId || !departmentId || !levelId || !termId) {
      await this.resetProcess(ctx, userId);

      return;
    }

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_COURSE_OFFERING_ACADEMIC_YEAR,

      data: {
        courseId,
        departmentId,
        levelId,
        trackId,
        termId,
      },
    });

    const prefix =
      trackId !== undefined
        ? `ac/${courseId}/${departmentId}/${levelId}/${trackId}/${termId}`
        : `ac/${courseId}/${departmentId}/${levelId}/${termId}`;

    await this.editCurrentMessage(
      ctx,

      '🔄 <b>إسناد نفس المادة لسنة أخرى</b>\n\n' +
        '📅 اختر السنة الدراسية الجديدة:',

      academicYearKeyboard(years, prefix),
    );
  }

  // ============================================================
  // إنشاء CourseOffering
  // ============================================================

  private async finishAssignment(
    ctx: Context,
    userId: number,
    data: {
      courseId: number;
      departmentId: number;
      levelId: number;
      trackId?: number;
      termId: number;
      academicYearId: number;
    },
  ): Promise<void> {
    // ------------------------------------------------------------
    // جلب البيانات
    // ------------------------------------------------------------

    const course = await this.courseService.getCourseById(data.courseId);

    const department = await this.academicService.getDepartmentById(
      data.departmentId,
    );

    const level = await this.academicService.getLevelById(data.levelId);

    const term = await this.academicService.getTermById(data.termId);

    const academicYear = await this.academicService.getAcademicYearById(
      data.academicYearId,
    );

    if (!course || !department || !level || !term || !academicYear) {
      await this.editCurrentMessage(
        ctx,

        '❌ <b>تعذر التحقق من بيانات الإسناد.</b>\n\n' +
          'يرجى بدء العملية من جديد.',
      );

      this.botEventService.delete(userId);

      return;
    }

    // ------------------------------------------------------------
    // التحقق من Track
    // ------------------------------------------------------------

    let track:
      | {
          id: number;
          name: string;
        }
      | undefined;

    if (data.trackId !== undefined) {
      const tracks = await this.academicService.getTracksByDepartmentId(
        data.departmentId,
      );

      track = tracks.find((item) => item.id === data.trackId);

      if (!track) {
        await this.editCurrentMessage(ctx, '❌ التراك المحدد غير تابع للقسم.');

        this.botEventService.delete(userId);

        return;
      }
    }

    // ------------------------------------------------------------
    // منع التكرار
    // ------------------------------------------------------------

    const existing = await this.academicService.findCourseOffering({
      courseId: data.courseId,

      departmentId: data.departmentId,

      trackId: data.trackId,

      levelId: data.levelId,

      termId: data.termId,

      academicYearId: data.academicYearId,
    });

    if (existing) {
      await this.editCurrentMessage(
        ctx,

        '⚠️ <b>الكورس مسند مسبقًا</b>\n\n' +
          `📚 الكورس: <b>${this.escapeHtml(course.name)}</b>\n` +
          `🏫 القسم: <b>${this.escapeHtml(department.name)}</b>\n` +
          `🎓 المستوى: <b>${this.escapeHtml(level.name)}</b>\n` +
          (track ? `🛤️ التراك: <b>${this.escapeHtml(track.name)}</b>\n` : '') +
          `📖 الترم: <b>${this.escapeHtml(term.name)}</b>\n` +
          `📅 السنة: <b>${academicYear.startYear} - ${academicYear.endYear}</b>\n\n` +
          'اختر إجراءً:',

        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔄 إسناد نفس المادة لسنة أخرى',

                  callback_data: 'ac/repeat-year',
                },
              ],
              [
                {
                  text: '📚 إسناد مادة أخرى',

                  callback_data: 'ac',
                },
              ],
            ],
          },
        },
      );

      return;
    }

    // ------------------------------------------------------------
    // إنشاء CourseOffering
    // ------------------------------------------------------------

    const offering = await this.academicService.createCourseOffering({
      courseId: data.courseId,

      departmentId: data.departmentId,

      trackId: data.trackId,

      levelId: data.levelId,

      termId: data.termId,

      academicYearId: data.academicYearId,
    });

    // ------------------------------------------------------------
    // الاحتفاظ بالبيانات
    // حتى نستطيع إسناد نفس المادة لسنة أخرى
    // ------------------------------------------------------------

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_COURSE_OFFERING_ACADEMIC_YEAR,

      data: {
        courseId: data.courseId,

        departmentId: data.departmentId,

        levelId: data.levelId,

        trackId: data.trackId,

        termId: data.termId,

        academicYearId: data.academicYearId,
      },
    });

    // ------------------------------------------------------------
    // النتيجة
    // ------------------------------------------------------------

    await this.editCurrentMessage(
      ctx,

      '✅ <b>تم إسناد الكورس بنجاح</b>\n\n' +
        `📚 الكورس: <b>${this.escapeHtml(course.name)}</b>\n` +
        `🏫 القسم: <b>${this.escapeHtml(department.name)}</b>\n` +
        `🎓 المستوى: <b>${this.escapeHtml(level.name)}</b>\n` +
        (track ? `🛤️ التراك: <b>${this.escapeHtml(track.name)}</b>\n` : '') +
        `📖 الترم: <b>${this.escapeHtml(term.name)}</b>\n` +
        `📅 السنة الدراسية: <b>${academicYear.startYear} - ${academicYear.endYear}</b>\n\n` +
        `🆔 Offering ID: <code>${offering.id}</code>`,

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔄 إسناد نفس المادة لسنة أخرى',

                callback_data: 'ac/repeat-year',
              },
            ],
            [
              {
                text: '📚 إسناد مادة أخرى',

                callback_data: 'ac',
              },
            ],
          ],
        },
      },
    );
  }

  // ============================================================
  // استخراج ID واحد
  //
  // ac/12
  // ============================================================

  private getCallbackId(ctx: Context): number | null {
    const match = this.getCallbackMatch(ctx);

    if (!match || match.length !== 2) {
      return null;
    }

    const id = Number(match[1]);

    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    return id;
  }

  // ============================================================
  // استخراج عدة IDs
  //
  // ac/12/2/3
  // ============================================================

  private getCallbackIds(ctx: Context, expectedCount: number): number[] | null {
    const match = this.getCallbackMatch(ctx);

    if (!match || match.length !== expectedCount + 1) {
      return null;
    }

    const ids = match.slice(1).map((value) => Number(value));

    if (ids.some((id) => !Number.isInteger(id) || id < 0)) {
      return null;
    }

    return ids;
  }

  // ============================================================
  // استخراج Match
  // ============================================================

  private getCallbackMatch(ctx: Context): RegExpExecArray | null {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return null;
    }

    const data = callbackQuery.data;

    const parts = data.split('/');

    if (parts[0] !== 'ac') {
      return null;
    }

    const ids = parts.slice(1);

    if (ids.length === 0 || ids.some((id) => !/^\d+$/.test(id))) {
      return null;
    }

    return [data, ...ids] as unknown as RegExpExecArray;
  }

  // ============================================================
  // تعديل الرسالة الحالية
  // ============================================================

  private async editCurrentMessage(
    ctx: Context,
    text: string,
    keyboard?: any,
  ): Promise<void> {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      console.error('Failed to edit Telegram message:', error);
    }
  }

  // ============================================================
  // إعادة ضبط العملية
  // ============================================================

  private async resetProcess(ctx: Context, userId: number): Promise<void> {
    this.botEventService.delete(userId);

    await this.editCurrentMessage(
      ctx,

      '❌ <b>بيانات عملية الإسناد غير صحيحة.</b>\n\n' +
        'يرجى بدء العملية من جديد.',
    );
  }

  // ============================================================
  // Escape HTML
  // ============================================================

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
