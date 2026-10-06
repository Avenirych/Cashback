import { Repository } from 'typeorm';
import { BonusService } from './bonus.service';
import { UserBonusSettings } from './user-bonus-settings.entity';
import { UserBonusSources } from './user-bonus-sources.entity';

describe('BonusService write security', () => {
  const settings = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
  };
  const sources = { create: jest.fn(), save: jest.fn(), find: jest.fn() };
  const service = new BonusService(
    settings as unknown as Repository<UserBonusSettings>,
    sources as unknown as Repository<UserBonusSources>,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    settings.findOne.mockResolvedValue(null);
  });

  it('only persists legitimate percentage settings owned by the authenticated user', async () => {
    expect(
      await service.updateSettings(7, {
        ad_bonus_percent: 10,
        research_bonus_percent: 20,
      }),
    ).toEqual({
      user: { id: 7 },
      ad_bonus_percent: 10,
      research_bonus_percent: 20,
    });
  });
  it.each([
    { user: { id: 999 } },
    { userId: 999 },
    { id: 1 },
    { balance: 100 },
    { ad_bonus_percent: 101 },
    { ad_bonus_percent: -1 },
    { ad_bonus_percent: '10' },
    { research_bonus_percent: Infinity },
  ])('rejects invalid or non-allowlisted settings %p', async (data) => {
    await expect(service.updateSettings(7, data)).rejects.toThrow();
    expect(settings.save).not.toHaveBeenCalled();
  });
  it('preserves existing ownership on updates', async () => {
    settings.findOne.mockResolvedValue({
      id: 1,
      user: { id: 7 },
      ad_bonus_percent: 5,
    });
    expect(await service.updateSettings(7, { ad_bonus_percent: 15 })).toEqual({
      id: 1,
      user: { id: 7 },
      ad_bonus_percent: 15,
    });
  });
  it('never accepts client-supplied bonus rewards or arbitrary ownership', async () => {
    await expect(
      service.addSources(7, { user: { id: 999 }, ad_earnings: 1000 }),
    ).rejects.toThrow('trusted server');
    await expect(service.addSources(7, {})).rejects.toThrow('trusted server');
    expect(sources.create).not.toHaveBeenCalled();
    expect(sources.save).not.toHaveBeenCalled();
  });
});
