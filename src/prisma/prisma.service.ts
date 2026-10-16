import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  partner: any;

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully');
        return;
      } catch (error) {
        retries -= 1;
        this.logger.warn(
          `Database connection attempt failed (${(error as Error).message}). Retries remaining: ${retries}`,
        );
        if (retries === 0) {
          this.logger.error('Could not connect to database after 5 attempts.');
          throw error;
        }
        // انتظار ثانيتين قبل إعادة المحاولة لمنح قاعدة البيانات وقتاً للاستيقاظ
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
