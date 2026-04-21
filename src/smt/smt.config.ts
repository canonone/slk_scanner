export interface SMTPairConfig {
  symbol1: string
  symbol2: string
  timeframe: '1h' | '4h' | '1day'
  fractalPeriod: number
}

export const SMT_PAIRS: SMTPairConfig[] = [
  {
    symbol1: 'GBPUSD',
    symbol2: 'EURUSD',
    timeframe: '1h',
    fractalPeriod: 5,
  },
  // Add more pairs here later if needed
  // { symbol1: 'AUDUSD', symbol2: 'NZDUSD', timeframe: '1h', fractalPeriod: 2 },
]