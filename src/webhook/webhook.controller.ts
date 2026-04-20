import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { WebhookService } from './webhook.service'
import type { TradingViewPayload } from './webhook.service'

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('tradingview')
  @HttpCode(HttpStatus.OK)
  async handleAlert(@Body() payload: TradingViewPayload) {
    return this.webhookService.handleAlert(payload)
  }
}