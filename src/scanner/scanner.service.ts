import { Injectable, Logger } from '@nestjs/common'
import { MarketDataService } from '../market-data/market-data.service'
import { TelegramService } from '../telegram/telegram.service'
import { StateService, SetupState, PairState } from '../state/state.service'
import { detectDailySweep } from '../criteria/sweep.criteria'
import { detect4HBOS } from '../criteria/bos.criteria'
import { WATCHLIST } from '../watchlist/watchlist'

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name)

  constructor(
    private marketData: MarketDataService,
    private telegram: TelegramService,
    private state: StateService,
  ) {}

  async runDailySweepCheck(): Promise<void> {
    this.logger.log(`Scanning ${WATCHLIST.length} pairs for daily sweep...`)

    for (const pair of WATCHLIST) {
      try {
        const candles = await this.marketData.getCandles(pair, '1day', 3)
        if (candles.length < 2) {
          this.logger.warn(`Not enough candles for ${pair}`)
          continue
        }

        const sweep = detectDailySweep(candles)

        if (sweep.detected) {
          this.logger.log(
            `✅ Sweep detected: ${pair} ${sweep.direction} | Invalidation: ${sweep.invalidationLevel}`,
          )
          this.state.set(pair, {
            state: SetupState.SWEEP_CONFIRMED,
            direction: sweep.direction,
            sweptCandleHigh: sweep.sweptCandleHigh,
            sweptCandleLow: sweep.sweptCandleLow,
            sweptCandleDate: sweep.sweptCandleDate,
            sweepingCandleDate: sweep.sweepingCandleDate,
            sweepingCandleClose: sweep.sweepingCandleClose,
            invalidationLevel: sweep.invalidationLevel,
            sweepConfirmedAt: new Date(),
            bosLevel: null,
            bosConfirmedAt: null,
            alertSent: false,
          })
        } else {
          const current = this.state.get(pair)
          if (current.state === SetupState.IDLE) {
            this.state.reset(pair)
          }
        }

        // Avoid hitting rate limits
        await this.sleep(400)
      } catch (error) {
        this.logger.error(`Error scanning ${pair}`, error)
      }
    }

    this.logger.log('Daily sweep check complete')
  }

  async run4HBOSCheck(): Promise<void> {
    const activePairs = WATCHLIST.filter((pair) => {
      const s = this.state.get(pair)
      return s.state === SetupState.SWEEP_CONFIRMED && !s.alertSent
    })

    if (activePairs.length === 0) {
      this.logger.log('No active setups to check for BOS')
      return
    }

    this.logger.log(`Checking 4H BOS for ${activePairs.length} active pairs...`)

    for (const pair of activePairs) {
      try {
        const pairState = this.state.get(pair)
        const candles = await this.marketData.getCandles(pair, '4h', 50)

        if (candles.length < 10) {
          this.logger.warn(`Not enough 4H candles for ${pair}`)
          continue
        }

        const bos = detect4HBOS(
          candles,
          pairState.direction!,
          pairState.invalidationLevel,
          pairState.sweepConfirmedAt!,
        )

        if (bos.invalidated) {
          this.logger.log(`❌ ${pair} INVALIDATED — price hit invalidation level`)
          this.state.set(pair, { state: SetupState.INVALIDATED })
          continue
        }

        if (bos.detected) {
          this.logger.log(`🎯 ${pair} BOS CONFIRMED — sending alert`)

          this.state.set(pair, {
            state: SetupState.BOS_CONFIRMED,
            bosLevel: bos.bosLevel,
            bosConfirmedAt: new Date(bos.bosCandleTime),
            alertSent: true,
          })

          const message = this.buildAlertMessage(pair, pairState, bos.bosLevel, bos.bosCandleTime)
          await this.telegram.sendMessage(message)
        }

        await this.sleep(400)
      } catch (error) {
        this.logger.error(`Error in 4H BOS check for ${pair}`, error)
      }
    }
  }

  async resetCompletedSetups(): Promise<void> {
    let resetCount = 0
    for (const pair of WATCHLIST) {
      const s = this.state.get(pair)
      if (
        s.state === SetupState.BOS_CONFIRMED ||
        s.state === SetupState.INVALIDATED
      ) {
        this.state.reset(pair)
        resetCount++
      }
    }
    this.logger.log(`Reset ${resetCount} completed setups`)
  }

  private buildAlertMessage(
    pair: string,
    pairState: PairState,
    bosLevel: number,
    bosTime: string,
  ): string {
    const isBullish = pairState.direction === 'bullish'
    const emoji = isBullish ? '🟢' : '🔴'
    const biasLabel = isBullish ? 'BULLISH' : 'BEARISH'
    const sweepDesc = isBullish
      ? 'Closed BELOW previous day Low'
      : 'Closed ABOVE previous day High'
    const invalidationDesc = isBullish
      ? 'Previous Day High'
      : 'Previous Day Low'

    // Convert to WAT (UTC+1)
    const bosDate = new Date(bosTime)
    const watOffset = 60 * 60 * 1000
    const watDate = new Date(bosDate.getTime() + watOffset)
    const formattedTime = watDate.toISOString().replace('T', ' ').slice(0, 16) + ' WAT'

    return (
      `${emoji} <b>SETUP CONFIRMED — ${pair}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 <b>Daily Sweep</b>\n` +
      `   Swept Candle: ${pairState.sweptCandleDate}\n` +
      `   High: ${pairState.sweptCandleHigh} | Low: ${pairState.sweptCandleLow}\n` +
      `   Sweeping Candle: ${pairState.sweepingCandleDate}\n` +
      `   ${sweepDesc}\n\n` +
      `🛡 <b>Invalidation (${invalidationDesc})</b>\n` +
      `   Level: ${pairState.invalidationLevel}\n` +
      `   Status: ✅ Not breached\n\n` +
      `📊 <b>4H BOS Confirmed</b>\n` +
      `   BOS Level: ${bosLevel}\n` +
      `   Confirmed At: ${formattedTime}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ Bias: <b>${biasLabel}</b>\n` +
      `💡 Watch for a 4H entry model`
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}