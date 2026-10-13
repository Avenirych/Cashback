import { BalanceOperation } from './balance.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from './balance.service';

describe('BalanceService', () => {
  let service: BalanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BalanceService,
        { provide: getRepositoryToken(BalanceOperation), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: NotificationsService, useValue: {} }
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
