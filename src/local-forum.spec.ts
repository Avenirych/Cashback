import {ForumController} from './forum/forum.controller';
import {ForumService} from './forum/forum.service';
import {ForumUserService} from './forum/forum-user.service';
import {JwtAuthGuard} from './auth/jwt-auth.guard';
import {PATH_METADATA, METHOD_METADATA, GUARDS_METADATA} from '@nestjs/common/constants';
import {RequestMethod} from '@nestjs/common';
test('historical forum registration keeps its POST route and JWT guard',()=>{
 expect(Reflect.getMetadata(PATH_METADATA,ForumController)).toBe('forum');
 expect(Reflect.getMetadata(PATH_METADATA,ForumController.prototype.register)).toBe('register');
 expect(Reflect.getMetadata(METHOD_METADATA,ForumController.prototype.register)).toBe(RequestMethod.POST);
 expect(Reflect.getMetadata(GUARDS_METADATA,ForumController.prototype.register)).toContain(JwtAuthGuard);
});
test('registration forwards original username, buyer identity and rules without another endpoint',async()=>{
 const register=jest.fn().mockResolvedValue({username:'Buyer_1'});
 const c=new ForumController({} as ForumService,{register} as unknown as ForumUserService);
 await expect(c.register({user:{id:7}},'Buyer_1',true)).resolves.toEqual({username:'Buyer_1'});
 expect(register).toHaveBeenCalledWith(7,'Buyer_1',true);
});
