import 'reflect-metadata';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { safeUserDto, parseOwnUserPatch } from './users.dto';
import { User } from './user.entity';
import { TopicsController } from '../topics.controller';
import { PostsController } from '../posts.controller';
describe('Restored legacy authorization, without opening HTTP sockets',()=>{
  const getById=jest.fn(); const update=jest.fn();
  const controller=new UsersController({getById,update} as unknown as UsersService);
  beforeEach(()=>jest.clearAllMocks());
  it('requires a JWT guard on every remaining Users handler',()=>{
    for(const name of ['getById','update'] as const) expect(Reflect.getMetadata(GUARDS_METADATA,UsersController.prototype[name])).toHaveLength(1);
    for(const name of ['getAll','create','updateBalance']) expect(Object.prototype.hasOwnProperty.call(UsersController.prototype,name)).toBe(false);
  });
  it('rejects anonymous and another user before service calls',async()=>{
    await expect(controller.getById(2,{})).rejects.toThrow();
    await expect(controller.getById(2,{user:{id:1}})).rejects.toThrow();
    expect(getById).not.toHaveBeenCalled();
  });
  it('never serializes passwords or email verification tokens',()=>{
    const user=Object.assign(new User(),{id:1,email:'test@example.invalid',password:'sensitive',email_token:'sensitive',email_verified:false,balance:0});
    expect(safeUserDto(user)).not.toHaveProperty('password'); expect(safeUserDto(user)).not.toHaveProperty('email_token');
  });
  it.each(['balance','email_verified','password','email_token','id','phone_e164'])('rejects mass assignment of %s',field=>expect(()=>parseOwnUserPatch({name:'Buyer',[field]:'injected'})).toThrow());
  it('only permits the historical trimmed name update',()=>expect(parseOwnUserPatch({name:' Buyer '})).toEqual({name:'Buyer'}));
  it('unregisters legacy topic/post HTTP handlers instead of exposing another forum',()=>{
    for(const type of [TopicsController,PostsController]) for(const name of Object.getOwnPropertyNames(type.prototype)) {
      if(name==='constructor')continue;
      const member:unknown=Object.getOwnPropertyDescriptor(type.prototype,name)?.value;
      if(typeof member==='function') expect(Reflect.getMetadata(PATH_METADATA,member)).toBeUndefined();
    }
  });
});
