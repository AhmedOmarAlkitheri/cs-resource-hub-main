import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ResourceType } from '@prisma/client';
import { AcademicService } from 'src/academic/services/academic.services';
import { ExamService } from 'src/exam/services/exam.service';

@Update()
export class ExamsHandler {
  constructor(
    private readonly examService: ExamService,
    private readonly academicService: AcademicService,
  ) {}

  // ============================================================
  // Main Router
  // الهيكل الصحيح لجامعة أهل الحديث:
  // 1. الكلية (se)
  // 2. التخصص (se/{deptId})
  // 3. المستوى (se/{deptId}/{trackId})
  // 4. الفصل الدراسي (se/{deptId}/{trackId}/{levelId})
  // 5. السنة الدراسية (se/{deptId}/{trackId}/{levelId}/{termId})
  // 6. المادة / المقرر (se/{deptId}/{trackId}/{levelId}/{termId}/{yearId})
  // 7. نوع الاختبار: شهري أو فصلي فقط (se/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId})
  // 8. إرسال الاختبارات (se/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}/{type})
  // ============================================================

  @Action(/^se(?:\/.*)?$/)
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

    // 1. الكلية: se
    if (parts.length === 1) {
      await this.showColleges(ctx);
      return;
    }

    // 2. التخصص: se/{deptId}
    if (parts.length === 2) {
      await this.showMajors(ctx, Number(parts[1]));
      return;
    }

    // 3. المستوى: se/{deptId}/{trackId}
    if (parts.length === 3) {
      await this.showLevels(ctx, Number(parts[1]), Number(parts[2]));
      return;
    }

    // 4. الفصل: se/{deptId}/{trackId}/{levelId}
    if (parts.length === 4) {
      await this.showTerms(
        ctx,
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
      );
      return;
    }

    // 5. السنة الدراسية: se/{deptId}/{trackId}/{levelId}/{termId}
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

    // 6. المقرر / المادة: se/{deptId}/{trackId}/{levelId}/{termId}/{yearId}
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

    // 7. نوع الاختبار: se/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}
    if (parts.length === 7) {
      await this.showExamTypes(
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

    // 8. إرسال الاختبار: se/{deptId}/{trackId}/{levelId}/{termId}/{yearId}/{courseId}/{type}
    if (parts.length === 8) {
      await this.sendExams(
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
  // 1. الكليات (Colleges / Departments)
  // ============================================================

  private async showColleges(ctx: Context) {
    const departments = await this.academicService.getDepartments();

    await ctx.answerCbQuery();

    if (!departments.length) {
      await ctx.editMessageText(
        `
🏛️ <b>بنك الاختبارات</b>

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
🏛️ <b>بنك الاختبارات الأكاديمي</b>

اختر <b>الكلية</b> لعرض التخصصات والمقررات:
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...departments.map((dept) => [
              {
                text: `🏛️ ${dept.name}`,
                callback_data: `se/${dept.id}`,
              },
            ]),
            [{ text: '🔙 القائمة الرئيسية', callback_data: 'main_menu' }],
          ],
        },
      },
    );
  }

  // ============================================================
  // 2. التخصصات (Majors / Tracks)
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
              [{ text: '🔙 السابق (الكليات)', callback_data: 'se' }],
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
                callback_data: `se/${departmentId}/${track.id}`,
              },
            ]),
            [{ text: '🔙 السابق (الكليات)', callback_data: 'se' }],
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
      await ctx.answerCbQuery('البيانات المحددة غير صحيحة.');
      return;
    }

    const levels = await this.academicService.getLevels();

    await ctx.answerCbQuery();

    if (!levels.length) {
      await ctx.editMessageText(
        `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}

❌ لم يتم إعداد المستويات الدراسية في النظام حتى الآن.
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 السابق', callback_data: `se/${departmentId}` }],
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
                callback_data: `se/${departmentId}/${trackId}/${level.id}`,
              },
            ]),
            [{ text: '🔙 السابق (التخصصات)', callback_data: `se/${departmentId}` }],
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
      await ctx.answerCbQuery('البيانات المحددة غير صحيحة.');
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
                  callback_data: `se/${departmentId}/${trackId}`,
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
                callback_data: `se/${departmentId}/${trackId}/${levelId}/${term.id}`,
              },
            ]),
            [
              {
                text: '🔙 السابق (المستويات)',
                callback_data: `se/${departmentId}/${trackId}`,
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
      await ctx.answerCbQuery('البيانات المحددة غير صحيحة.');
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

❌ لا توجد سنوات دراسية مسجلة في النظام.
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔙 السابق',
                  callback_data: `se/${departmentId}/${trackId}/${levelId}`,
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
                callback_data: `se/${departmentId}/${trackId}/${levelId}/${termId}/${year.id}`,
              },
            ]),
            [
              {
                text: '🔙 السابق (الفصول)',
                callback_data: `se/${departmentId}/${trackId}/${levelId}`,
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
      await ctx.answerCbQuery('البيانات المحددة غير صحيحة.');
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

⚠️ <b>لا توجد مقررات دراسية مسجلة لهذا الاختيار حالياً.</b>
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔙 السابق (السنوات)',
                  callback_data: `se/${departmentId}/${trackId}/${levelId}/${termId}`,
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
                callback_data: `se/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${offering.courseId}`,
              },
            ]),
            [
              {
                text: '🔙 السابق (السنوات)',
                callback_data: `se/${departmentId}/${trackId}/${levelId}/${termId}`,
              },
            ],
          ],
        },
      },
    );
  }

  // ============================================================
  // 7. نوع الاختبار: شهري أو فصلي فقط (Exam Types)
  // ============================================================

  private async showExamTypes(
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

    const basePath = `se/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    await ctx.editMessageText(
      `
🏛️ <b>الكلية:</b> ${this.escapeHtml(department.name)}
🎯 <b>التخصص:</b> ${this.escapeHtml(track.name)}
📚 <b>المستوى:</b> ${this.escapeHtml(level.name)}
🗓️ <b>الفصل:</b> ${this.escapeHtml(term.name)}
📅 <b>السنة:</b> ${academicYear.startYear} - ${academicYear.endYear}
📖 <b>المادة:</b> ${this.escapeHtml(offering.course.name)}

📝 <b>اختر نوع الاختبار المطلوب:</b>
      `.trim(),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📝 اختبار شهري',
                callback_data: `${basePath}/T`,
              },
            ],
            [
              {
                text: '📑 اختبار فصلي',
                callback_data: `${basePath}/P`,
              },
            ],
            [
              {
                text: '🔙 السابق (المواد)',
                callback_data: `se/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}`,
              },
            ],
          ],
        },
      },
    );
  }

  // ============================================================
  // 8. إرسال الاختبارات (Send Exams)
  // ============================================================

  private async sendExams(
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
      await ctx.answerCbQuery('نوع الاختبار غير صحيح.');
      return;
    }

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
      await ctx.answerCbQuery('لم يتم العثور على المقرر.');
      return;
    }

    const exams = await this.examService.getExams(offering.id, type);

    await ctx.answerCbQuery();

    const backCallback = `se/${departmentId}/${trackId}/${levelId}/${termId}/${yearId}/${courseId}`;

    if (!exams.length) {
      await ctx.editMessageText(
        `
📝 <b>بنك الاختبارات</b>

📖 <b>المادة:</b> ${this.escapeHtml(offering.course.name)}
🏷️ <b>النوع:</b> اختبار ${typeLabel}

ℹ️ <b>لم يتم رفع أي نماذج لاختبار (${typeLabel}) لهذه المادة حتى الآن.</b>
<i>سيتم إضافتها فور توفرها من قِبل إدارة الكلية.</i>
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 السابق (نوع الاختبار)', callback_data: backCallback }],
              [{ text: '🏠 الرئيسية', callback_data: 'main_menu' }],
            ],
          },
        },
      );
      return;
    }

    // إشعار جارٍ الإرسال
    await ctx.editMessageText(
      `
⏳ <b>جاري إرسال نماذج الاختبارات...</b>

📖 <b>المادة:</b> ${this.escapeHtml(offering.course.name)}
🏷️ <b>النوع:</b> اختبار ${typeLabel}
📦 <b>العدد:</b> ${exams.length} ملف
      `.trim(),
      {
        parse_mode: 'HTML',
      },
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const exam of exams) {
      try {
        await ctx.telegram.copyMessage(
          ctx.chat!.id,
          exam.telegramChatId,
          exam.telegramMessageId,
        );
        sentCount++;
      } catch (error) {
        failedCount++;
        console.error(`Failed to send exam ${exam.id}:`, error);
      }
    }

    if (failedCount === 0) {
      await ctx.telegram.sendMessage(
        ctx.chat!.id,
        `
✅ <b>تم إرسال نماذج الاختبارات بنجاح!</b>

📖 <b>المادة:</b> ${this.escapeHtml(offering.course.name)}
🏷️ <b>النوع:</b> اختبار ${typeLabel}
📦 <b>عدد النماذج:</b> ${sentCount}
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
