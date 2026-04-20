import { Injectable } from '@nestjs/common'

export enum SetupState {
  IDLE = 'IDLE',
  SWEEP_CONFIRMED = 'SWEEP_CONFIRMED',
  BOS_CONFIRMED = 'BOS_CONFIRMED',
  INVALIDATED = 'INVALIDATED',
}

export interface PairState {
  pair: string
  state: SetupState
  direction: 'bullish' | 'bearish' | null
  sweptCandleHigh: number
  sweptCandleLow: number
  sweptCandleDate: string
  sweepingCandleDate: string
  sweepingCandleClose: number
  invalidationLevel: number
  sweepConfirmedAt: Date | null
  bosLevel: number | null
  bosConfirmedAt: Date | null
  alertSent: boolean
}

@Injectable()
export class StateService {
  private store = new Map<string, PairState>()

  get(pair: string): PairState {
    if (!this.store.has(pair)) {
      this.store.set(pair, this.defaultState(pair))
    }
    return this.store.get(pair)!
  }

  set(pair: string, update: Partial<PairState>): void {
    const current = this.get(pair)
    this.store.set(pair, { ...current, ...update })
  }

  reset(pair: string): void {
    this.store.set(pair, this.defaultState(pair))
  }

  all(): PairState[] {
    return Array.from(this.store.values())
  }

  private defaultState(pair: string): PairState {
    return {
      pair,
      state: SetupState.IDLE,
      direction: null,
      sweptCandleHigh: 0,
      sweptCandleLow: 0,
      sweptCandleDate: '',
      sweepingCandleDate: '',
      sweepingCandleClose: 0,
      invalidationLevel: 0,
      sweepConfirmedAt: null,
      bosLevel: null,
      bosConfirmedAt: null,
      alertSent: false,
    }
  }
}