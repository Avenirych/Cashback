import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { BonusService } from './bonus.service';

describe('BonusService', () => {
  let service: BonusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BonusService,
        { provide: DataSource, useValue: {} }
      ],
    }).compile();

    service = module.get<BonusService>(BonusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
