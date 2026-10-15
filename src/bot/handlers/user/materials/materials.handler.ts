import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ResourceType } from '@prisma/client';
import { AcademicService } from 'src/academic/services/academic.services';
import { MaterialService } from 'src/material/services/material.service';

@Update()
export class MaterialsHandler {
  constructor(
    private readonly materialService: MaterialService,
    private readonly academicService: AcademicService,
  ) {}

  // ============================================================
  // Main Router - الملازم والمقررات
  // 1. الكلية (sm)
  // 2. التخصص (sm/{deptId})
  // 3. المستوى (sm/{deptId}/{trackId})
  // 4. الفصل الدراسي (sm/{deptId}/{trackId}/{levelId})
  // 5. السنة الدراسية (sm/{deptId}/{trackId}/{levelId}/{termId})
  // 6. المقرر / المادة (sm/{deptId}/{trackId}/{levelId}/{termId}/{yearId})
  // 7. نوع المحتوى: نظري / عملي (sm/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId})
  // 8. إرسال الملازم (sm/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}/{type})
  // ============================================================

  @Action(/^sm(?:\/.*)?$/)
  async handle(@Ctx() ctx: Context) {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return;
    }

    const data = callbackQuery.data;

    if (typeof data !== 'string') {
      return;
    }

    const parts = data.split('/');

    // استجابة فورية لتليجرام لإلغاء أيقونة التحميل بسرعة فائقة
    void ctx.answerCbQuery().catch(() => {});

    // 1. الكلية: sm
    if (parts.length === 1) {
      await this.showColleges(ctx);
      return;
    }

    // 2. التخصص: sm/{deptId}
    if (parts.length === 2) {
      await this.showMajors(ctx, Number(parts[1]));
      return;
    }

    // 3. المستوى: sm/{deptId}/{trackId}
    if (parts.length === 3) {
      await this.showLevels(ctx, Number(parts[1]), Number(parts[2]));
      return;
    }

    // 4. الفصل: sm/{deptId}/{trackId}/{levelId}
    if (parts.length === 4) {
      await this.showTerms(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
      );
      return;
    }

    // 5. السنة الدراسية: sm/{deptId}/{trackId}/{levelId}/{termId}
    if (parts.length === 5) {
      await this.showAcademicYears(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
        Number(parts[4]),
      );
      return;
    }

    // 6. المقرر / المادة: sm/{deptId}/{trackId}/{levelId}/{termId}/{yearId}
    if (parts.length === 6) {
      await this.showCourses(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
        Number(parts[4]),
        Number(parts[5]),
      );
      return;
    }

    // 7. نوع المحتوى: sm/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}
    if (parts.length === 7) {
      await this.showMaterialTypes(
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

    // 8. إرسال الملازم: sm/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}/{type}
    if (parts.length === 8) {
      await this.sendMaterials(
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
  // 1. الكليات (Colleges)
  // ============================================================

  private async showColleges(ctx: Context) {
    const departments = await this.academicService.getDepartments();

    await ctx.answerCbQuery();

    if (!departments.length) {
      await ctx.editMessageText(
        `
📚 <b>الملازم والمقررات</b>

❌ لا توجد كليات متاحة حاليًا في النظام.
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 القائمة الرئيسية', callback_data: 'main_menu' }],
            ],
          },
        },
      );
      return;
    }

    await ctx.editMessageText(
      `
📚 <b>قسم الملازم والمقررات الدراسية</b>

اختر <b>الكلية</b> لعرض التخصصات والمقررات:
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...departments.map((dept) => [
              {
                text: `🏛️ ${dept.name}`,
                callback_data: `sm/${dept.id}`,
              },
            ]),
            [{ text: '🔙 القائمة الرئيسية', callback_data: 'main_menu' }],
          ],
        },
      },
    );
  }

  // ============================================================
  // 2. التخصصات (Majors)
  // ============================================================

  private async showMajors(ctx: Context, departmentId: number) {
    const department =
      await this.academicService.getDepartmentById(departmentId);

    if (!department) {
      await ctx.answerCbQuery('الكلية غير موجودة.');
      return;
    }

    const tracks =
      await this.academicService.getTracksByDepartmentId(departmentId);

    await ctx.answerCbQuery();

    if (!tracks.length) {
      await ctx.editMessageText(
        `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}

❌ لا توجد تخصصات مضافة لهذه الكلية حتى الآن.
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 السابق (الكليات)', callback_data: 'sm' }],
            ],
          },
        },
      );
      return;
    }

    await ctx.editMessageText(
      `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}

🎯 <b>اختر التخصص الأكاديمي:</b>
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...tracks.map((track) => [
              {
                text: `🎯 ${track.name}`,
                callback_data: `sm/${departmentId}/${track.id}`,
              },
            ]),
            [{ text: '🔙 السابق (الكليات)', callback_data: 'sm' }],
          ],
        },
      },
    );
  }

  // ============================================================
  // 3. المستويات الدراسية (Levels)
  // ============================================================

  private async showLevels(
    ctx: Context,
    departmentId: number,
    trackId: number,
  ) {
    const department =
      await this.academicService.getDepartmentById(departmentId);
    const track = await this.academicService.getTrackById(trackId);

    if (!department || !track) {
      await ctx.answerCbQuery('البيانات غير صحيحة.');
      return;
    }

    const levels = await this.academicService.getLevels();

    await ctx.answerCbQuery();

    if (!levels.length) {
      await ctx.editMessageText(
        `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}

❌ لم يتم إعداد المستويات الدراسية حتى الآن.
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 السابق', callback_data: `sm/${departmentId}` }],
            ],
          },
        },
      );
      return;
    }

    await ctx.editMessageText(
      `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}

📚 <b>اختر المستوى الدراسي:</b>
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...levels.map((level) => [
              {
                text: `📚 ${level.name}`,
                callback_data: `sm/${departmentId}/${trackId}/${level.id}`,
              },
            ]),
            [{ text: '🔙 السابق (التخصصات)', callback_data: `sm/${departmentId}` }],
          ],
        },
      },
    );
  }

  // ============================================================
  // 4. الفصول الدراسية (Terms)
  // ============================================================

  private async showTerms(
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
      await ctx.answerCbQuery('البيانات غير صحيحة.');
      return;
    }

    const terms = await this.academicService.getTerms();

    await ctx.answerCbQuery();

    if (!terms.length) {
      await ctx.editMessageText(
        `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}
📚 <b>المستوى:</b> ${this.escapeHtml(level.name)}

❌ لا توجد فصول دراسية متاحة حالياً.
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔙 السابق',
                  callback_data: `sm/${departmentId}/${trackId}`,
                },
              ],
            ],
          },
        },
      );
      return;
    }

    await ctx.editMessageText(
      `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}
📚 <b>المستوى:</b> ${this.escapeHtml(level.name)}

🗓️ <b>اختر الفصل الدراسي:</b>
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...terms.map((term) => [
              {
                text: `🗓️ ${term.name}`,
                callback_data: `sm/${departmentId}/${trackId}/${levelId}/${term.id}`,
              },
            ]),
            [
              {
                text: '🔙 السابق (المستويات)',
                callback_data: `sm/${departmentId}/${trackId}`,
              },
            ],
          ],
        },
      },
    );
  }

  // ============================================================
  // 5. السنوات الدراسية (Academic Years)
  // ============================================================

  private async showAcademicYears(
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
      await ctx.answerCbQuery('البيانات غير صحيحة.');
      return;
    }

    const academicYears = await this.academicService.getAcademicYears();

    await ctx.answerCbQuery();

    if (!academicYears.length) {
      await ctx.editMessageText(
        `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}
📚 <b>المستوى:</b> ${this.escapeHtml(level.name)}
🗓️ <b>الفصل:</b> ${this.escapeHtml(term.name)}

❌ لا توجد سنوات دراسية مسجلة.
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔙 السابق',
                  callback_data: `sm/${departmentId}/${trackId}/${levelId}`,
                },
              ],
            ],
          },
        },
      );
      return;
    }

    await ctx.editMessageText(
      `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}
📚 <b>المستوى:</b> ${this.escapeHtml(level.name)}
🗓️ <b>الفصل:</b> ${this.escapeHtml(term.name)}

📅 <b>اختر السنة الدراسية:</b>
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...academicYears.map((year) => [
              {
                text: `📅 ${year.startYear} - ${year.endYear}`,
                callback_data: `sm/${departmentId}/${trackId}/${levelId}/${termId}/${year.id}`,
              },
            ]),
            [
              {
                text: '🔙 السابق (الفصول)',
                callback_data: `sm/${departmentId}/${trackId}/${levelId}`,
              },
            ],
          ],
        },
      },
    );
  }

  // ============================================================
  // 6. المقررات / المواد (Courses)
  // ============================================================

  private async showCourses(
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
      await ctx.answerCbQuery('البيانات غير صحيحة.');
      return;
    }

    const offerings = await this.academicService.getCoursesByContext({
      departmentId,
      trackId,
      levelId,
      termId,
      academicYearId: yearId,
    });

    await ctx.answerCbQuery();

    if (!offerings.length) {
      await ctx.editMessageText(
        `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}
📚 <b>المستوى:</b> ${this.escapeHtml(level.name)}
🗓️ <b>الفصل:</b> ${this.escapeHtml(term.name)}
📅 <b>السنة:</b> ${academicYear.startYear} - ${academicYear.endYear}

⚠️ <b>لا توجد مقررات مسجلة لهذا الاختيار حالياً.</b>
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔙 السابق (السنوات)',
                  callback_data: `sm/${departmentId}/${trackId}/${levelId}/${termId}`,
                },
              ],
            ],
          },
        },
      );
      return;
    }

    await ctx.editMessageText(
      `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}
📚 <b>المستوى:</b> ${this.escapeHtml(level.name)}
🗓️ <b>الفصل:</b> ${this.escapeHtml(term.name)}
📅 <b>السنة:</b> ${academicYear.startYear} - ${academicYear.endYear}

📖 <b>اختر المقرر / المادة:</b>
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...offerings.map((offering) => [
              {
                text: `📖 ${offering.course.name}`,
                callback_data: `sm/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${offering.courseId}`,
              },
            ]),
            [
              {
                text: '🔙 السابق (السنوات)',
                callback_data: `sm/${departmentId}/${trackId}/${levelId}/${termId}`,
              },
            ],
          ],
        },
      },
    );
  }

  // ============================================================
  // 7. نوع المادة (نظري / عملي)
  // ============================================================

  private async showMaterialTypes(
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
      await ctx.answerCbQuery('المقرر غير موجود.');
      return;
    }

    await ctx.answerCbQuery();

    const basePath = `sm/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    await ctx.editMessageText(
      `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}
📚 <b>المستوى:</b> ${this.escapeHtml(level.name)}
🗓️ <b>الفصل:</b> ${this.escapeHtml(term.name)}
📅 <b>السنة:</b> ${academicYear.startYear} - ${academicYear.endYear}
📖 <b>المادة:</b> ${this.escapeHtml(offering.course.name)}

📑 <b>اختر نوع المحتوى المطلوب:</b>
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📘 ملازم ومحاضرات نظري',
                callback_data: `${basePath}/T`,
              },
            ],
            [
              {
                text: '🛠️ مذكرات وتطبيقات عملي',
                callback_data: `${basePath}/P`,
              },
            ],
            [
              {
                text: '🔙 السابق (المواد)',
                callback_data: `sm/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}`,
              },
            ],
          ],
        },
      },
    );
  }

  // ============================================================
  // 8. إرسال الملازم والمقررات (Send Materials)
  // ============================================================

  private async sendMaterials(
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
      await ctx.answerCbQuery('النوع غير صحيح.');
      return;
    }

    const type =
      typeValue === 'T' ? ResourceType.THEORY : ResourceType.PRACTICAL;
    const typeLabel = typeValue === 'T' ? 'نظري' : 'عملي';

    const offering = await this.academicService.findCourseOffering({
      courseId,
      departmentId,
      trackId,
      levelId,
      termId,
      academicYearId: yearId,
    });

    if (!offering) {
      await ctx.answerCbQuery('لم يتم العثور على المقرر.');
      return;
    }

    const materials = await this.materialService.getMaterials(
      offering.id,
      type,
    );

    await ctx.answerCbQuery();

    const backCallback = `sm/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    if (!materials.length) {
      await ctx.editMessageText(
        `
📚 <b>الملازم والمقررات</b>

📖 <b>المادة:</b> ${this.escapeHtml(offering.course.name)}
🏷️ <b>النوع:</b> ${typeLabel}

ℹ️ <b>لم يتم رفع ملازم (${typeLabel}) لهذه المادة حتى الآن.</b>
<i>سيتم إضافتها فور توفرها من قِبل إدارة الكلية.</i>
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 السابق', callback_data: backCallback }],
              [{ text: '🏠 الرئيسية', callback_data: 'main_menu' }],
            ],
          },
        },
      );
      return;
    }

    await ctx.editMessageText(
      `
⏳ <b>جاري إرسال الملازم...</b>

📖 <b>المادة:</b> ${this.escapeHtml(offering.course.name)}
🏷️ <b>النوع:</b> ${typeLabel}
📦 <b>العدد:</b> ${materials.length} ملف
      `.trim(),
      {
        parse_mode: 'HTML',
      },
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const material of materials) {
      try {
        await ctx.telegram.copyMessage(
          ctx.chat!.id,
          material.telegramChatId,
          material.telegramMessageId,
        );
        sentCount++;
      } catch (error) {
        failedCount++;
        console.error(`Failed to send material ${material.id}:`, error);
      }
    }

    if (failedCount === 0) {
      await ctx.telegram.sendMessage(
        ctx.chat!.id,
        `
✅ <b>تم إرسال الملازم بنجاح!</b>

📖 <b>المادة:</b> ${this.escapeHtml(offering.course.name)}
🏷️ <b>النوع:</b> ${typeLabel}
📦 <b>عدد الملفات:</b> ${sentCount}
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 السابق', callback_data: backCallback }],
              [{ text: '🏠 الرئيسية', callback_data: 'main_menu' }],
            ],
          },
        },
      );
    } else {
      await ctx.telegram.sendMessage(
        ctx.chat!.id,
        `
⚠️ <b>اكتمل الإرسال:</b>
تم إرسال: ${sentCount}
تعذر إرسال: ${failedCount}
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 السابق', callback_data: backCallback }],
              [{ text: '🏠 الرئيسية', callback_data: 'main_menu' }],
            ],
          },
        },
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
      .replace(/"/g, '&quot;');
  }
}
