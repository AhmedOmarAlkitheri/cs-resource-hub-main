/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable } from '@nestjs/common';
import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { Prisma, ResourceType } from '@prisma/client';
import { AcademicService } from 'src/academic/services/academic.services';
import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';
import { ExamService } from 'src/exam/services/exam.service';
import { BotEventConflictService } from 'src/bot/services/bot-conflict.service';

type CourseOfferingWithRelations = Prisma.CourseOfferingGetPayload<{
  include: {
    course: true;
    academicYear: true;
  };
}>;

@Injectable()
@Update()
export class AddExamHandler {
  private readonly STORAGE_CHANNEL_ID =
    process.env.EXAM_STORAGE_CHANNEL_ID ||
    process.env.MATERIAL_STORAGE_CHANNEL_ID;

  constructor(
    private readonly academicService: AcademicService,
    private readonly examService: ExamService,
    private readonly botEventService: BotEventService,
    private readonly botEventConflictService: BotEventConflictService,
  ) {}

  // ============================================================
  // Main Callback Router
  // الترتيب الأكاديمي لجامعة أهل الحديث:
  // 1. الكلية (ae)
  // 2. التخصص (ae/{deptId})
  // 3. المستوى (ae/{deptId}/{trackId})
  // 4. الفصل (ae/{deptId}/{trackId}/{levelId})
  // 5. السنة (ae/{deptId}/{trackId}/{levelId}/{termId})
  // 6. المادة (ae/{deptId}/{trackId}/{levelId}/{termId}/{yearId})
  // 7. نوع الاختبار: شهري أو فصلي فقط (ae/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId})
  // 8. رفع الملف (ae/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}/{type})
  // ============================================================

  @Action(/^ae(?:\/.*)?$/)
  async handleAction(@Ctx() ctx: Context) {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return;
    }

    const callbackData = callbackQuery.data;

    if (typeof callbackData !== 'string') {
      return;
    }

    const parts = callbackData.split('/');

    if (parts[0] !== 'ae') {
      return;
    }

    await ctx.answerCbQuery();

    // Cancel
    if (callbackData === 'ae/cancel') {
      this.botEventService.delete(this.getUserId(ctx));

      await this.editOrReply(
        ctx,
        '❌ <b>تم إلغاء عملية إضافة الاختبار.</b>',
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
      );
      return;
    }

    // 1. الكلية: ae
    if (parts.length === 1) {
      await this.start(ctx);
      return;
    }

    // 2. التخصص: ae/{deptId}
    if (parts.length === 2) {
      const departmentId = Number(parts[1]);
      if (!Number.isInteger(departmentId)) {
        await this.editOrReply(ctx, '❌ الكلية غير صحيحة.');
        return;
      }
      await this.handleCollege(ctx, departmentId);
      return;
    }

    // 3. المستوى: ae/{deptId}/{trackId}
    if (parts.length === 3) {
      const departmentId = Number(parts[1]);
      const trackId = Number(parts[2]);
      if (!Number.isInteger(departmentId) || !Number.isInteger(trackId)) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }
      await this.handleMajor(ctx, departmentId, trackId);
      return;
    }

    // 4. الفصل: ae/{deptId}/{trackId}/{levelId}
    if (parts.length === 4) {
      const departmentId = Number(parts[1]);
      const trackId = Number(parts[2]);
      const levelId = Number(parts[3]);
      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(trackId) ||
        !Number.isInteger(levelId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }
      await this.handleLevel(ctx, departmentId, trackId, levelId);
      return;
    }

    // 5. السنة: ae/{deptId}/{trackId}/{levelId}/{termId}
    if (parts.length === 5) {
      const departmentId = Number(parts[1]);
      const trackId = Number(parts[2]);
      const levelId = Number(parts[3]);
      const termId = Number(parts[4]);
      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(trackId) ||
        !Number.isInteger(levelId) ||
        !Number.isInteger(termId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }
      await this.handleTerm(ctx, departmentId, trackId, levelId, termId);
      return;
    }

    // 6. المقرر / المادة: ae/{deptId}/{trackId}/{levelId}/{termId}/{yearId}
    if (parts.length === 6) {
      const departmentId = Number(parts[1]);
      const trackId = Number(parts[2]);
      const levelId = Number(parts[3]);
      const termId = Number(parts[4]);
      const yearId = Number(parts[5]);
      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(trackId) ||
        !Number.isInteger(levelId) ||
        !Number.isInteger(termId) ||
        !Number.isInteger(yearId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }
      await this.handleYear(ctx, departmentId, trackId, levelId, termId, yearId);
      return;
    }

    // 7. نوع الاختبار: ae/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}
    if (parts.length === 7) {
      const departmentId = Number(parts[1]);
      const trackId = Number(parts[2]);
      const levelId = Number(parts[3]);
      const termId = Number(parts[4]);
      const yearId = Number(parts[5]);
      const courseId = Number(parts[6]);
      if (
        !Number.isInteger(departmentId) ||
        !Number.isInteger(trackId) ||
        !Number.isInteger(levelId) ||
        !Number.isInteger(termId) ||
        !Number.isInteger(yearId) ||
        !Number.isInteger(courseId)
      ) {
        await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
        return;
      }
      await this.handleCourse(
        ctx,
        departmentId,
        trackId,
        levelId,
        termId,
        yearId,
        courseId,
      );
      return;
    }

    // 8. طلب رفع الملف: ae/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}/{type}
    if (parts.length === 8) {
      const departmentId = Number(parts[1]);
      const trackId = Number(parts[2]);
      const levelId = Number(parts[3]);
      const termId = Number(parts[4]);
      const yearId = Number(parts[5]);
      const courseId = Number(parts[6]);
      const typeValue = parts[7];

      await this.handleType(
        ctx,
        departmentId,
        trackId,
        levelId,
        termId,
        yearId,
        courseId,
        typeValue,
      );
    }
  }

  // ============================================================
  // Step 1: Start -> Choose College
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
        '<b>📝 إضافة اختبار جديد</b>',
        '',
        '<b>الخطوة 1 من 7: اختر الكلية</b>',
        '',
        'اختر الكلية التي يتبع لها المقرر.',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...departments.map((dept) => [
          Markup.button.callback(`🏛️ ${dept.name}`, `ae/${dept.id}`),
        ]),
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
      ]),
    );
  }

  // ============================================================
  // Step 2: Choose Major (Track)
  // ============================================================

  private async handleCollege(ctx: Context, departmentId: number) {
    const department =
      await this.academicService.getDepartmentById(departmentId);

    if (!department) {
      await this.editOrReply(ctx, '❌ الكلية غير موجودة.');
      return;
    }

    const tracks =
      await this.academicService.getTracksByDepartmentId(departmentId);

    if (!tracks.length) {
      await this.editOrReply(
        ctx,
        '❌ لا توجد تخصصات مضافة لهذه الكلية.',
        Markup.inlineKeyboard([[Markup.button.callback('🔙 السابق', 'ae')]]),
      );
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار جديد</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department.name)}`,
        '',
        '<b>الخطوة 2 من 7: اختر التخصص</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...tracks.map((track) => [
          Markup.button.callback(
            `🎯 ${track.name}`,
            `ae/${departmentId}/${track.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق (الكليات)', 'ae')],
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

    if (!department || !track) {
      await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
      return;
    }

    const levels = await this.academicService.getLevels();

    if (!levels.length) {
      await this.editOrReply(ctx, '❌ لا توجد مستويات مسجلة.');
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار جديد</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department.name)}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}`,
        '',
        '<b>الخطوة 3 من 7: اختر المستوى الدراسي</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...levels.map((level) => [
          Markup.button.callback(
            `📚 ${level.name}`,
            `ae/${departmentId}/${trackId}/${level.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق (التخصصات)', `ae/${departmentId}`)],
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

    if (!department || !track || !level) {
      await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
      return;
    }

    const terms = await this.academicService.getTerms();

    if (!terms.length) {
      await this.editOrReply(ctx, '❌ لا توجد فصول دراسية.');
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار جديد</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department.name)}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}`,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level.name)}`,
        '',
        '<b>الخطوة 4 من 7: اختر الفصل الدراسي</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...terms.map((term) => [
          Markup.button.callback(
            `🗓️ ${term.name}`,
            `ae/${departmentId}/${trackId}/${levelId}/${term.id}`,
          ),
        ]),
        [
          Markup.button.callback(
            '🔙 السابق (المستويات)',
            `ae/${departmentId}/${trackId}`,
          ),
        ],
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

    if (!department || !track || !level || !term) {
      await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
      return;
    }

    const academicYears = await this.academicService.getAcademicYears();

    if (!academicYears.length) {
      await this.editOrReply(ctx, '❌ لا توجد سنوات دراسية.');
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار جديد</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department.name)}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}`,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level.name)}`,
        `<b>🗓️ الفصل:</b> ${this.escapeHtml(term.name)}`,
        '',
        '<b>الخطوة 5 من 7: اختر السنة الدراسية</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...academicYears.map((year) => [
          Markup.button.callback(
            `📅 ${year.startYear} - ${year.endYear}`,
            `ae/${departmentId}/${trackId}/${levelId}/${termId}/${year.id}`,
          ),
        ]),
        [
          Markup.button.callback(
            '🔙 السابق (الفصول)',
            `ae/${departmentId}/${trackId}/${levelId}`,
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
    const department =
      await this.academicService.getDepartmentById(departmentId);
    const track = await this.academicService.getTrackById(trackId);
    const level = await this.academicService.getLevelById(levelId);
    const term = await this.academicService.getTermById(termId);
    const academicYear = await this.academicService.getAcademicYearById(yearId);

    if (!department || !track || !level || !term || !academicYear) {
      await this.editOrReply(ctx, '❌ البيانات غير صحيحة.');
      return;
    }

    const offerings = await this.academicService.getCoursesByContext({
      departmentId,
      trackId,
      levelId,
      termId,
      academicYearId: yearId,
    });

    const previousCallback = `ae/${departmentId}/${trackId}/${levelId}/${termId}`;

    if (!offerings.length) {
      await this.editOrReply(
        ctx,
        [
          '<b>📝 إضافة اختبار جديد</b>',
          '',
          `<b>🏛️ الكلية:</b> ${this.escapeHtml(department.name)}`,
          `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}`,
          `<b>📚 المستوى:</b> ${this.escapeHtml(level.name)}`,
          `<b>🗓️ الفصل:</b> ${this.escapeHtml(term.name)}`,
          `<b>📅 السنة:</b> ${academicYear.startYear} - ${academicYear.endYear}`,
          '',
          '❌ لا توجد مقررات دراسية مضافة لهذا الاختيار.',
        ].join('\n'),
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 السابق', previousCallback)],
        ]),
      );
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار جديد</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department.name)}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}`,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level.name)}`,
        `<b>🗓️ الفصل:</b> ${this.escapeHtml(term.name)}`,
        `<b>📅 السنة:</b> ${academicYear.startYear} - ${academicYear.endYear}`,
        '',
        '<b>الخطوة 6 من 7: اختر المقرر / المادة</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...offerings.map((offering) => [
          Markup.button.callback(
            `📖 ${offering.course.name}`,
            `ae/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${offering.courseId}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق (السنوات)', previousCallback)],
      ]),
    );
  }

  // ============================================================
  // Step 7: Choose Exam Type (شهري أو فصلي فقط)
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
    const department =
      await this.academicService.getDepartmentById(departmentId);
    const track = await this.academicService.getTrackById(trackId);
    const level = await this.academicService.getLevelById(levelId);
    const term = await this.academicService.getTermById(termId);
    const academicYear = await this.academicService.getAcademicYearById(yearId);

    const offering = await this.academicService.findCourseOffering({
      courseId,
      departmentId,
      trackId,
      levelId,
      termId,
      academicYearId: yearId,
    });

    if (!offering || !department || !track || !level || !term || !academicYear) {
      await this.editOrReply(ctx, '❌ المقرر غير موجود.');
      return;
    }

    const basePath = `ae/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار جديد</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department.name)}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}`,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level.name)}`,
        `<b>🗓️ الفصل:</b> ${this.escapeHtml(term.name)}`,
        `<b>📅 السنة:</b> ${academicYear.startYear} - ${academicYear.endYear}`,
        `<b>📖 المادة:</b> ${this.escapeHtml(offering.course.name)}`,
        '',
        '<b>الخطوة 7 من 7: اختر نوع الاختبار</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback('📝 اختبار شهري', `${basePath}/T`),
        ],
        [
          Markup.button.callback('📑 اختبار فصلي', `${basePath}/P`),
        ],
        [
          Markup.button.callback(
            '🔙 السابق (المواد)',
            `ae/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}`,
          ),
        ],
      ]),
    );
  }

  // ============================================================
  // Step 8: Ready for Document Upload
  // ============================================================

  private async handleType(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
    termId: number,
    yearId: number,
    courseId: number,
    typeValue: string,
  ) {
    if (typeValue !== 'T' && typeValue !== 'P') {
      await this.editOrReply(ctx, '❌ نوع الاختبار غير صحيح.');
      return;
    }

    const type =
      typeValue === 'T' ? ResourceType.THEORY : ResourceType.PRACTICAL;
    const typeLabel = typeValue === 'T' ? 'اختبار شهري' : 'اختبار فصلي';

    const offering = await this.academicService.findCourseOffering({
      courseId,
      departmentId,
      trackId,
      levelId,
      termId,
      academicYearId: yearId,
    });

    if (!offering) {
      await this.editOrReply(ctx, '❌ لا توجد هذه المادة في النظام.');
      return;
    }

    const department =
      await this.academicService.getDepartmentById(departmentId);
    const track = await this.academicService.getTrackById(trackId);
    const level = await this.academicService.getLevelById(levelId);
    const term = await this.academicService.getTermById(termId);

    const userId = this.getUserId(ctx);

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_EXAM_DOCUMENT,
      data: {
        departmentId,
        trackId,
        levelId,
        termId,
        academicYearId: yearId,
        courseId,
        courseOfferingId: offering.id,
        type,
        typeLabel,
      },
    });

    await this.editOrReply(
      ctx,
      [
        '<b>📝 إضافة اختبار جديد</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        `<b>🎯 التخصص:</b> ${this.escapeHtml(track?.name ?? '')}`,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level?.name ?? '')}`,
        `<b>🗓️ الفصل:</b> ${this.escapeHtml(term?.name ?? '')}`,
        `<b>📖 المادة:</b> ${this.escapeHtml(offering.course.name)}`,
        `<b>🏷️ النوع:</b> ${typeLabel}`,
        '',
        '<b>📎 الخطوة الأخيرة: أرسل ملف الاختبار</b>',
        '',
        'يرجى الآن إرسال ملف الاختبار بصيغة <b>PDF</b> أو كمستند.',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ إلغاء العملية', 'ae/cancel')],
      ]),
    );
  }

  // ============================================================
  // Receive Document
  // ============================================================

  async handleDocument(ctx: Context) {
    const userId = this.getUserId(ctx);
    const event = this.botEventService.get(userId);

    if (!event || event.event !== BotEventType.WAITING_EXAM_DOCUMENT) {
      return;
    }

    const message = ctx.message;

    if (!message || !('document' in message)) {
      return;
    }

    const document = message.document;

    const isPdf =
      document.mime_type === 'application/pdf' ||
      document.file_name?.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      await ctx.reply(
        '❌ <b>الملف غير صحيح</b>\n\nيجب أن يكون الملف بصيغة PDF.',
        { parse_mode: 'HTML' },
      );
      return;
    }

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_EXAM_TITLE,
      data: {
        ...(event.data ?? {}),
        telegramFileId: document.file_id,
        originalMessageId: message.message_id,
        caption: 'caption' in message ? message.caption : undefined,
      },
    });

    await ctx.reply(
      '✅ <b>تم استلام الملف بنجاح!</b>\n\n📝 أرسل الآن عنوان الاختبار (مثال: اختبار الشهر الأول 1446هـ):',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'ae/cancel')],
        ]),
      },
    );
  }

  // ============================================================
  // Receive Title & Save
  // ============================================================

  async receiveTitle(ctx: Context, title: string) {
    const userId = this.getUserId(ctx);
    const event = this.botEventService.get(userId);

    if (!event || event.event !== BotEventType.WAITING_EXAM_TITLE) {
      return;
    }

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      await ctx.reply('❌ لا يمكن أن يكون العنوان فارغًا.', {
        parse_mode: 'HTML',
      });
      return;
    }

    const courseOfferingId = this.getNumber(event.data?.courseOfferingId);
    const telegramFileId = this.getString(event.data?.telegramFileId);
    const originalMessageId = this.getNumber(event.data?.originalMessageId);
    const type = event.data?.type;

    if (
      !courseOfferingId ||
      !telegramFileId ||
      !originalMessageId ||
      !this.isResourceType(type)
    ) {
      await ctx.reply('❌ بيانات العملية غير مكتملة. يرجى البدء من جديد.', {
        parse_mode: 'HTML',
      });
      this.botEventService.delete(userId);
      return;
    }

    if (!this.STORAGE_CHANNEL_ID) {
      await ctx.reply('❌ قناة تخزين الاختبارات غير معرّفة في الإعدادات.');
      return;
    }

    let storageMessageId: number;

    try {
      const copiedMessage = await ctx.telegram.copyMessage(
        this.STORAGE_CHANNEL_ID,
        ctx.chat!.id,
        originalMessageId,
        {
          caption: cleanTitle,
        },
      );

      storageMessageId = copiedMessage.message_id;
    } catch (error) {
      console.error('Failed to copy exam to storage channel:', error);
      await ctx.reply('❌ حدث خطأ أثناء حفظ الملف في قناة التخزين.');
      return;
    }

    try {
      await this.examService.createExam({
        courseOfferingId,
        title: cleanTitle,
        type,
        telegramChatId: this.STORAGE_CHANNEL_ID,
        telegramMessageId: storageMessageId,
        telegramFileId,
        caption: this.getString(event.data?.caption),
      });
    } catch (error) {
      console.error('Failed to create exam in database:', error);
      await ctx.reply('❌ حدث خطأ أثناء حفظ بيانات الاختبار في قاعدة البيانات.');
      return;
    }

    this.botEventService.delete(userId);

    const typeLabel = type === ResourceType.THEORY ? 'شهري' : 'فصلي';

    await ctx.reply(
      `
🎉 <b>تمت إضافة الاختبار بنجاح!</b>

📝 <b>العنوان:</b> ${this.escapeHtml(cleanTitle)}
🏷️ <b>النوع:</b> اختبار ${typeLabel}
📦 <b>الحالة:</b> تم الحفظ في المخزن وقاعدة البيانات.
      `.trim(),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ إضافة اختبار آخر', 'ae')],
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
      },
    );
  }

  // ============================================================
  // Helpers
  // ============================================================

  private getUserId(ctx: Context): number {
    if (!ctx.from?.id) {
      throw new Error('Telegram user ID is missing');
    }
    return ctx.from.id;
  }

  private getNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    throw new Error('Expected number');
  }

  private getString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    return undefined;
  }

  private isResourceType(value: unknown): value is ResourceType {
    return value === ResourceType.THEORY || value === ResourceType.PRACTICAL;
  }

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
      // fallback
    }

    await ctx.reply(text, extra);
  }
}
