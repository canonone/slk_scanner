import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name)
  private readonly botToken: string
  private readonly chatId: string
  private readonly baseUrl: string

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.getOrThrow('TELEGRAM_BOT_TOKEN')
    this.chatId = this.configService.getOrThrow('TELEGRAM_CHAT_ID')
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`
  }

  async sendMessage(message: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML',
      })
      this.logger.log('Telegram message sent')
    } catch (error) {
      this.logger.error('Failed to send Telegram message', error)
      throw error
    }
  }
}