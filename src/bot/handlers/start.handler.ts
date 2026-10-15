import { OnModuleInit } from '@nestjs/common';
import { Action, Command, Ctx, InjectBot, Start, Update } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';

import { UsersService } from 'src/user/services/user.service';
import { mainMenuKeyboard } from '../keyboards/main-menu.keyboard';
import { BotEventService } from '../services/bot-event.service';

@Update()
export class StartHandler implements OnModuleInit {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly usersService: UsersService,
    private readonly botEventService: BotEventService,
  ) {}

  async onModuleInit() {
    try {
      await this.bot.telegram.setMyCommands([
        {
          command: 'start',
          description: '🏠 القائمة الرئيسية / تشغيل البوت',
        },
        {
          command: 'about',
          description: 'ℹ️ عن البوت وجامعة أهل الحديث',
        },
      ]);
    } catch (error) {
      console.warn('Failed to set bot commands:', error);
    }
  }

  @Start()
  @Command('start')
  async onStart(@Ctx() ctx: Context) {
    if (!ctx.from) {
      return;
    }

    const telegramId = ctx.from.id.toString();

    // حفظ أو تحديث بيانات المستخدم
    await this.usersService.createOrUpdate({
      telegramId,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username,
    });

    const envSuperAdmins = (process.env.SUPER_ADMIN_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const isSuper =
      envSuperAdmins.includes(telegramId) ||
      [837535368, 8521015752].includes(Number(telegramId));

    if (isSuper) {
      await this.usersService.updateRole(telegramId, true);
    }

    const isAdmin = isSuper || (await this.usersService.isAdmin(telegramId));

    const welcomeMessage = `
<b>أهلاً وسهلاً بك ${ctx.from.first_name} 👋</b>

🎓 <b>مرحبًا بك في بوت جامعة أهل الحديث الأكاديمي</b>

منصتك الأكاديمية الموحدة للوصول السريع إلى:
📚 الملازم والمقررات الدراسية
📝 بنك الاختبارات (الشهرية والفصلية)
📖 المصادر والمراجع التعليمية

👇 <i>اختر القسم المطلوب من القائمة أدناه:</i>
    `.trim();

    await ctx.reply(welcomeMessage, {
      parse_mode: 'HTML',
      ...mainMenuKeyboard(Boolean(isAdmin), Number(telegramId)),
    });
  }

  @Action('main_menu')
  async onMainMenu(@Ctx() ctx: Context) {
    if (!ctx.from) {
      return;
    }

    await ctx.answerCbQuery();

    const telegramId = ctx.from.id.toString();

    // إلغاء أي عملية/حدث جاري للمستخدم
    this.botEventService.delete(ctx.from.id);

    const envSuperAdmins = (process.env.SUPER_ADMIN_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const isSuper =
      envSuperAdmins.includes(telegramId) ||
      [837535368, 8521015752].includes(Number(telegramId));

    if (isSuper) {
      await this.usersService.updateRole(telegramId, true);
    }

    const isAdmin = isSuper || (await this.usersService.isAdmin(telegramId));

    const messageText = `
🏠 <b>القائمة الرئيسية</b>

مرحبًا بك مجددًا! 👋

اختر من القائمة أدناه للوصول إلى القسم المطلوب:
  `.trim();

    await ctx.editMessageText(messageText, {
      parse_mode: 'HTML',
      ...mainMenuKeyboard(Boolean(isAdmin), Number(telegramId)),
    });
  }
}
