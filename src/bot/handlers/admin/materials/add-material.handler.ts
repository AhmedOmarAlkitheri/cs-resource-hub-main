/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable } from '@nestjs/common';
import { Ctx, Action, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { Prisma, ResourceType } from '@prisma/client';
import { AcademicService } from 'src/academic/services/academic.services';
import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';
import { MaterialService } from 'src/material/services/material.service';
import { BotEventConflictService } from 'src/bot/services/bot-conflict.service';

@Injectable()
@Update()
export class AddMaterialHandler {
  private readonly STORAGE_CHANNEL_ID = process.env.MATERIAL_STORAGE_CHANNEL_ID;

  constructor(
    private readonly academicService: AcademicService,
    private readonly materialService: MaterialService,
    private readonly botEventService: BotEventService,
    private readonly botEventConflictService: BotEventConflictService,
  ) {}

  // ============================================================
  // Callback Router
  // 1. الكلية (am)
  // 2. التخصص (am/{deptId})
  // 3. المستوى (am/{deptId}/${trackId})
  // 4. الفصل (am/{deptId}/${trackId}/${levelId})
  // 5. السنة (am/{deptId}/${trackId}/${levelId}/${termId})
  // 6. المادة (am/{deptId}/${trackId}/${levelId}/${termId}/${yearId})
  // 7. نوع المحتوى: نظري / عملي (am/{deptId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId})
  // 8. رفع الملف (am/{deptId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}/${type})
  // ============================================================

  @Action(/^am(?:\/.*)?$/)
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

    if (parts[0] !== 'am') {
      return;
    }

    await ctx.answerCbQuery();

    if (callbackData === 'am/cancel') {
      this.botEventService.delete(this.getUserId(ctx));
      await this.editOrReply(
        ctx,
        '❌ <b>تم إلغاء عملية إضافة الملزمة.</b>',
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
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

    // 7. نوع المحتوى (نظري / عملي)
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

    // 8. تجهيز رفع الملف
    if (parts.length === 8) {
      await this.handleType(
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
      await this.editOrReply(ctx, '❌ لا توجد كليات مسجلة.');
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>📚 إضافة ملزمة جديدة</b>',
        '',
        '<b>الخطوة 1 من 7: اختر الكلية</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...departments.map((dept) => [
          Markup.button.callback(`🏛️ ${dept.name}`, `am/${dept.id}`),
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
      // الكلية ليس لها تخصصات فرعية، الانتقال مباشرة لاختيار المستوى
      await this.handleMajor(ctx, departmentId, 0);
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>📚 إضافة ملزمة جديدة</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        '',
        '<b>الخطوة 2 من 7: اختر التخصص</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...tracks.map((track) => [
          Markup.button.callback(
            `🎯 ${track.name}`,
            `am/${departmentId}/${track.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق (الكليات)', 'am')],
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
    const track = trackId > 0 ? await this.academicService.getTrackById(trackId) : null;
    const levels = await this.academicService.getLevels();

    const trackInfo = track ? `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}\n` : '';
    const backBtn =
      trackId > 0
        ? Markup.button.callback('🔙 السابق (التخصصات)', `am/${departmentId}`)
        : Markup.button.callback('🔙 السابق (الكليات)', 'am');

    await this.editOrReply(
      ctx,
      [
        '<b>📚 إضافة ملزمة جديدة</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        trackInfo,
        '<b>الخطوة 3 من 7: اختر المستوى الدراسي</b>',
      ]
        .filter(Boolean)
        .join('\n'),
      Markup.inlineKeyboard([
        ...levels.map((level) => [
          Markup.button.callback(
            `📚 ${level.name}`,
            `am/${departmentId}/${trackId}/${level.id}`,
          ),
        ]),
        [backBtn],
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
    const track = trackId > 0 ? await this.academicService.getTrackById(trackId) : null;
    const level = await this.academicService.getLevelById(levelId);
    const terms = await this.academicService.getTerms();

    const trackInfo = track ? `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}\n` : '';

    await this.editOrReply(
      ctx,
      [
        '<b>📚 إضافة ملزمة جديدة</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        trackInfo,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level?.name ?? '')}`,
        '',
        '<b>الخطوة 4 من 7: اختر الفصل الدراسي</b>',
      ]
        .filter(Boolean)
        .join('\n'),
      Markup.inlineKeyboard([
        ...terms.map((term) => [
          Markup.button.callback(
            `🗓️ ${term.name}`,
            `am/${departmentId}/${trackId}/${levelId}/${term.id}`,
          ),
        ]),
        [
          Markup.button.callback(
            '🔙 السابق (المستويات)',
            `am/${departmentId}/${trackId}`,
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
    const track = trackId > 0 ? await this.academicService.getTrackById(trackId) : null;
    const level = await this.academicService.getLevelById(levelId);
    const term = await this.academicService.getTermById(termId);
    const academicYears = await this.academicService.getAcademicYears();

    const trackInfo = track ? `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}\n` : '';

    await this.editOrReply(
      ctx,
      [
        '<b>📚 إضافة ملزمة جديدة</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        trackInfo,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level?.name ?? '')}`,
        `<b>🗓️ الفصل:</b> ${this.escapeHtml(term?.name ?? '')}`,
        '',
        '<b>الخطوة 5 من 7: اختر السنة الدراسية</b>',
      ]
        .filter(Boolean)
        .join('\n'),
      Markup.inlineKeyboard([
        ...academicYears.map((year) => [
          Markup.button.callback(
            `📅 ${year.startYear} - ${year.endYear}`,
            `am/${departmentId}/${trackId}/${levelId}/${termId}/${year.id}`,
          ),
        ]),
        [
          Markup.button.callback(
            '🔙 السابق (الفصول)',
            `am/${departmentId}/${trackId}/${levelId}`,
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

    const previousCallback = `am/${departmentId}/${trackId}/${levelId}/${termId}`;

    if (!offerings.length) {
      await this.editOrReply(
        ctx,
        '❌ لا توجد مقررات دراسية مسندة لهذا الفصل.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 السابق', previousCallback)],
        ]),
      );
      return;
    }

    const trackInfo = track ? `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}\n` : '';

    await this.editOrReply(
      ctx,
      [
        '<b>📚 إضافة ملزمة جديدة</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        trackInfo,
        `<b>📚 المستوى:</b> ${this.escapeHtml(level?.name ?? '')}`,
        `<b>🗓️ الفصل:</b> ${this.escapeHtml(term?.name ?? '')}`,
        `<b>📅 السنة:</b> ${academicYear?.startYear} - ${academicYear?.endYear}`,
        '',
        '<b>الخطوة 6 من 7: اختر المقرر / المادة</b>',
      ]
        .filter(Boolean)
        .join('\n'),
      Markup.inlineKeyboard([
        ...offerings.map((offering) => [
          Markup.button.callback(
            `📖 ${offering.course.name}`,
            `am/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${offering.courseId}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق (السنوات)', previousCallback)],
      ]),
    );
  }

  // ============================================================
  // Step 7: Choose Material Type (نظري / عملي)
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
    const offering = await this.academicService.findCourseOffering({
      courseId,
      departmentId,
      trackId: trackId > 0 ? trackId : undefined,
      levelId,
      termId,
      academicYearId: yearId,
    });

    if (!offering) {
      await this.editOrReply(ctx, '❌ المقرر غير موجود.');
      return;
    }

    const basePath = `am/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    await this.editOrReply(
      ctx,
      [
        '<b>📚 إضافة ملزمة جديدة</b>',
        '',
        `<b>📖 المادة:</b> ${this.escapeHtml(offering.course.name)}`,
        '',
        '<b>الخطوة 7 من 7: اختر نوع المحتوى</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('📘 ملازم ومحاضرات نظري', `${basePath}/T`)],
        [Markup.button.callback('🛠️ مذكرات وتطبيقات عملي', `${basePath}/P`)],
        [
          Markup.button.callback(
            '🔙 السابق (المواد)',
            `am/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}`,
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
      await this.editOrReply(ctx, '❌ النوع غير صحيح.');
      return;
    }

    const type =
      typeValue === 'T' ? ResourceType.THEORY : ResourceType.PRACTICAL;
    const typeLabel = typeValue === 'T' ? 'نظري' : 'عملي';

    const offering = await this.academicService.findCourseOffering({
      courseId,
      departmentId,
      trackId: trackId > 0 ? trackId : undefined,
      levelId,
      termId,
      academicYearId: yearId,
    });

    if (!offering) {
      await this.editOrReply(ctx, '❌ المقرر غير موجود.');
      return;
    }

    const userId = this.getUserId(ctx);

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_MATERIAL_DOCUMENT,
      data: {
        departmentId,
        trackId: trackId > 0 ? trackId : undefined,
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
        '<b>📚 إضافة ملزمة جديدة</b>',
        '',
        `<b>📖 المادة:</b> ${this.escapeHtml(offering.course.name)}`,
        `<b>🏷️ النوع:</b> ${typeLabel}`,
        '',
        '<b>📎 أرسل الآن ملف الملزمة</b> (PDF أو مستند):',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ إلغاء العملية', 'am/cancel')],
      ]),
    );
  }

  // ============================================================
  // Handle Document
  // ============================================================

  async handleDocument(ctx: Context) {
    const userId = this.getUserId(ctx);
    const event = this.botEventService.get(userId);

    if (!event || event.event !== BotEventType.WAITING_MATERIAL_DOCUMENT) {
      return;
    }

    const message = ctx.message;
    if (!message || !('document' in message)) {
      return;
    }

    const document = message.document;

    this.botEventService.update(userId, {
      event: BotEventType.WAITING_MATERIAL_TITLE,
      data: {
        ...(event.data ?? {}),
        telegramFileId: document.file_id,
        originalMessageId: message.message_id,
        caption: 'caption' in message ? message.caption : undefined,
      },
    });

    await ctx.reply(
      '✅ <b>تم استلام الملف بنجاح!</b>\n\n📝 أرسل الآن عنوان الملزمة (مثال: ملزمة المحاضرات الشاملة):',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'am/cancel')],
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

    if (!event || event.event !== BotEventType.WAITING_MATERIAL_TITLE) {
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
      await ctx.reply('❌ بيانات العملية غير مكتملة.', { parse_mode: 'HTML' });
      this.botEventService.delete(userId);
      return;
    }

    if (!this.STORAGE_CHANNEL_ID) {
      await ctx.reply('❌ قناة تخزين الملازم غير معرّفة.');
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
      console.error('Failed to copy material to storage channel:', error);
      await ctx.reply('❌ حدث خطأ أثناء حفظ الملف في قناة التخزين.');
      return;
    }

    try {
      await this.materialService.createMaterial({
        courseOfferingId,
        title: cleanTitle,
        type,
        telegramChatId: this.STORAGE_CHANNEL_ID,
        telegramMessageId: storageMessageId,
        telegramFileId,
        caption: this.getString(event.data?.caption),
      });
    } catch (error) {
      console.error('Failed to create material in database:', error);
      await ctx.reply('❌ حدث خطأ أثناء الحفظ في قاعدة البيانات.');
      return;
    }

    this.botEventService.delete(userId);

    const typeLabel = type === ResourceType.THEORY ? 'نظري' : 'عملي';

    await ctx.reply(
      `
🎉 <b>تمت إضافة الملزمة بنجاح!</b>

📝 <b>العنوان:</b> ${this.escapeHtml(cleanTitle)}
🏷️ <b>النوع:</b> ${typeLabel}
📦 <b>الحالة:</b> تم الحفظ في المخزن وقاعدة البيانات.
      `.trim(),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ إضافة ملزمة أخرى', 'am')],
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
