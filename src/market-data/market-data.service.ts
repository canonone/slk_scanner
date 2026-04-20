import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

export interface OHLCVCandle {
  datetime: string
  open: number
  high: number
  low: number
  close: number
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name)
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.twelvedata.com'

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow('TWELVE_DATA_API_KEY')
  }

  private formatSymbol(symbol: string): string {
    if (symbol === 'XAUUSD') return 'XAU/USD'
    if (symbol === 'XAGUSD') return 'XAG/USD'
    if (symbol.length === 6) {
      return `${symbol.slice(0, 3)}/${symbol.slice(3)}`
    }
    return symbol
  }

  async getCandles(
    symbol: string,
    interval: '1day' | '4h',
    count: number,
  ): Promise<OHLCVCandle[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/time_series`, {
        params: {
          symbol: this.formatSymbol(symbol),
          interval,
          outputsize: count,
          apikey: this.apiKey,
          format: 'JSON',
        },
      })

      if (response.data.status === 'error') {
        this.logger.error(
          `Twelve Data error for ${symbol}: ${response.data.message}`,
        )
        return []
      }

      return response.data.values.map((c: any) => ({
        datetime: c.datetime,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
      }))
    } catch (error) {
      this.logger.error(`Failed to fetch candles for ${symbol}`, error)
      return []
    }
  }
}