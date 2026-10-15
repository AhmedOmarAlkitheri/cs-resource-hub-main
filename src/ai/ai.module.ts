import { Module } from '@nestjs/common';
import { GeminiMcpService } from './services/gemini-mcp.service';

@Module({
  providers: [GeminiMcpService],
  exports: [GeminiMcpService],
})
export class AiModule {}
