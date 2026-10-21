import { BonusService } from './bonus.service';
import { BonusItem } from './bonus-item.entity';
import { BonusTransfer } from './bonus-transfer.entity';
import { DataSource } from 'typeorm';
const uuid='11111111-1111-4111-8111-111111111111';
function setup(){
 const sender={user_id:1,username:'Sender_REAL',banned:false};const receiver={user_id:2,username:'Receiver_REAL',banned:false};
 const bonus=Object.assign(new BonusItem(),{id:uuid,userId:1,amount:'6.25',source:'ads',status:'confirmed',usedAt:null,expiresAt:new Date(Date.now()+86400000),createdAt:new Date()});
 const manager:any={query:jest.fn().mockResolvedValue([]),findOne:jest.fn().mockResolvedValue({id:1,email_verified:true}),find:jest.fn().mockResolvedValue([]),getRepository:jest.fn(),create:jest.fn((C,data)=>Object.assign(new C(),data)),save:jest.fn(async(C,item)=>Object.assign(item,{id:item.id||uuid,createdAt:item.createdAt||new Date()}))};
 let lookup:any;const query:any={where:jest.fn((_sql,params)=>{lookup=params;return query}),andWhere:jest.fn().mockReturnThis(),orderBy:jest.fn().mockReturnThis(),setLock:jest.fn().mockReturnThis(),getOne:jest.fn(()=>Promise.resolve(lookup?.userId?sender:receiver)),getMany:jest.fn().mockResolvedValue([bonus])};manager.getRepository.mockReturnValue({createQueryBuilder:()=>query});
 const ds={transaction:jest.fn(async(_isolation,run)=>run(manager))};return {service:new BonusService(ds as unknown as DataSource),manager,query,sender,receiver,bonus,ds};
}
test('demo transfer resolves real forum usernames and preserves expiry and user IDs',async()=>{const {service,manager,query,bonus}=setup();const results=await service.transferBonuses(1,'Receiver_REAL',[uuid],'test-idempotency-key-001');expect(results).toHaveLength(1);expect(results[0]).toEqual(expect.objectContaining({fromUserId:1,toUserId:2,fromUsername:'Sender_REAL',toUsername:'Receiver_REAL',amount:'6.25',expiresAt:bonus.expiresAt}));expect(query.where).toHaveBeenCalledWith('LOWER(forum.username) = :username',{username:'receiver_real'});expect(manager.save).toHaveBeenCalledWith(BonusItem,expect.objectContaining({userId:2,source:'transfer',transferMeta:expect.objectContaining({fromUsername:'Sender_REAL',toUsername:'Receiver_REAL'})}));});
test('unverified account cannot transfer',async()=>{const {service,manager}=setup();manager.findOne.mockResolvedValue({email_verified:false});await expect(service.transferBonuses(1,'Receiver_REAL',[uuid],'test-idempotency-key-001')).rejects.toThrow('Verify your email');expect(manager.save).not.toHaveBeenCalled();});
test('banned sender and self transfer are blocked',async()=>{const x=setup();x.sender.banned=true;await expect(x.service.transferBonuses(1,'Receiver_REAL',[uuid],'test-idempotency-key-001')).rejects.toThrow('banned');const y=setup();y.receiver.user_id=1;await expect(y.service.transferBonuses(1,'Sender_REAL',[uuid],'test-idempotency-key-001')).rejects.toThrow('yourself');expect(y.manager.save).not.toHaveBeenCalled();});
test('expired or spent credits cannot be spent',async()=>{const {service,bonus,manager}=setup();bonus.expiresAt=new Date(0);await expect(service.transferBonuses(1,'Receiver_REAL',[uuid],'test-idempotency-key-001')).rejects.toThrow('expired');expect(manager.save).not.toHaveBeenCalled();});
test('no real purchase or payout operation is enabled',async()=>{await expect(setup().service.spendBonusesOnPurchase()).rejects.toThrow();});
