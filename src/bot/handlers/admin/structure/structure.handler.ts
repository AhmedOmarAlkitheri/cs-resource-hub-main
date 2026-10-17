import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { AcademicService } from 'src/academic/services/academic.services';
import { UsersService } from 'src/user/services/user.service';
import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';

@Update()
export class StructureHandler {
  constructor(
    private readonly academicService: AcademicService,
    private readonly usersService: UsersService,
    private readonly botEventService: BotEventService,
  ) {}

  // ============================================================
  // القائمة الرئيسية لإدارة الهيكل الجامعي
  // ============================================================
  @Action('admin_structure')
  async showStructureMenu(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const telegramId = String(ctx.from?.id);

    const hasAccess = await this.usersService.hasPermission(
      telegramId,
      'STRUCTURE',
    );
    if (!hasAccess) {
      await ctx.answerCbQuery(
        '⛔ ليس لديك صلاحية لإدارة الهيكل الجامعي.',
        { show_alert: true },
      );
      return;
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📅 إدارة الأعوام الدراسية', 'struct_years'),
        Markup.button.callback('🏫 إدارة الكليات / الأقسام', 'struct_departments'),
      ],
      [
        Markup.button.callback('🛤️ إدارة التخصصات', 'struct_tracks'),
        Markup.button.callback('🎓 إدارة المستويات الدراسية', 'struct_levels'),
      ],
      [Markup.button.callback('🔙 العودة للقائمة الرئيسية', 'main_menu')],
    ]);

    const text =
      '🏛️ <b>إدارة الهيكل الجامعي والأكاديمي</b>\n\n' +
      'يمكنك من هنا إضافة وحذف وتعديل البنية الأكاديمية للجامعة:\n' +
      '• <b>الأعوام الدراسية:</b> إضافة سنة جديدة أو حذف سنة قائمة مع مقرراتها.\n' +
      '• <b>الكليات والأقسام:</b> إضافة أو حذف كليات وأقسام الجامعة.\n' +
      '• <b>التخصصات:</b> إدارة التخصصات المسندة لكل كلية.\n' +
      '• <b>المستويات:</b> إضافة أو حذف المستويات الدراسية.\n' +
      '<i>(ملاحظة: الفصول تظل ثابتة كفصل أول وفصل ثانٍ).</i>';

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  }

  // ============================================================
  // 1. إدارة الأعوام الدراسية
  // ============================================================
  @Action('struct_years')
  async listYears(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const years = await this.academicService.getAcademicYears();

    const buttons: any[][] = [];

    for (const y of years) {
      buttons.push([
        Markup.button.callback(
          `📅 ${y.startYear} - ${y.endYear}`,
          `struct_noop`,
        ),
        Markup.button.callback(`🗑️ حذف`, `struct_year_del/${y.id}`),
      ]);
    }

    buttons.push([
      Markup.button.callback('➕ إضافة عام دراسي جديد', 'struct_year_add'),
    ]);
    buttons.push([
      Markup.button.callback('🔙 رجوع لإدارة الهيكل', 'admin_structure'),
    ]);

    await ctx.editMessageText(
      '📅 <b>إدارة الأعوام الدراسية</b>\n\n' +
        'قائمة الأعوام المسجلة في النظام:\n' +
        (years.length === 0 ? '<i>لا توجد أعوام دراسية حالياً.</i>' : '') +
        '\n\nاضغط 🗑️ لحذف أي عام دراسي، أو ➕ لإضافة عام جديد:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      },
    );
  }

  @Action('struct_year_add')
  async promptAddYear(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    this.botEventService.set({
      userId,
      chatId: String(ctx.chat?.id),
      messageId: ctx.callbackQuery?.message?.message_id || 0,
      event: BotEventType.WAITING_STRUCTURE_YEAR_INPUT,
    });

    await ctx.reply(
      '📅 <b>إضافة عام دراسي جديد</b>\n\n' +
        'يرجى إرسال العام الدراسي بالصيغة التالية:\n' +
        'مثال: <code>2025-2026</code> أو <code>2026-2027</code>',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'struct_years')],
        ]),
      },
    );
  }

  @Action(/^struct_year_del\/(\d+)$/)
  async promptDeleteYear(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_year_del\/(\d+)$/);
    if (!match) return;
    const yearId = Number(match[1]);

    const year = await this.academicService.getAcademicYearById(yearId);
    if (!year) {
      await ctx.answerCbQuery('العام الدراسي غير موجود.', { show_alert: true });
      return;
    }

    await ctx.editMessageText(
      `⚠️ <b>تأكيد حذف العام الدراسي (${year.startYear} - ${year.endYear})</b>\n\n` +
        '🔴 <b>تحذير:</b> سيؤدي حذف هذا العام إلى حذف كافة المقررات والارتباطات المسندة إليه نهائياً!\n\n' +
        'هل أنت متأكد من رغبتك في الحذف؟',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '⚠️ نعم، احذف نهائياً',
              `struct_year_del_confirm/${yearId}`,
            ),
          ],
          [Markup.button.callback('❌ تراجع وإلغاء', 'struct_years')],
        ]),
      },
    );
  }

  @Action(/^struct_year_del_confirm\/(\d+)$/)
  async confirmDeleteYear(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_year_del_confirm\/(\d+)$/);
    if (!match) return;
    const yearId = Number(match[1]);

    await this.academicService.deleteAcademicYear(yearId);
    await ctx.answerCbQuery('✅ تم حذف العام الدراسي بنجاح!', { show_alert: true });
    await this.listYears(ctx);
  }

  // ============================================================
  // 2. إدارة الكليات والأقسام
  // ============================================================
  @Action('struct_departments')
  async listDepartments(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const depts = await this.academicService.getDepartments();

    const buttons: any[][] = [];
    for (const d of depts) {
      buttons.push([
        Markup.button.callback(`🏫 ${d.name}`, 'struct_noop'),
        Markup.button.callback(`🗑️ حذف`, `struct_dept_del/${d.id}`),
      ]);
    }

    buttons.push([
      Markup.button.callback('➕ إضافة كلية / قسم جديد', 'struct_dept_add'),
    ]);
    buttons.push([
      Markup.button.callback('🔙 رجوع لإدارة الهيكل', 'admin_structure'),
    ]);

    await ctx.editMessageText(
      '🏫 <b>إدارة الكليات والأقسام</b>\n\n' +
        'قائمة الكليات والأقسام الحالية:\n' +
        (depts.length === 0 ? '<i>لا توجد كليات مسجلة حالياً.</i>' : '') +
        '\n\nاضغط 🗑️ للحذف أو ➕ للإضافة:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      },
    );
  }

  @Action('struct_dept_add')
  async promptAddDept(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    this.botEventService.set({
      userId,
      chatId: String(ctx.chat?.id),
      messageId: ctx.callbackQuery?.message?.message_id || 0,
      event: BotEventType.WAITING_STRUCTURE_DEPARTMENT_INPUT,
    });

    await ctx.reply(
      '🏫 <b>إضافة كلية / قسم جديد</b>\n\n' +
        'أرسل اسم الكلية أو القسم (مثال: <code>كلية القرآن الكريم والدراسات الإسلامية</code>):',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'struct_departments')],
        ]),
      },
    );
  }

  @Action(/^struct_dept_del\/(\d+)$/)
  async promptDeleteDept(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_dept_del\/(\d+)$/);
    if (!match) return;
    const deptId = Number(match[1]);

    const dept = await this.academicService.getDepartmentById(deptId);
    if (!dept) {
      await ctx.answerCbQuery('الكلية غير موجودة.', { show_alert: true });
      return;
    }

    await ctx.editMessageText(
      `⚠️ <b>تأكيد حذف الكلية / القسم: ${dept.name}</b>\n\n` +
        '🔴 <b>تحذير:</b> سيؤدي الحذف إلى إزالة التخصصات والمقررات التابعة لهذه الكلية نهائياً!\n\n' +
        'هل أنت متأكد؟',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '⚠️ نعم، احذف الكلية نهائياً',
              `struct_dept_del_confirm/${deptId}`,
            ),
          ],
          [Markup.button.callback('❌ تراجع وإلغاء', 'struct_departments')],
        ]),
      },
    );
  }

  @Action(/^struct_dept_del_confirm\/(\d+)$/)
  async confirmDeleteDept(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_dept_del_confirm\/(\d+)$/);
    if (!match) return;
    const deptId = Number(match[1]);

    await this.academicService.deleteDepartment(deptId);
    await ctx.answerCbQuery('✅ تم حذف الكلية وتخصصاتها بنجاح!', { show_alert: true });
    await this.listDepartments(ctx);
  }

  // ============================================================
  // 3. إدارة التخصصات
  // ============================================================
  @Action('struct_tracks')
  async chooseDeptForTracks(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const depts = await this.academicService.getDepartments();

    const buttons = depts.map((d) => [
      Markup.button.callback(`🏫 ${d.name}`, `struct_tracks_dept/${d.id}`),
    ]);

    buttons.push([
      Markup.button.callback('🔙 رجوع لإدارة الهيكل', 'admin_structure'),
    ]);

    await ctx.editMessageText(
      '🛤️ <b>إدارة التخصصات الأكاديمية</b>\n\n' +
        'اختر الكلية لاستعراض وإدارة التخصصات التابعة لها:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      },
    );
  }

  @Action(/^struct_tracks_dept\/(\d+)$/)
  async listTracksForDept(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_tracks_dept\/(\d+)$/);
    if (!match) return;
    const deptId = Number(match[1]);

    const dept = await this.academicService.getDepartmentById(deptId);
    const tracks = await this.academicService.getTracksByDepartmentId(deptId);

    const buttons: any[][] = [];
    for (const t of tracks) {
      buttons.push([
        Markup.button.callback(`🛤️ ${t.name}`, 'struct_noop'),
        Markup.button.callback(`🗑️ حذف`, `struct_track_del/${t.id}/${deptId}`),
      ]);
    }

    buttons.push([
      Markup.button.callback(
        '➕ إضافة تخصص لهذه الكلية',
        `struct_track_add/${deptId}`,
      ),
    ]);
    buttons.push([
      Markup.button.callback('🔙 رجوع لقائمة الكليات', 'struct_tracks'),
    ]);

    await ctx.editMessageText(
      `🛤️ <b>تخصصات كلية: ${dept?.name || ''}</b>\n\n` +
        'التخصصات المسجلة حالياً:\n' +
        (tracks.length === 0 ? '<i>لا توجد تخصصات مسجلة لهذه الكلية بعد.</i>' : '') +
        '\n\nاضغط 🗑️ للحذف أو ➕ لإضافة تخصص جديد:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      },
    );
  }

  @Action(/^struct_track_add\/(\d+)$/)
  async promptAddTrack(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_track_add\/(\d+)$/);
    if (!match) return;
    const deptId = Number(match[1]);
    const userId = ctx.from?.id;
    if (!userId) return;

    this.botEventService.set({
      userId,
      chatId: String(ctx.chat?.id),
      messageId: ctx.callbackQuery?.message?.message_id || 0,
      event: BotEventType.WAITING_STRUCTURE_TRACK_INPUT,
      data: { departmentId: deptId },
    });

    await ctx.reply(
      '🛤️ <b>إضافة تخصص جديد</b>\n\n' +
        'أرسل اسم التخصص الجديد (مثال: <code>مسار الفقه وأصوله</code> أو <code>مسار الحديث وعلومه</code>):',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', `struct_tracks_dept/${deptId}`)],
        ]),
      },
    );
  }

  @Action(/^struct_track_del\/(\d+)\/(\d+)$/)
  async promptDeleteTrack(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_track_del\/(\d+)\/(\d+)$/);
    if (!match) return;
    const trackId = Number(match[1]);
    const deptId = Number(match[2]);

    const track = await this.academicService.getTrackById(trackId);
    if (!track) {
      await ctx.answerCbQuery('التخصص غير موجود.', { show_alert: true });
      return;
    }

    await ctx.editMessageText(
      `⚠️ <b>تأكيد حذف التخصص: ${track.name}</b>\n\n` +
        'سيتم حذف التخصص وكافة المقررات المسندة إليه.\nهل أنت متأكد؟',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '⚠️ نعم، احذف التخصص',
              `struct_track_del_confirm/${trackId}/${deptId}`,
            ),
          ],
          [Markup.button.callback('❌ تراجع', `struct_tracks_dept/${deptId}`)],
        ]),
      },
    );
  }

  @Action(/^struct_track_del_confirm\/(\d+)\/(\d+)$/)
  async confirmDeleteTrack(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_track_del_confirm\/(\d+)\/(\d+)$/);
    if (!match) return;
    const trackId = Number(match[1]);
    const deptId = Number(match[2]);

    await this.academicService.deleteTrack(trackId);
    await ctx.answerCbQuery('✅ تم حذف التخصص بنجاح!', { show_alert: true });

    // إعادة عرض تخصصات الكلية
    (ctx.callbackQuery as any).data = `struct_tracks_dept/${deptId}`;
    await this.listTracksForDept(ctx);
  }

  // ============================================================
  // 4. إدارة المستويات الدراسية
  // ============================================================
  @Action('struct_levels')
  async listLevels(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const levels = await this.academicService.getLevels();

    const buttons: any[][] = [];
    for (const lvl of levels) {
      buttons.push([
        Markup.button.callback(`🎓 ${lvl.name} (#${lvl.number})`, 'struct_noop'),
        Markup.button.callback(`🗑️ حذف`, `struct_level_del/${lvl.id}`),
      ]);
    }

    buttons.push([
      Markup.button.callback('➕ إضافة مستوى جديد', 'struct_level_add'),
    ]);
    buttons.push([
      Markup.button.callback('🔙 رجوع لإدارة الهيكل', 'admin_structure'),
    ]);

    await ctx.editMessageText(
      '🎓 <b>إدارة المستويات الدراسية</b>\n\n' +
        'قائمة المستويات الحالية:\n' +
        (levels.length === 0 ? '<i>لا توجد مستويات مسجلة حالياً.</i>' : '') +
        '\n\nاضغط 🗑️ للحذف أو ➕ للإضافة:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      },
    );
  }

  @Action('struct_level_add')
  async promptAddLevel(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;

    this.botEventService.set({
      userId,
      chatId: String(ctx.chat?.id),
      messageId: ctx.callbackQuery?.message?.message_id || 0,
      event: BotEventType.WAITING_STRUCTURE_LEVEL_INPUT,
    });

    await ctx.reply(
      '🎓 <b>إضافة مستوى دراسي جديد</b>\n\n' +
        'أرسل رقم المستوى واسمه مفصولين بفاصلة أو مسافة:\n' +
        'مثال: <code>5, المستوى الخامس</code> أو <code>6 المستوى السادس</code>',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ إلغاء', 'struct_levels')],
        ]),
      },
    );
  }

  @Action(/^struct_level_del\/(\d+)$/)
  async promptDeleteLevel(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_level_del\/(\d+)$/);
    if (!match) return;
    const levelId = Number(match[1]);

    const level = await this.academicService.getLevelById(levelId);
    if (!level) {
      await ctx.answerCbQuery('المستوى غير موجود.', { show_alert: true });
      return;
    }

    await ctx.editMessageText(
      `⚠️ <b>تأكيد حذف المستوى: ${level.name}</b>\n\n` +
        'سيتم حذف المستوى والمقررات المسندة إليه نهائياً.\nهل أنت متأكد؟',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '⚠️ نعم، احذف المستوى',
              `struct_level_del_confirm/${levelId}`,
            ),
          ],
          [Markup.button.callback('❌ تراجع وإلغاء', 'struct_levels')],
        ]),
      },
    );
  }

  @Action(/^struct_level_del_confirm\/(\d+)$/)
  async confirmDeleteLevel(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx.callbackQuery as any)?.data?.match(/^struct_level_del_confirm\/(\d+)$/);
    if (!match) return;
    const levelId = Number(match[1]);

    await this.academicService.deleteLevel(levelId);
    await ctx.answerCbQuery('✅ تم حذف المستوى بنجاح!', { show_alert: true });
    await this.listLevels(ctx);
  }

  @Action('struct_noop')
  async handleNoop(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
  }
}
