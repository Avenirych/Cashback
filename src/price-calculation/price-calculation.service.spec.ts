import { Test, TestingModule } from '@nestjs/testing';
import { PriceCalculationService } from './price-calculation.service';

describe('PriceCalculationService', () => {
  let service: PriceCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PriceCalculationService],
    }).compile();

    service = module.get<PriceCalculationService>(PriceCalculationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
