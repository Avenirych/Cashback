import { PromoService } from './promo.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PromoController } from './promo.controller';

describe('PromoController', () => {
  let controller: PromoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromoController],
      providers: [{ provide: PromoService, useValue: {} }],
    }).compile();

    controller = module.get<PromoController>(PromoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
