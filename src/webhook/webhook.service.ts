import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TelegramService } from '../telegram/telegram.service'

export interface TradingViewPayload {
  secret: string
  type: 'bullish' | 'bearish'
  ticker: string
  time: string
  timeframe?: string
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)

  constructor(
    private telegramService: TelegramService,
    private configService: ConfigService,
  ) {}

  async handleAlert(payload: TradingViewPayload): Promise<{ ok: boolean }> {
    const expectedSecret = this.configService.getOrThrow('WEBHOOK_SECRET')
    if (payload.secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret')
    }

    this.logger.log(`TradingView alert: ${payload.type} on ${payload.ticker}`)

    const emoji = payload.type === 'bullish' ? '🟢' : '🔴'
    const label = payload.type === 'bullish' ? '+SMT BULLISH' : '-SMT BEARISH'

    const message =
      `${emoji} <b>${label} DIVERGENCE</b>\n\n` +
      `📊 <b>Pair:</b> ${payload.ticker}\n` +
      `⏱ <b>Timeframe:</b> ${payload.timeframe ?? 'N/A'}\n` +
      `🕐 <b>Time:</b> ${payload.time}\n\n` +
      `⚡ SMT Divergence detected on TradingView`

    await this.telegramService.sendMessage(message)
    return { ok: true }
  }
}