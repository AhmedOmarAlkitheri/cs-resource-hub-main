/* eslint-disable @typescript-eslint/no-unused-vars */

import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Injectable } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { ResourceType } from '@prisma/client';
import { AcademicService } from 'src/academic/services/academic.services';
import { ExamService } from 'src/exam/services/exam.service';
import { BotEventService } from 'src/bot/services/bot-event.service';

@Injectable()
@Update()
export class DeleteExamHandler {
  constructor(
    private readonly academicService: AcademicService,
    private readonly examService: ExamService,
    private readonly botEventService: BotEventService,
  ) {}

  // ============================================================
  // Callback Router
  // ============================================================

  @Action(/^de(?:\/.*)?$/)
  async handleAction(@Ctx() ctx: Context): Promise<void> {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return;
    }

    const callbackData = callbackQuery.data;

    if (typeof callbackData !== 'string') {
      return;
    }

    const parts = callbackData.split('/');

    if (parts[0] !== 'de') {
      return;
    }

    await ctx.answerCbQuery();

    // Confirm Delete
    if (parts.length === 3 && parts[1] === 'confirm') {
      const examId = Number(parts[2]);
      if (!Number.isInteger(examId)) {
        await this.editOrReply(ctx, '❌ رقم الاختبار غير صحيح.');
        return;
      }
      await this.deleteExam(ctx, examId);
      return;
    }

    // Cancel
    if (parts.length === 2 && parts[1] === 'cancel') {
      await this.editOrReply(
        ctx,
        '❌ <b>تم إلغاء عملية الحذف.</b>',
        Markup.inlineKeyboard([[Markup.button.callback('🏠 الرئيسية', 'main_menu')]]),
      );
      return;
    }

    // 1. الكلية
    if (parts.length === 1) {
      await this.start(ctx);
      return;
    }

    // 2. التخصص
    if (parts.length === 2) {
      await this.handleCollege(ctx, Number(parts[1]));
      return;
    }

    // 3. المستوى
    if (parts.length === 3) {
      await this.handleMajor(ctx, Number(parts[1]), Number(parts[2]));
      return;
    }

    // 4. الفصل
    if (parts.length === 4) {
      await this.handleLevel(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
      );
      return;
    }

    // 5. السنة
    if (parts.length === 5) {
      await this.handleTerm(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
        Number(parts[4]),
      );
      return;
    }

    // 6. المادة
    if (parts.length === 6) {
      await this.handleYear(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
        Number(parts[4]),
        Number(parts[5]),
      );
      return;
    }

    // 7. نوع الاختبار
    if (parts.length === 7) {
      await this.handleCourse(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
        Number(parts[4]),
        Number(parts[5]),
        Number(parts[6]),
      );
      return;
    }

    // 8. قائمة الاختبارات للحذف
    if (parts.length === 8) {
      await this.showExamsToDelete(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
        Number(parts[4]),
        Number(parts[5]),
        Number(parts[6]),
        parts[7],
      );
    }
  }

  // ============================================================
  // Step 1: Start
  // ============================================================

  async start(ctx: Context) {
    const departments = await this.academicService.getDepartments();

    if (!departments.length) {
      await this.editOrReply(ctx, '❌ لا توجد كليات في النظام.');
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف اختبار</b>',
        '',
        '<b>الخطوة 1 من 7: اختر الكلية</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...departments.map((dept) => [
          Markup.button.callback(`🏛️ ${dept.name}`, `de/${dept.id}`),
        ]),
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
      ]),
    );
  }

  // ============================================================
  // Step 2: Choose Major
  // ============================================================

  private async handleCollege(ctx: Context, departmentId: number) {
    const department =
      await this.academicService.getDepartmentById(departmentId);
    const tracks =
      await this.academicService.getTracksByDepartmentId(departmentId);

    if (!tracks.length) {
      await this.editOrReply(
        ctx,
        '❌ لا توجد تخصصات.',
        Markup.inlineKeyboard([[Markup.button.callback('🔙 السابق', 'de')]]),
      );
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف اختبار</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        '',
        '<b>الخطوة 2 من 7: اختر التخصص</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...tracks.map((track) => [
          Markup.button.callback(
            `🎯 ${track.name}`,
            `de/${departmentId}/${track.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق (الكليات)', 'de')],
      ]),
    );
  }

  // ============================================================
  // Step 3: Choose Level
  // ============================================================

  private async handleMajor(
    ctx: Context,
    departmentId: number,
    trackId: number,
  ) {
    const department =
      await this.academicService.getDepartmentById(departmentId);
    const track = await this.academicService.getTrackById(trackId);
    const levels = await this.academicService.getLevels();

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف اختبار</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track?.name ?? '')}`,
        '',
        '<b>الخطوة 3 من 7: اختر المستوى</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...levels.map((level) => [
          Markup.button.callback(
            `📚 ${level.name}`,
            `de/${departmentId}/${trackId}/${level.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق', `de/${departmentId}`)],
      ]),
    );
  }

  // ============================================================
  // Step 4: Choose Term
  // ============================================================

  private async handleLevel(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
  ) {
    const department =
      await this.academicService.getDepartmentById(departmentId);
    const track = await this.academicService.getTrackById(trackId);
    const level = await this.academicService.getLevelById(levelId);
    const terms = await this.academicService.getTerms();

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف اختبار</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track?.name ?? '')}`,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level?.name ?? '')}`,
        '',
        '<b>الخطوة 4 من 7: اختر الفصل</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...terms.map((term) => [
          Markup.button.callback(
            `🗓️ ${term.name}`,
            `de/${departmentId}/${trackId}/${levelId}/${term.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق', `de/${departmentId}/${trackId}`)],
      ]),
    );
  }

  // ============================================================
  // Step 5: Choose Academic Year
  // ============================================================

  private async handleTerm(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
    termId: number,
  ) {
    const department =
      await this.academicService.getDepartmentById(departmentId);
    const track = await this.academicService.getTrackById(trackId);
    const level = await this.academicService.getLevelById(levelId);
    const term = await this.academicService.getTermById(termId);
    const academicYears = await this.academicService.getAcademicYears();

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف اختبار</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track?.name ?? '')}`,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level?.name ?? '')}`,
        `<b>🗓️ الفصل:</b> ${this.escapeHtml(term?.name ?? '')}`,
        '',
        '<b>الخطوة 5 من 7: اختر السنة الدراسية</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...academicYears.map((year) => [
          Markup.button.callback(
            `📅 ${year.startYear} - ${year.endYear}`,
            `de/${departmentId}/${trackId}/${levelId}/${termId}/${year.id}`,
          ),
        ]),
        [
          Markup.button.callback(
            '🔙 السابق',
            `de/${departmentId}/${trackId}/${levelId}`,
          ),
        ],
      ]),
    );
  }

  // ============================================================
  // Step 6: Choose Course
  // ============================================================

  private async handleYear(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
    termId: number,
    yearId: number,
  ) {
    const offerings = await this.academicService.getCoursesByContext({
      departmentId,
      trackId,
      levelId,
      termId,
      academicYearId: yearId,
    });

    const previousCallback = `de/${departmentId}/${trackId}/${levelId}/${termId}`;

    if (!offerings.length) {
      await this.editOrReply(
        ctx,
        '❌ لا توجد مقررات دراسية مضافة.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 السابق', previousCallback)],
        ]),
      );
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف اختبار</b>',
        '',
        '<b>الخطوة 6 من 7: اختر المقرر / المادة</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...offerings.map((offering) => [
          Markup.button.callback(
            `📖 ${offering.course.name}`,
            `de/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${offering.courseId}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق', previousCallback)],
      ]),
    );
  }

  // ============================================================
  // Step 7: Choose Exam Type (شهري أو فصلي)
  // ============================================================

  private async handleCourse(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
    termId: number,
    yearId: number,
    courseId: number,
  ) {
    const basePath = `de/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف اختبار</b>',
        '',
        '<b>الخطوة 7 من 7: اختر نوع الاختبار</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('📝 اختبار شهري', `${basePath}/T`)],
        [Markup.button.callback('📑 اختبار فصلي', `${basePath}/P`)],
        [
          Markup.button.callback(
            '🔙 السابق',
            `de/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}`,
          ),
        ],
      ]),
    );
  }

  // ============================================================
  // Step 8: Show Exams to Delete
  // ============================================================

  private async showExamsToDelete(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
    termId: number,
    yearId: number,
    courseId: number,
    typeValue: string,
  ) {
    const type =
      typeValue === 'T' ? ResourceType.THEORY : ResourceType.PRACTICAL;
    const typeLabel = typeValue === 'T' ? 'شهري' : 'فصلي';

    const offering = await this.academicService.findCourseOffering({
      courseId,
      departmentId,
      trackId,
      levelId,
      termId,
      academicYearId: yearId,
    });

    if (!offering) {
      await this.editOrReply(ctx, '❌ المقرر غير موجود.');
      return;
    }

    const exams = await this.examService.getExams(offering.id, type);

    const backCallback = `de/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    if (!exams.length) {
      await this.editOrReply(
        ctx,
        `ℹ️ لا توجد اختبارات (${typeLabel}) مرفوعة لهذه المادة لحذفها.`,
        Markup.inlineKeyboard([
          [{ text: '🔙 السابق', callback_data: backCallback }],
        ]),
      );
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ اختر الاختبار المطلوب حذفه:</b>',
        '',
        `<b>المادة:</b> ${this.escapeHtml(offering.course.name)}`,
        `<b>النوع:</b> ${typeLabel}`,
      ].join('\n'),
      Markup.inlineKeyboard([
        ...exams.map((exam) => [
          Markup.button.callback(
            `🗑️ ${exam.title}`,
            `de/confirm/${exam.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق', backCallback)],
      ]),
    );
  }

  // ============================================================
  // Delete Exam
  // ============================================================

  private async deleteExam(ctx: Context, examId: number) {
    try {
      await this.examService.deleteExam(examId);

      await this.editOrReply(
        ctx,
        '✅ <b>تم حذف الاختبار بنجاح من قاعدة البيانات!</b>',
        Markup.inlineKeyboard([
          [Markup.button.callback('🗑️ حذف اختبار آخر', 'de')],
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
      );
    } catch (error) {
      console.error('Failed to delete exam:', error);
      await this.editOrReply(ctx, '❌ حدث خطأ أثناء حذف الاختبار.');
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
      .replace(/"/g, '&quot;');
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
      // fallback
    }

    await ctx.reply(text, extra);
  }
}
