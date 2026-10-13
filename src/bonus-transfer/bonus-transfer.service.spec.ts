import { BonusTransfer } from './bonus-transfer.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { BalanceService } from '../balance/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Test, TestingModule } from '@nestjs/testing';
import { BonusTransferService } from './bonus-transfer.service';

describe('BonusTransferService', () => {
  let service: BonusTransferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BonusTransferService,
        { provide: getRepositoryToken(BonusTransfer), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: BalanceService, useValue: {} },
        { provide: NotificationsService, useValue: {} }
      ],
    }).compile();

    service = module.get<BonusTransferService>(BonusTransferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
