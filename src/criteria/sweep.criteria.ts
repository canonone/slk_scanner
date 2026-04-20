import { OHLCVCandle } from '../market-data/market-data.service'

export interface SweepResult {
  detected: boolean
  direction: 'bullish' | 'bearish' | null
  sweptCandleHigh: number
  sweptCandleLow: number
  sweptCandleDate: string
  sweepingCandleDate: string
  sweepingCandleClose: number
  invalidationLevel: number
}

export function detectDailySweep(candles: OHLCVCandle[]): SweepResult {
  const empty: SweepResult = {
    detected: false,
    direction: null,
    sweptCandleHigh: 0,
    sweptCandleLow: 0,
    sweptCandleDate: '',
    sweepingCandleDate: '',
    sweepingCandleClose: 0,
    invalidationLevel: 0,
  }

  // candles[0] = most recent closed daily (the sweeping candle e.g. Tuesday)
  // candles[1] = previous daily (the swept candle e.g. Monday)
  if (candles.length < 2) return empty

  const sweeping = candles[0]
  const swept = candles[1]

  // Skip if sweeping candle is a weekend candle
  const sweepingDay = new Date(sweeping.datetime).getUTCDay()
  if (sweepingDay === 0 || sweepingDay === 6) return empty

  // Bearish: today's candle closes ABOVE yesterday's high
  // Invalidation = yesterday's low
  const bearishSweep =
    sweeping.close > swept.high && sweeping.open < swept.high

  // Bullish: today's candle closes BELOW yesterday's low
  // Invalidation = yesterday's high
  const bullishSweep =
    sweeping.close < swept.low && sweeping.open > swept.low

  if (bearishSweep) {
    return {
      detected: true,
      direction: 'bearish',
      sweptCandleHigh: swept.high,
      sweptCandleLow: swept.low,
      sweptCandleDate: swept.datetime,
      sweepingCandleDate: sweeping.datetime,
      sweepingCandleClose: sweeping.close,
      invalidationLevel: swept.low,
    }
  }

  if (bullishSweep) {
    return {
      detected: true,
      direction: 'bullish',
      sweptCandleHigh: swept.high,
      sweptCandleLow: swept.low,
      sweptCandleDate: swept.datetime,
      sweepingCandleDate: sweeping.datetime,
      sweepingCandleClose: sweeping.close,
      invalidationLevel: swept.high,
    }
  }

  return empty
}