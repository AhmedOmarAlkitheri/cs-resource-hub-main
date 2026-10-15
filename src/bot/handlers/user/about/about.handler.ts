import { Action, Command, Ctx, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

@Update()
export class AboutHandler {
  @Command('about')
  async onAboutCommand(@Ctx() ctx: Context) {
    await ctx.reply(this.getMessage(), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 العودة للقائمة الرئيسية', 'main_menu')],
      ]),
    });
  }

  @Action('ab')
  async handleAboutBot(@Ctx() ctx: Context) {
    await ctx.editMessageText(this.getMessage(), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 العودة للقائمة الرئيسية', 'main_menu')],
      ]),
    });

    await ctx.answerCbQuery();
  }

  private getMessage(): string {
    return `
🎓 <b>عن بوت جامعة أهل الحديث</b>

📚 <b>بوت جامعة أهل الحديث الأكاديمي</b>

منصة أكاديمية شاملة تهدف إلى جمع وتنظيم الملازم والمحاضرات وبنك الاختبارات والمصادر الدراسية لجميع الكليات والتخصصات في مكان واحد، لتسهيل وصول الطلاب إليها والاستفادة منها.

🏛️ <b>الكليات والتخصصات المتاحة:</b>
1️⃣ <b>كلية العلوم التطبيقية والإنسانية:</b>
   • تخصص الدراسات الإسلامية
   • تخصص إدارة الأعمال

2️⃣ <b>كلية الشريعة والقانون:</b>
   • تخصص الفقه وأصوله
   • تخصص القانون

📖 <b>ماذا يقدم البوت؟</b>
• 📚 ملازم ومحاضرات المقررات الدراسية (نظري وعملي).
• 📝 بنك الاختبارات (الشهرية والفصلية).
• 🗂️ تنظيم المحتوى بدقة حسب الكلية، التخصص، المستوى، والفصل.
• 🔄 تحديث المحتوى والمصادر باستمرار.

📢 <b>معرف البوت الرسمي:</b>
@Ahl_AlHadith_University_bot
`;
  }
}
