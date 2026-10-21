import { scaffoldDependencyMock } from '../../test/scaffold-mocks';
import { Test, TestingModule } from '@nestjs/testing';
import { CashbackService } from './cashback.service';

describe('CashbackService', () => {
  let service: CashbackService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashbackService],
    }).useMocker(scaffoldDependencyMock).compile();

    service = module.get<CashbackService>(CashbackService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
