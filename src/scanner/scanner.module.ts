import { Module } from '@nestjs/common'
import { ScannerService } from './scanner.service'
import { ScannerCron } from './scanner.cron'
import { MarketDataModule } from '../market-data/market-data.module'
import { TelegramModule } from '../telegram/telegram.module'
import { StateModule } from '../state/state.module'

@Module({
  imports: [MarketDataModule, TelegramModule, StateModule],
  providers: [ScannerService, ScannerCron],
  exports: [ScannerService],
})
export class ScannerModule {}