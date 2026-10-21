import type { EntityManager, Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { MarketingPreferences } from '../marketing-preferences/marketing-preferences.entity';

describe('Owner phone transaction (repositories mocked, no database)', () => {
  function setup() {
    const user = {id:42,name:'Synthetic',phone_e164:'+12025550123',phone_verified:true,
      phone_verified_at:new Date('2026-01-01')};
    const consent = {id:7,userId:42,smsMarketing:true,smsMarketingGrantedAt:new Date('2026-01-01'),
      smsMarketingRevokedAt:null,smsMarketingConsentVersion:'sms-marketing-v1',specialOffers:true};
    const users = {findOne:jest.fn().mockResolvedValue({...user}),save:jest.fn(async data => data)};
    const preferences = {find:jest.fn().mockResolvedValue([{...consent}]),save:jest.fn(async data => data)};
    const manager = {getRepository:jest.fn(type => type === User ? users : preferences)};
    const transaction = jest.fn(async (_level, work: (m: EntityManager) => Promise<unknown>) => work(manager as unknown as EntityManager));
    const root = {manager:{transaction},update:jest.fn()};
    return {service:new UsersService(root as unknown as Repository<User>),user,consent,users,preferences,transaction,manager,root};
  }
  it('locks the same parent row as consent writers and revokes in that transaction', async () => {
    const m=setup();
    const result=await m.service.updateOwnProfile(42,{phone_e164:'+1 (202) 555-0124'});
    expect(m.transaction).toHaveBeenCalledWith('READ COMMITTED',expect.any(Function));
    expect(m.users.findOne).toHaveBeenCalledWith(expect.objectContaining({where:{id:42},lock:{mode:'pessimistic_write'}}));
    expect(m.manager.getRepository).toHaveBeenCalledWith(MarketingPreferences);
    expect(m.preferences.save).toHaveBeenCalledWith(expect.objectContaining({smsMarketing:false,
      smsMarketingRevokedAt:expect.any(Date),specialOffers:true,smsMarketingGrantedAt:m.consent.smsMarketingGrantedAt}));
    expect(result).toMatchObject({phone_e164:'+12025550124',phone_verified:false,phone_verified_at:null});
    expect(m.root.update).not.toHaveBeenCalled();
  });
  it('equivalent canonical phone does not reset verification or consent', async () => {
    const m=setup();
    const result=await m.service.updateOwnProfile(42,{phone_e164:'+1 (202) 555-0123'});
    expect(result.phone_verified).toBe(true);
    expect(result.phone_verified_at).toEqual(m.user.phone_verified_at);
    expect(m.preferences.find).not.toHaveBeenCalled();
    expect(m.preferences.save).not.toHaveBeenCalled();
  });
  it('permits a legacy account to add a phone with no existing preferences', async () => {
    const m=setup();
    m.users.findOne.mockResolvedValue({...m.user,phone_e164:null,phone_verified:false,phone_verified_at:null});
    m.preferences.find.mockResolvedValue([]);
    expect(await m.service.updateOwnProfile(42,{phone_e164:'+12025550124'})).toMatchObject({phone_verified:false});
    expect(m.preferences.save).not.toHaveBeenCalled();
  });
  it('does not save the phone if consent revocation fails; error is sanitized', async () => {
    const m=setup();
    m.preferences.save.mockRejectedValue(new Error('synthetic-private-phone-detail'));
    await expect(m.service.updateOwnProfile(42,{phone_e164:'+12025550124'}))
      .rejects.toMatchObject({status:503,message:'Profile service unavailable'});
    expect(m.users.save).not.toHaveBeenCalled();
  });
  it('duplicate preference rows block changes instead of selecting an arbitrary consent', async () => {
    const m=setup();m.preferences.find.mockResolvedValue([{...m.consent},{...m.consent,id:8}]);
    await expect(m.service.updateOwnProfile(42,{phone_e164:'+12025550124'})).rejects.toMatchObject({status:409});
    expect(m.users.save).not.toHaveBeenCalled();expect(m.preferences.save).not.toHaveBeenCalled();
  });
  it('internal generic update cannot bypass the phone transaction', async () => {
    const m=setup();
    await expect(m.service.update(42,{phone_e164:'+12025550124'})).rejects.toMatchObject({status:400});
    expect(m.root.update).not.toHaveBeenCalled();
  });
  it('uses the transaction rejection if user save fails after revocation (rollback belongs to TypeORM)', async () => {
    const m=setup();
    m.users.save.mockRejectedValue(new Error('synthetic-sensitive-write-detail'));
    await expect(m.service.updateOwnProfile(42,{phone_e164:'+12025550124'}))
      .rejects.toMatchObject({status:503,message:'Profile service unavailable'});
    expect(m.preferences.save).toHaveBeenCalledTimes(1);
    // No compensating/out-of-transaction write: the manager must roll back both writes.
    expect(m.root.update).not.toHaveBeenCalled();
    expect(m.transaction).toHaveBeenCalledTimes(1);
  });
});
