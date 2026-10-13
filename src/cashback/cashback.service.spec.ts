import { Transaction } from './transaction.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { Test, TestingModule } from '@nestjs/testing';
import { CashbackService } from './cashback.service';

describe('CashbackService', () => {
  let service: CashbackService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashbackService,
        { provide: getRepositoryToken(Transaction), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() } },
        { provide: UsersService, useValue: {} }
      ],
    }).compile();

    service = module.get<CashbackService>(CashbackService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
