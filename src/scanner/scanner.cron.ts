import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ScannerService } from './scanner.service'

@Injectable()
export class ScannerCron {
  private readonly logger = new Logger(ScannerCron.name)

  constructor(private scannerService: ScannerService) {}

  // 23:00 WAT = 22:00 UTC — New York daily close
  @Cron('0 22 * * *', { timeZone: 'UTC' })
  async dailySweepCheck() {
    this.logger.log('[CRON] Daily sweep check triggered')
    await this.scannerService.runDailySweepCheck()
  }

  // Every 4H at 01:00, 05:00, 09:00, 13:00, 17:00, 21:00 WAT
  // = 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
  @Cron('0 0,4,8,12,16,20 * * *', { timeZone: 'UTC' })
  async fourHourBOSCheck() {
    this.logger.log('[CRON] 4H BOS check triggered')
    await this.scannerService.run4HBOSCheck()
  }

  // Reset completed/invalidated setups at 23:05 WAT = 22:05 UTC
  @Cron('5 22 * * *', { timeZone: 'UTC' })
  async dailyReset() {
    this.logger.log('[CRON] Daily state reset triggered')
    await this.scannerService.resetCompletedSetups()
  }
}