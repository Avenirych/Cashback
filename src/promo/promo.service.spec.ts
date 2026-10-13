import { Promo } from './promo.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { PromoService } from './promo.service';

describe('PromoService', () => {
  let service: PromoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromoService,
        { provide: getRepositoryToken(Promo), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() } }
      ],
    }).compile();

    service = module.get<PromoService>(PromoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
