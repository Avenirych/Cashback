import { scaffoldDependencyMock } from '../../test/scaffold-mocks';
import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalController } from './withdrawal.controller';

describe('WithdrawalController', () => {
  let controller: WithdrawalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WithdrawalController],
    }).useMocker(scaffoldDependencyMock).compile();

    controller = module.get<WithdrawalController>(WithdrawalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
