import {ForumUserService} from './forum-user.service';
import {ForumUser} from './forum-user.entity';
import {ForbiddenException} from '@nestjs/common';
import {mkdir,unlink,writeFile} from 'node:fs/promises';
jest.mock('node:fs/promises',()=>({mkdir:jest.fn(),unlink:jest.fn().mockResolvedValue(undefined),writeFile:jest.fn()}));
describe('profile mutations share moderation transaction',()=>{
 const prior=process.env.CASHBACK_CONTENT_MODERATION;
 afterEach(()=>{if(prior===undefined)delete process.env.CASHBACK_CONTENT_MODERATION;else process.env.CASHBACK_CONTENT_MODERATION=prior;});
 test('uses transaction repository and never writes through original repository',async()=>{
  process.env.CASHBACK_CONTENT_MODERATION='true';
  const member={id:1,user_id:7,username:'OldAlias',banned:false,avatar_url:null};
  const scoped={findOne:jest.fn().mockResolvedValue(member),createQueryBuilder:()=>({where:jest.fn().mockReturnThis(),getOne:async()=>null}),update:jest.fn().mockResolvedValue({affected:1})};
  const original={update:jest.fn()},manager={getRepository:jest.fn().mockReturnValue(scoped)};
  const moderation={withCommunication:jest.fn(async(_id,work)=>work(manager))};
  const s=new ForumUserService({} as any,original as any,moderation as any);
  const result=await s.updateProfile(7,{username:'NewAlias'});
  expect(result.username).toBe('NewAlias');expect(manager.getRepository).toHaveBeenCalledWith(ForumUser);expect(scoped.update).toHaveBeenCalled();expect(original.update).not.toHaveBeenCalled();
 });
 test('sanction rejects profile and avatar before any repository or filesystem write',async()=>{
  process.env.CASHBACK_CONTENT_MODERATION='true';const original={update:jest.fn()};
  const moderation={withCommunication:jest.fn().mockRejectedValue(new ForbiddenException('Restricted'))};
  const s=new ForumUserService({} as any,original as any,moderation as any);
  await expect(s.updateProfile(7,{username:'Bypass'})).rejects.toThrow(ForbiddenException);
  await expect(s.uploadAvatar(7,{buffer:Buffer.from('fixture'),size:7,mimetype:'image/png'})).rejects.toThrow(ForbiddenException);
  expect(original.update).not.toHaveBeenCalled();expect(mkdir).not.toHaveBeenCalled();expect(writeFile).not.toHaveBeenCalled();
 });
 test('old avatar cleanup waits for successful transaction commit',async()=>{
  process.env.CASHBACK_CONTENT_MODERATION='true';(unlink as jest.Mock).mockClear();
  const scoped={findOne:async()=>({id:1,user_id:7,username:'Alias',banned:false,avatar_url:'/avatars/7-123.png'}),update:async()=>({affected:1})};
  let commit=false;const moderation={withCommunication:async(_id:number,work:(manager:any)=>Promise<any>)=>{const result=await work({getRepository:()=>scoped});expect(unlink).not.toHaveBeenCalled();commit=true;return result;}};
  const s=new ForumUserService({} as any,{} as any,moderation as any);await s.updateProfile(7,{avatar_url:null});expect(commit).toBe(true);expect(unlink).toHaveBeenCalledTimes(1);
 });
});
