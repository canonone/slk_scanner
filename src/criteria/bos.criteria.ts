import { OHLCVCandle } from '../market-data/market-data.service'

export interface BOSResult {
  detected: boolean
  invalidated: boolean
  bosLevel: number
  bosCandleTime: string
}

const FRACTAL_PERIOD = 2

function getPivotHighIndexes(candles: OHLCVCandle[], period: number): number[] {
  const pivots: number[] = []
  for (let i = period; i < candles.length - period; i++) {
    const current = candles[i].high
    let isPivot = true
    for (let j = i - period; j <= i + period; j++) {
      if (j !== i && candles[j].high >= current) {
        isPivot = false
        break
      }
    }
    if (isPivot) pivots.push(i)
  }
  return pivots
}

function getPivotLowIndexes(candles: OHLCVCandle[], period: number): number[] {
  const pivots: number[] = []
  for (let i = period; i < candles.length - period; i++) {
    const current = candles[i].low
    let isPivot = true
    for (let j = i - period; j <= i + period; j++) {
      if (j !== i && candles[j].low <= current) {
        isPivot = false
        break
      }
    }
    if (isPivot) pivots.push(i)
  }
  return pivots
}

export function detect4HBOS(
  candles: OHLCVCandle[],        // most recent first from API
  direction: 'bullish' | 'bearish',
  invalidationLevel: number,
  sweepConfirmedAt: Date,
): BOSResult {
  const empty: BOSResult = {
    detected: false,
    invalidated: false,
    bosLevel: 0,
    bosCandleTime: '',
  }

  // Only consider candles formed AFTER the daily sweep was confirmed
  const relevant = candles.filter(
    (c) => new Date(c.datetime) > sweepConfirmedAt,
  )

  if (relevant.length < FRACTAL_PERIOD * 2 + 1) return empty

  // Check invalidation — did price reach the invalidation level?
  for (const candle of relevant) {
    if (direction === 'bearish' && candle.low <= invalidationLevel) {
      return { ...empty, invalidated: true }
    }
    if (direction === 'bullish' && candle.high >= invalidationLevel) {
      return { ...empty, invalidated: true }
    }
  }

  // Reverse to chronological order (oldest first) for fractal logic
  const ordered = [...relevant].reverse()

  if (direction === 'bearish') {
    const pivotHighs = getPivotHighIndexes(ordered, FRACTAL_PERIOD)
    const pivotLows = getPivotLowIndexes(ordered, FRACTAL_PERIOD)

    if (pivotHighs.length < 2 || pivotLows.length < 1) return empty

    const lastPH = pivotHighs[pivotHighs.length - 1]
    const prevPH = pivotHighs[pivotHighs.length - 2]

    // Confirm lower high formed
    if (ordered[lastPH].high >= ordered[prevPH].high) return empty

    // Find swing low between the two pivot highs
    const swingLowIdx = pivotLows.find(
      (idx) => idx > prevPH && idx < lastPH,
    )
    if (swingLowIdx === undefined) return empty

    const bosLevel = ordered[swingLowIdx].low

    // Look for a candle that CLOSES below the BOS level after the lower high
    for (let i = lastPH + 1; i < ordered.length; i++) {
      if (ordered[i].close < bosLevel) {
        return {
          detected: true,
          invalidated: false,
          bosLevel,
          bosCandleTime: ordered[i].datetime,
        }
      }
    }
  }

  if (direction === 'bullish') {
    const pivotHighs = getPivotHighIndexes(ordered, FRACTAL_PERIOD)
    const pivotLows = getPivotLowIndexes(ordered, FRACTAL_PERIOD)

    if (pivotLows.length < 2 || pivotHighs.length < 1) return empty

    const lastPL = pivotLows[pivotLows.length - 1]
    const prevPL = pivotLows[pivotLows.length - 2]

    // Confirm higher low formed
    if (ordered[lastPL].low <= ordered[prevPL].low) return empty

    // Find swing high between the two pivot lows
    const swingHighIdx = pivotHighs.find(
      (idx) => idx > prevPL && idx < lastPL,
    )
    if (swingHighIdx === undefined) return empty

    const bosLevel = ordered[swingHighIdx].high

    // Look for a candle that CLOSES above the BOS level after the higher low
    for (let i = lastPL + 1; i < ordered.length; i++) {
      if (ordered[i].close > bosLevel) {
        return {
          detected: true,
          invalidated: false,
          bosLevel,
          bosCandleTime: ordered[i].datetime,
        }
      }
    }
  }

  return empty
}