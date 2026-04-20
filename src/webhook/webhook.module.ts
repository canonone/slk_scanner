import { Module } from '@nestjs/common'
import { WebhookController } from './webhook.controller'
import { WebhookService } from './webhook.service'
import { TelegramModule } from '../telegram/telegram.module'
import { SMTModule } from '../smt/smt.module'

@Module({
  imports: [TelegramModule, SMTModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}