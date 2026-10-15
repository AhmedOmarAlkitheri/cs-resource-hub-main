import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { PrismaModule } from './prisma/prisma.module';
import { BotModule } from './bot/bot.module';
import { APP_GUARD } from '@nestjs/core';
import { TelegramCallbackGuard } from './bot/guards/telegram-callback.guard';
import { ExternalModule } from './external/external.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    // 1. تحميل ملف الـ .env وجعله متاحاً في كامل التطبيق
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. ربط TelegrafModule بشكل غير متزامن لاستخراج التوكن
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get('BOT_TOKEN')!,
      }),
    }),

    PrismaModule,
    BotModule,
    ExternalModule,
    AiModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: TelegramCallbackGuard,
    },
  ],
})
export class AppModule {}
