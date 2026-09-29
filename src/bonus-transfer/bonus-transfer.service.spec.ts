import { Test, TestingModule } from '@nestjs/testing';
import { BonusTransferService } from './bonus-transfer.service';

describe('BonusTransferService', () => {
  let service: BonusTransferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BonusTransferService],
    }).compile();

    service = module.get<BonusTransferService>(BonusTransferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
