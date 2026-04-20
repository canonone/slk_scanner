import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { WebhookService } from './webhook.service'
import { SMTService } from '../smt/smt.service'
import type { TradingViewPayload } from './webhook.service'

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly smtService: SMTService,
  ) {}

  @Post('tradingview')
  @HttpCode(HttpStatus.OK)
  async handleAlert(@Body() payload: TradingViewPayload) {
    return this.webhookService.handleAlert(payload)
  }

  // Manual trigger for testing SMT scan
  @Get('test-smt')
  @HttpCode(HttpStatus.OK)
  async testSMT() {
    await this.smtService.runSMTScan()
    return { ok: true, message: 'SMT scan triggered — check Telegram and Railway logs' }
  }
}