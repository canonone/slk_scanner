import { Module } from '@nestjs/common'
import { SMTService } from './smt.service'
import { MarketDataModule } from '../market-data/market-data.module'
import { TelegramModule } from '../telegram/telegram.module'

@Module({
  imports: [MarketDataModule, TelegramModule],
  providers: [SMTService],
  exports: [SMTService],
})
export class SMTModule {}