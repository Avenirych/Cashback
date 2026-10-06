import { Test, TestingModule } from '@nestjs/testing';
import { BonusController } from './bonus.controller';
import { BonusService } from './bonus.service';
import { BonusEligibilityGuard } from '../onboarding/bonus-eligibility.guard';

describe('BonusController', () => {
  let controller: BonusController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BonusController],
      providers: [{ provide: BonusService, useValue: {} }],
    })
      .overrideGuard(BonusEligibilityGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BonusController>(BonusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
