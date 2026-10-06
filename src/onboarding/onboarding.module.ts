import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { BonusEligibilityGuard } from './bonus-eligibility.guard';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { ProgrammeMembership } from './programme-membership.entity';
import { Recipient } from './recipient.entity';
import { RecipientEncryptionService } from './recipient-encryption.service';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    TypeOrmModule.forFeature([ProgrammeMembership, Recipient]),
  ],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    RecipientEncryptionService,
    BonusEligibilityGuard,
  ],
  exports: [OnboardingService, BonusEligibilityGuard],
})
export class OnboardingModule {}
