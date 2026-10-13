import { BonusTransferService } from './bonus-transfer.service';
import { Test, TestingModule } from '@nestjs/testing';
import { BonusTransferController } from './bonus-transfer.controller';

describe('BonusTransferController', () => {
  let controller: BonusTransferController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BonusTransferController],
      providers: [{ provide: BonusTransferService, useValue: {} }],
    }).compile();

    controller = module.get<BonusTransferController>(BonusTransferController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
