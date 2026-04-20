import { Module } from '@nestjs/common'
import { WebhookController } from './webhook.controller'
import { WebhookService } from './webhook.service'
import { TelegramModule } from '../telegram/telegram.module'

@Module({
  imports: [TelegramModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}