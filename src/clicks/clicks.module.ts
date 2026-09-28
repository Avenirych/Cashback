import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Click } from './click.entity';
import { ClicksService } from './clicks.service';
import { ClicksController } from './clicks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Click])],
  providers: [ClicksService],
  controllers: [ClicksController],
  exports: [ClicksService],
})
export class ClicksModule {}
