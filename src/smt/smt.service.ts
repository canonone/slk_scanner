import { Injectable, Logger } from '@nestjs/common'
import { MarketDataService, OHLCVCandle } from '../market-data/market-data.service'
import { TelegramService } from '../telegram/telegram.service'
import { SMT_PAIRS, SMTPairConfig } from './smt.config'

interface PivotHigh {
  index: number
  price: number
  datetime: string
}

interface PivotLow {
  index: number
  price: number
  datetime: string
}

interface SMTResult {
  detected: boolean
  direction: 'bullish' | 'bearish' | null
  symbol1Price: number
  symbol2Price: number
  datetime: string
}

@Injectable()
export class SMTService {
  private readonly logger = new Logger(SMTService.name)

  // Track last alert time per pair to avoid duplicate alerts
  private lastAlertTime = new Map<string, string>()

  constructor(
    private marketData: MarketDataService,
    private telegram: TelegramService,
  ) {}

  async runSMTScan(): Promise<void> {
    this.logger.log(`Running SMT divergence scan for ${SMT_PAIRS.length} pair(s)...`)

    for (const config of SMT_PAIRS) {
      try {
        await this.scanPair(config)
        await this.sleep(500)
      } catch (error) {
        this.logger.error(
          `Error scanning SMT for ${config.symbol1}/${config.symbol2}`,
          error,
        )
      }
    }
  }

 private async scanPair(config: SMTPairConfig): Promise<void> {
  const { symbol1, symbol2, timeframe, fractalPeriod } = config
  const pairKey = `${symbol1}-${symbol2}`

  // Increased to 200 to give fractal period 5 enough data
  const [candles1, candles2] = await Promise.all([
    this.marketData.getCandles(symbol1, timeframe as any, 200),
    this.marketData.getCandles(symbol2, timeframe as any, 200),
  ])

  if (candles1.length < fractalPeriod * 2 + 1 || candles2.length < fractalPeriod * 2 + 1) {
    this.logger.warn(`Not enough candles for ${pairKey}`)
    return
  }

  // Reverse to chronological order (oldest first)
  const ordered1 = [...candles1].reverse()
  const ordered2 = [...candles2].reverse()

  // Align candles by datetime
  const aligned = this.alignCandles(ordered1, ordered2)
  if (aligned.length < fractalPeriod * 2 + 1) {
    this.logger.warn(`Not enough aligned candles for ${pairKey}`)
    return
  }

  const result = this.detectSMT(aligned, fractalPeriod)

  if (!result.detected) {
    this.logger.log(`No SMT divergence detected for ${pairKey}`)
    return
  }

  // Avoid sending duplicate alerts for the same signal
  const lastAlert = this.lastAlertTime.get(pairKey)
  if (lastAlert === result.datetime) {
    this.logger.log(`${pairKey} SMT already alerted for ${result.datetime}`)
    return
  }

  this.lastAlertTime.set(pairKey, result.datetime)
  this.logger.log(
    `🎯 SMT ${result.direction} divergence detected: ${pairKey} at ${result.datetime}`,
  )

  const message = this.buildMessage(config, result)
  await this.telegram.sendMessage(message)
}

  private alignCandles(
    candles1: OHLCVCandle[],
    candles2: OHLCVCandle[],
  ): Array<{ datetime: string; c1: OHLCVCandle; c2: OHLCVCandle }> {
    // Build a map of datetime → candle for symbol2
    const map2 = new Map<string, OHLCVCandle>()
    for (const c of candles2) {
      // Normalize datetime key — use just the date+hour part for 1H
      const key = c.datetime.slice(0, 13)
      map2.set(key, c)
    }

    const aligned: Array<{ datetime: string; c1: OHLCVCandle; c2: OHLCVCandle }> = []

    for (const c1 of candles1) {
      const key = c1.datetime.slice(0, 13)
      const c2 = map2.get(key)
      if (c2) {
        aligned.push({ datetime: c1.datetime, c1, c2 })
      }
    }

    return aligned
  }

  private detectSMT(
    aligned: Array<{ datetime: string; c1: OHLCVCandle; c2: OHLCVCandle }>,
    period: number,
  ): SMTResult {
    const empty: SMTResult = {
      detected: false,
      direction: null,
      symbol1Price: 0,
      symbol2Price: 0,
      datetime: '',
    }

    const len = aligned.length

    // We check the most recently completed fractal
    // The last confirmed pivot is at index len - period - 1
    // (needs `period` candles on both sides to confirm)
    const checkIdx = len - period - 1
    if (checkIdx < period) return empty

    // ── BEARISH SMT — check pivot highs ──────────────────────────
    // Is checkIdx a pivot high for symbol1?
    const isPivotHigh1 = this.isPivotHigh(aligned, checkIdx, period, 'c1')
    const isPivotHigh2 = this.isPivotHigh(aligned, checkIdx, period, 'c2')

    if (isPivotHigh1 || isPivotHigh2) {
      // Find the previous pivot high
      const prevHighIdx = this.findPrevPivotHigh(aligned, checkIdx - 1, period)

      if (prevHighIdx !== -1) {
        const currHigh1 = aligned[checkIdx].c1.high
        const currHigh2 = aligned[checkIdx].c2.high
        const prevHigh1 = aligned[prevHighIdx].c1.high
        const prevHigh2 = aligned[prevHighIdx].c2.high

        // Classic bearish: symbol1 higher high, symbol2 lower high
        const classic = currHigh1 > prevHigh1 && currHigh2 < prevHigh2
        // Reverse bearish: symbol2 higher high, symbol1 lower high
        const reverse = currHigh2 > prevHigh2 && currHigh1 < prevHigh1

        if (classic || reverse) {
          return {
            detected: true,
            direction: 'bearish',
            symbol1Price: currHigh1,
            symbol2Price: currHigh2,
            datetime: aligned[checkIdx].datetime,
          }
        }
      }
    }

    // ── BULLISH SMT — check pivot lows ───────────────────────────
    const isPivotLow1 = this.isPivotLow(aligned, checkIdx, period, 'c1')
    const isPivotLow2 = this.isPivotLow(aligned, checkIdx, period, 'c2')

    if (isPivotLow1 || isPivotLow2) {
      const prevLowIdx = this.findPrevPivotLow(aligned, checkIdx - 1, period)

      if (prevLowIdx !== -1) {
        const currLow1 = aligned[checkIdx].c1.low
        const currLow2 = aligned[checkIdx].c2.low
        const prevLow1 = aligned[prevLowIdx].c1.low
        const prevLow2 = aligned[prevLowIdx].c2.low

        // Classic bullish: symbol1 lower low, symbol2 higher low
        const classic = currLow1 < prevLow1 && currLow2 > prevLow2
        // Reverse bullish: symbol2 lower low, symbol1 higher low
        const reverse = currLow2 < prevLow2 && currLow1 > prevLow1

        if (classic || reverse) {
          return {
            detected: true,
            direction: 'bullish',
            symbol1Price: currLow1,
            symbol2Price: currLow2,
            datetime: aligned[checkIdx].datetime,
          }
        }
      }
    }

    return empty
  }

  // ── Fractal helpers ─────────────────────────────────────────────

  private isPivotHigh(
    aligned: Array<{ c1: OHLCVCandle; c2: OHLCVCandle }>,
    idx: number,
    period: number,
    key: 'c1' | 'c2',
  ): boolean {
    const current = aligned[idx][key].high
    for (let i = idx - period; i <= idx + period; i++) {
      if (i === idx) continue
      if (i < 0 || i >= aligned.length) return false
      if (aligned[i][key].high >= current) return false
    }
    return true
  }

  private isPivotLow(
    aligned: Array<{ c1: OHLCVCandle; c2: OHLCVCandle }>,
    idx: number,
    period: number,
    key: 'c1' | 'c2',
  ): boolean {
    const current = aligned[idx][key].low
    for (let i = idx - period; i <= idx + period; i++) {
      if (i === idx) continue
      if (i < 0 || i >= aligned.length) return false
      if (aligned[i][key].low <= current) return false
    }
    return true
  }

  private findPrevPivotHigh(
    aligned: Array<{ c1: OHLCVCandle; c2: OHLCVCandle }>,
    startIdx: number,
    period: number,
  ): number {
    for (let i = startIdx; i >= period; i--) {
      if (
        this.isPivotHigh(aligned, i, period, 'c1') ||
        this.isPivotHigh(aligned, i, period, 'c2')
      ) {
        return i
      }
    }
    return -1
  }

  private findPrevPivotLow(
    aligned: Array<{ c1: OHLCVCandle; c2: OHLCVCandle }>,
    startIdx: number,
    period: number,
  ): number {
    for (let i = startIdx; i >= period; i--) {
      if (
        this.isPivotLow(aligned, i, period, 'c1') ||
        this.isPivotLow(aligned, i, period, 'c2')
      ) {
        return i
      }
    }
    return -1
  }

  private buildMessage(config: SMTPairConfig, result: SMTResult): string {
    const isBullish = result.direction === 'bullish'
    const emoji = isBullish ? '🟢' : '🔴'
    const label = isBullish ? '+SMT BULLISH' : '-SMT BEARISH'
    const priceLabel = isBullish ? 'Pivot Low' : 'Pivot High'

    // Convert to WAT (UTC+1)
    const date = new Date(result.datetime)
    const wat = new Date(date.getTime() + 60 * 60 * 1000)
    const formattedTime = wat.toISOString().replace('T', ' ').slice(0, 16) + ' WAT'

    return (
      `${emoji} <b>${label} DIVERGENCE</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 <b>Pair 1:</b> ${config.symbol1} — ${priceLabel}: ${result.symbol1Price}\n` +
      `📊 <b>Pair 2:</b> ${config.symbol2} — ${priceLabel}: ${result.symbol2Price}\n` +
      `⏱ <b>Timeframe:</b> ${config.timeframe.toUpperCase()}\n` +
      `🕐 <b>Time:</b> ${formattedTime}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 ${config.symbol1} and ${config.symbol2} disagree at the ${isBullish ? 'lows' : 'highs'}`
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}