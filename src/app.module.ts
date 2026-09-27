import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
  ConfigModule.forRoot(),
  ObserveModule.forRoot({
    appKey: process.env.OBSERVE_APP_KEY!,
    appSecret: process.env.OBSERVE_APP_SECRET!,
    serviceId: 'cashback-plus-backend',
  }),
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}



