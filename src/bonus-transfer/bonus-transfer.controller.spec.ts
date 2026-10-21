import { scaffoldDependencyMock } from '../../test/scaffold-mocks';
import { Test, TestingModule } from '@nestjs/testing';
import { BonusTransferController } from './bonus-transfer.controller';

describe('BonusTransferController', () => {
  let controller: BonusTransferController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BonusTransferController],
    }).useMocker(scaffoldDependencyMock).compile();

    controller = module.get<BonusTransferController>(BonusTransferController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
