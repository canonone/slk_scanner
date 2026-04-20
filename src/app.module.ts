import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TelegramModule } from './telegram/telegram.module'
import { WebhookModule } from './webhook/webhook.module'
import { ScannerModule } from './scanner/scanner.module'
import { MarketDataModule } from './market-data/market-data.module'
import { StateModule } from './state/state.module'
import { SMTModule } from './smt/smt.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TelegramModule,
    WebhookModule,
    ScannerModule,
    MarketDataModule,
    StateModule,
    SMTModule,
  ],
})
export class AppModule {}