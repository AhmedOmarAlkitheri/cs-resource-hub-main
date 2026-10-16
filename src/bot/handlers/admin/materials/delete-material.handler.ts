/* eslint-disable @typescript-eslint/no-unused-vars */

import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Injectable } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { ResourceType } from '@prisma/client';
import { AcademicService } from 'src/academic/services/academic.services';
import { MaterialService } from 'src/material/services/material.service';
import { BotEventService } from 'src/bot/services/bot-event.service';

@Injectable()
@Update()
export class DeleteMaterialHandler {
  constructor(
    private readonly academicService: AcademicService,
    private readonly materialService: MaterialService,
    private readonly botEventService: BotEventService,
  ) {}

  @Action(/^dm(?:\/.*)?$/)
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

    if (parts[0] !== 'dm') {
      return;
    }

    await ctx.answerCbQuery();

    if (parts.length === 3 && parts[1] === 'prompt_del') {
      const materialId = Number(parts[2]);
      if (!Number.isInteger(materialId)) {
        await this.editOrReply(ctx, '❌ رقم الملزمة غير صحيح.');
        return;
      }
      await this.promptDeleteMaterial(ctx, materialId);
      return;
    }

    if (parts.length === 3 && parts[1] === 'confirm') {
      const materialId = Number(parts[2]);
      if (!Number.isInteger(materialId)) {
        await this.editOrReply(ctx, '❌ رقم الملزمة غير صحيح.');
        return;
      }
      await this.deleteMaterial(ctx, materialId);
      return;
    }

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

    // 7. نوع المحتوى
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

    // 8. عرض الملازم للحذف
    if (parts.length === 8) {
      await this.showMaterialsToDelete(
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

  async start(ctx: Context) {
    const departments = await this.academicService.getDepartments();

    if (!departments.length) {
      await this.editOrReply(ctx, '❌ لا توجد كليات مسجلة.');
      return;
    }

    await this.editOrReply(
      ctx,
      ['<b>🗑️ حذف ملزمة</b>', '', '<b>الخطوة 1 من 7: اختر الكلية</b>'].join(
        '\n',
      ),
      Markup.inlineKeyboard([
        ...departments.map((dept) => [
          Markup.button.callback(`🏛️ ${dept.name}`, `dm/${dept.id}`),
        ]),
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
      ]),
    );
  }

  private async handleCollege(ctx: Context, departmentId: number) {
    const department =
      await this.academicService.getDepartmentById(departmentId);
    const tracks =
      await this.academicService.getTracksByDepartmentId(departmentId);

    if (!tracks.length) {
      await this.handleMajor(ctx, departmentId, 0);
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف ملزمة</b>',
        '',
        `<b>🏛️ الكلية:</b> ${this.escapeHtml(department?.name ?? '')}`,
        '',
        '<b>الخطوة 2 من 7: اختر التخصص</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...tracks.map((track) => [
          Markup.button.callback(
            `🎯 ${track.name}`,
            `dm/${departmentId}/${track.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق', 'dm')],
      ]),
    );
  }

  private async handleMajor(
    ctx: Context,
    departmentId: number,
    trackId: number,
  ) {
    const levels = await this.academicService.getLevels();
    const track = trackId > 0 ? await this.academicService.getTrackById(trackId) : null;
    const trackInfo = track ? `<b>🎯 التخصص:</b> ${this.escapeHtml(track.name)}\n` : '';
    const backBtn =
      trackId > 0
        ? Markup.button.callback('🔙 السابق', `dm/${departmentId}`)
        : Markup.button.callback('🔙 السابق', 'dm');

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف ملزمة</b>',
        '',
        trackInfo,
        '<b>الخطوة 3 من 7: اختر المستوى</b>',
      ]
        .filter(Boolean)
        .join('\n'),
      Markup.inlineKeyboard([
        ...levels.map((level) => [
          Markup.button.callback(
            `📚 ${level.name}`,
            `dm/${departmentId}/${trackId}/${level.id}`,
          ),
        ]),
        [backBtn],
      ]),
    );
  }

  private async handleLevel(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
  ) {
    const terms = await this.academicService.getTerms();

    await this.editOrReply(
      ctx,
      ['<b>🗑️ حذف ملزمة</b>', '', '<b>الخطوة 4 من 7: اختر الفصل</b>'].join(
        '\n',
      ),
      Markup.inlineKeyboard([
        ...terms.map((term) => [
          Markup.button.callback(
            `🗓️ ${term.name}`,
            `dm/${departmentId}/${trackId}/${levelId}/${term.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق', `dm/${departmentId}/${trackId}`)],
      ]),
    );
  }

  private async handleTerm(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
    termId: number,
  ) {
    const academicYears = await this.academicService.getAcademicYears();

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف ملزمة</b>',
        '',
        '<b>الخطوة 5 من 7: اختر السنة الدراسية</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...academicYears.map((year) => [
          Markup.button.callback(
            `📅 ${year.startYear} - ${year.endYear}`,
            `dm/${departmentId}/${trackId}/${levelId}/${termId}/${year.id}`,
          ),
        ]),
        [
          Markup.button.callback(
            '🔙 السابق',
            `dm/${departmentId}/${trackId}/${levelId}`,
          ),
        ],
      ]),
    );
  }

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
      trackId: trackId > 0 ? trackId : undefined,
      levelId,
      termId,
      academicYearId: yearId,
    });

    const previousCallback = `dm/${departmentId}/${trackId}/${levelId}/${termId}`;

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

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف ملزمة</b>',
        '',
        '<b>الخطوة 6 من 7: اختر المقرر / المادة</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        ...offerings.map((offering) => [
          Markup.button.callback(
            `📖 ${offering.course.name}`,
            `dm/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${offering.courseId}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق', previousCallback)],
      ]),
    );
  }

  private async handleCourse(
    ctx: Context,
    departmentId: number,
    trackId: number,
    levelId: number,
    termId: number,
    yearId: number,
    courseId: number,
  ) {
    const basePath = `dm/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ حذف ملزمة</b>',
        '',
        '<b>الخطوة 7 من 7: اختر نوع المحتوى</b>',
      ].join('\n'),
      Markup.inlineKeyboard([
        [Markup.button.callback('📘 نظري', `${basePath}/T`)],
        [Markup.button.callback('🛠️ عملي', `${basePath}/P`)],
        [
          Markup.button.callback(
            '🔙 السابق',
            `dm/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}`,
          ),
        ],
      ]),
    );
  }

  private async showMaterialsToDelete(
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

    const materials = await this.materialService.getMaterials(
      offering.id,
      type,
    );

    const backCallback = `dm/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    if (!materials.length) {
      await this.editOrReply(
        ctx,
        `ℹ️ لا توجد ملازم (${typeLabel}) مرفوعة لهذه المادة لحذفها.`,
        Markup.inlineKeyboard([
          [{ text: '🔙 السابق', callback_data: backCallback }],
        ]),
      );
      return;
    }

    await this.editOrReply(
      ctx,
      [
        '<b>🗑️ اختر الملزمة المطلوب حذفها:</b>',
        '',
        `<b>المادة:</b> ${this.escapeHtml(offering.course.name)}`,
        `<b>النوع:</b> ${typeLabel}`,
      ].join('\n'),
      Markup.inlineKeyboard([
        ...materials.map((m) => [
          Markup.button.callback(
            `🗑️ ${m.title}`,
            `dm/prompt_del/${m.id}`,
          ),
        ]),
        [Markup.button.callback('🔙 السابق', backCallback)],
      ]),
    );
  }

  private async promptDeleteMaterial(ctx: Context, materialId: number) {
    const material = await this.materialService.getMaterialById(materialId);
    const title = material ? material.title : `ملزمة #${materialId}`;

    await this.editOrReply(
      ctx,
      '⚠️ <b>تأكيد حذف الملزمة</b>\n\n' +
        `📄 <b>اسم الملزمة:</b> ${this.escapeHtml(title)}\n` +
        `🆔 <b>رقم المعرّف:</b> <code>${materialId}</code>\n\n` +
        'هل أنت متأكد من رغبتك بحذف هذه الملزمة نهائياً من قاعدة البيانات؟',
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '⚠️ نعم، احذف الملزمة نهائياً',
            `dm/confirm/${materialId}`,
          ),
        ],
        [Markup.button.callback('❌ إلغاء وتراجع', 'dm')],
      ]),
    );
  }

  private async deleteMaterial(ctx: Context, materialId: number) {
    try {
      const material = await this.materialService.getMaterialById(materialId);
      const title = material ? material.title : '';

      await this.materialService.deleteMaterial(materialId);

      await this.editOrReply(
        ctx,
        `✅ <b>تم حذف الملزمة بنجاح!</b>\n\n` +
          (title ? `📄 <b>الملزمة المحذوفة:</b> ${this.escapeHtml(title)}` : ''),
        Markup.inlineKeyboard([
          [Markup.button.callback('🗑️ حذف ملزمة أخرى', 'dm')],
          [Markup.button.callback('📂 قسم الملازم', 'admin_materials')],
          [Markup.button.callback('🏠 الرئيسية', 'main_menu')],
        ]),
      );
    } catch (error) {
      console.error('Failed to delete material:', error);
      await this.editOrReply(ctx, '❌ حدث خطأ أثناء حذف الملزمة.');
    }
  }

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
