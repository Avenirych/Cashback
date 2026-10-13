import { Click } from './click.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { ClicksService } from './clicks.service';

describe('ClicksService', () => {
  let service: ClicksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClicksService,
        { provide: getRepositoryToken(Click), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() } }
      ],
    }).compile();

    service = module.get<ClicksService>(ClicksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
