import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ScannerService } from './scanner.service'
import { SMTService } from '../smt/smt.service'

@Injectable()
export class ScannerCron {
  private readonly logger = new Logger(ScannerCron.name)

  constructor(
    private scannerService: ScannerService,
    private smtService: SMTService,
  ) {}

  // 23:00 WAT = 22:00 UTC — daily sweep check
  @Cron('0 22 * * *', { timeZone: 'UTC' })
  async dailySweepCheck() {
    this.logger.log('[CRON] Daily sweep check triggered')
    await this.scannerService.runDailySweepCheck()
  }

  // Every 4H — BOS check
  @Cron('0 0,4,8,12,16,20 * * *', { timeZone: 'UTC' })
  async fourHourBOSCheck() {
    this.logger.log('[CRON] 4H BOS check triggered')
    await this.scannerService.run4HBOSCheck()
  }

  // Every 1H — SMT divergence scan
  // Runs at the top of every hour
  @Cron('0 * * * *', { timeZone: 'UTC' })
  async smtDivergenceScan() {
    this.logger.log('[CRON] 1H SMT divergence scan triggered')
    await this.smtService.runSMTScan()
  }

  // Reset completed setups at 22:05 UTC
  @Cron('5 22 * * *', { timeZone: 'UTC' })
  async dailyReset() {
    this.logger.log('[CRON] Daily state reset triggered')
    await this.scannerService.resetCompletedSetups()
  }
}