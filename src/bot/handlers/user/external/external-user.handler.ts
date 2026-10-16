import { Action, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

import { ExternalResourceService } from 'src/external/services/external-resource.service';
import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';
import { GeminiMcpService } from 'src/ai/services/gemini-mcp.service';

@Update()
export class ExternalUserHandler {
  constructor(
    private readonly externalResourceService: ExternalResourceService,
    private readonly botEventService: BotEventService,
    private readonly geminiMcpService: GeminiMcpService,
  ) {}

  // ============================================================
  // Helpers
  // ============================================================

  private getCallbackData(ctx: Context): string | undefined {
    const callbackQuery = ctx.callbackQuery;

    if (!callbackQuery || !('data' in callbackQuery)) {
      return undefined;
    }

    return typeof callbackQuery.data === 'string'
      ? callbackQuery.data
      : undefined;
  }

  // ============================================================
  // واجهة قسم المصادر الرئيسية (البحث الذكي والمكتبة الرقمية)
  // ============================================================

  @Action('er')
  async handleExternalResources(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();

    const text = `
📚 <b>قسم المصادر والبحوث الأكاديمية التخصصية</b>
<i>جامعة أهل الحديث</i>

اختر باحث الذكاء الاصطناعي المباشر أو تصفح المكتبة الرقمية:

📖 <b>باحث المكتبة الشاملة:</b>
استخراج النصوص الفقهية وتخريج الأحاديث من أمهات الكتب الإسلامية بدقة بالغة وتوثيق الجزء والصفحة.

📜 <b>باحث منصة تراث للمخطوطات:</b>
البحث في نوادر المخطوطات والكتب التراثية القديمة مع توثيق أرقام اللوحات ودور الحفظ.

📁 <b>المكتبة الرقمية والمستندات العامة:</b>
تصفح وتحميل التصنيفات العامة، المذكرات، والدورات المرفوعة بالجامعة.
    `.trim();

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '📖 باحث المكتبة الشاملة (ذكاء اصطناعي)',
          'ai_chat_shamela',
        ),
      ],
      [
        Markup.button.callback(
          '📜 باحث منصة تراث للمخطوطات',
          'ai_chat_turath',
        ),
      ],
      [
        Markup.button.callback(
          '📁 تصفح المكتبة الرقمية والتصنيفات',
          'er_categories',
        ),
      ],
      [
        Markup.button.callback('🏠 العودة للقائمة الرئيسية', 'main_menu'),
      ],
    ]);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  }

  // ============================================================
  // بدء محادثة باحث المكتبة الشاملة
  // ============================================================

  @Action('ai_chat_shamela')
  async startShamelaChat(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    // تفعيل حالة محادثة الشاملة للمستخدم
    this.botEventService.set({
      userId,
      event: BotEventType.CHATTING_SHAMELA,
      messageId: ctx.callbackQuery?.message?.message_id || 0,
      chatId: String(ctx.chat?.id || ''),
    });

    const welcomeText = `
📖 <b>مرحباً بك في باحث المكتبة الشاملة الذكي</b>
<i>جامعة أهل الحديث</i>

أنت الآن في وضع البحث المباشر في نصوص المكتبة الشاملة وأمهات كتب الفقه والحديث.

✍️ <b>أرسل الآن سؤالك أو مسألتك الفقهية أو الحديث الشريف:</b>
وسيقوم الباحث بمراجعة الكتب واستخراج النصوص وتوثيقها لك بدقة مع العزو للأجزاء والصفحات.

<i>للخروج من المحادثة في أي وقت اضغط الزر أدناه:</i>
    `.trim();

    await ctx.editMessageText(welcomeText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ إنهاء المحادثة والعودة', 'ai_chat_exit')],
      ]),
    });
  }

  // ============================================================
  // بدء محادثة باحث منصة تراث
  // ============================================================

  @Action('ai_chat_turath')
  async startTurathChat(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();

    const userId = ctx.from?.id;
    if (!userId) return;

    // تفعيل حالة محادثة تراث للمستخدم
    this.botEventService.set({
      userId,
      event: BotEventType.CHATTING_TURATH,
      messageId: ctx.callbackQuery?.message?.message_id || 0,
      chatId: String(ctx.chat?.id || ''),
    });

    const welcomeText = `
📜 <b>مرحباً بك في باحث منصة تراث للمخطوطات</b>
<i>جامعة أهل الحديث</i>

أنت الآن في وضع البحث في المخطوطات والكتب التراثية القديمة والنادرة.

✍️ <b>أرسل استفسارك عن المخطوطات أو الآثار التراثية:</b>
وسيقوم الباحث بتوثيق اللوحات، تاريخ النسخ، ومظان الحفظ الأصلية.

<i>للخروج من المحادثة في أي وقت اضغط الزر أدناه:</i>
    `.trim();

    await ctx.editMessageText(welcomeText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ إنهاء المحادثة والعودة', 'ai_chat_exit')],
      ]),
    });
  }

  // ============================================================
  // إنهاء المحادثة الذكية والعودة
  // ============================================================

  @Action('ai_chat_exit')
  async exitAiChat(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (userId) {
      this.botEventService.delete(userId);
      this.geminiMcpService.clearSession(userId);
    }

    await this.handleExternalResources(ctx);
  }

  // ============================================================
  // تصفح تصنيفات المكتبة الرقمية
  // ============================================================

  @Action('er_categories')
  async handleCategoriesEntry(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    await this.sendCategory(ctx);
  }

  private async sendCategory(ctx: Context, categoryId?: number): Promise<void> {
    const categories = categoryId
      ? await this.externalResourceService.getChildCategories(categoryId)
      : await this.externalResourceService.getRootCategories();

    if (categories.length === 0) {
      const backCallback = categoryId ? 'er_categories' : 'er';
      try {
        await ctx.editMessageText('⚠️ <b>لا توجد مصادر أو تصنيفات مضافة حاليًا.</b>', {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 العودة للمصادر', backCallback)],
          ]),
        });
      } catch (e) {
        // ignore
      }
      return;
    }

    let text = '📁 <b>المكتبة الرقمية والتصنيفات</b>\n\n';

    if (categoryId) {
      const category =
        await this.externalResourceService.getCategory(categoryId);
      text += `📁 <b>${category.name}</b>\n\nاختر تصنيفًا فرعيًا:`;
    } else {
      text += 'اختر التصنيف المطلوب لتصفح محتوياته:';
    }

    const buttons = categories.map((category) => [
      Markup.button.callback(
        `📁 ${category.name}`,
        `external_user_category/${category.id}`,
      ),
    ]);

    if (categoryId) {
      const category =
        await this.externalResourceService.getCategory(categoryId);

      if (category.parentId !== null) {
        buttons.push([
          Markup.button.callback(
            '🔙 رجوع',
            `external_user_category/${category.parentId}`,
          ),
        ]);
      } else {
        buttons.push([Markup.button.callback('🔙 رجوع', 'er_categories')]);
      }
    } else {
      buttons.push([Markup.button.callback('🔙 العودة لقسم المصادر', 'er')]);
    }

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    });
  }

  // ============================================================
  // اختيار تصنيف
  // ============================================================

  @Action(/^external_user_category\/(\d+)$/)
  async handleCategory(@Ctx() ctx: Context) {
    const data = this.getCallbackData(ctx);
    if (!data) return;

    const categoryId = Number(data.split('/')[1]);
    if (!Number.isInteger(categoryId)) {
      await ctx.answerCbQuery('❌ التصنيف غير صالح.', { show_alert: true });
      return;
    }

    const category = await this.externalResourceService.getCategory(categoryId);
    const childCategories =
      await this.externalResourceService.getChildCategories(categoryId);
    const resources =
      await this.externalResourceService.getResources(categoryId);

    if (childCategories.length > 0) {
      const buttons = childCategories.map((child) => [
        Markup.button.callback(
          `📁 ${child.name}`,
          `external_user_category/${child.id}`,
        ),
      ]);

      if (category.parentId !== null) {
        buttons.push([
          Markup.button.callback(
            '🔙 رجوع',
            `external_user_category/${category.parentId}`,
          ),
        ]);
      } else {
        buttons.push([Markup.button.callback('🔙 رجوع', 'er_categories')]);
      }

      await ctx.editMessageText(
        `📁 <b>${category.name}</b>\n\nاختر التصنيف الفرعي:`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(buttons),
        },
      );

      await ctx.answerCbQuery();
      return;
    }

    if (resources.length === 0) {
      const backButton =
        category.parentId !== null
          ? Markup.button.callback(
              '🔙 رجوع',
              `external_user_category/${category.parentId}`,
            )
          : Markup.button.callback('🔙 رجوع', 'er_categories');

      await ctx.editMessageText(
        `📁 <b>${category.name}</b>\n\n⚠️ لا توجد مصادر أو مستندات في هذا التصنيف حاليًا.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[backButton]]),
        },
      );

      await ctx.answerCbQuery();
      return;
    }

    // إرسال جميع المصادر
    await ctx.answerCbQuery(`📚 جاري إرسال ${resources.length} ملف...`);

    for (const resource of resources) {
      let sent = false;
      try {
        await ctx.telegram.copyMessage(
          ctx.chat!.id,
          resource.telegramChatId,
          resource.telegramMessageId,
        );
        sent = true;
      } catch (error) {
        console.error(
          `[ExternalUserHandler] Failed to copyMessage for resource id=${resource.id}`,
          error,
        );
      }

      if (!sent && resource.telegramFileId) {
        try {
          await ctx.replyWithDocument(resource.telegramFileId, {
            caption: resource.caption
              ? `📄 <b>${resource.title}</b>\n\n${resource.caption}`
              : `📄 <b>${resource.title}</b>`,
            parse_mode: 'HTML',
          });
          sent = true;
        } catch (docErr) {
          console.error(
            `[ExternalUserHandler] Failed to send document by fileId id=${resource.id}`,
            docErr,
          );
        }
      }
    }

    const backButton =
      category.parentId !== null
        ? Markup.button.callback(
            '🔙 رجوع',
            `external_user_category/${category.parentId}`,
          )
        : Markup.button.callback('🔙 رجوع', 'er_categories');

    await ctx.reply(
      `📁 <b>${category.name}</b>\n\n📚 تم إرسال <b>${resources.length}</b> مصدر بنجاح.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[backButton]]),
      },
    );
  }
}
