import {Test} from '@nestjs/testing';
import request from 'supertest';
import {INestApplication} from '@nestjs/common';
import {ContentModerationController} from './content-moderation.controller';
import {ContentModerationService} from './content-moderation.service';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {forumWriteBarrier} from './moderation-schema-gate';
describe('actual HTTP rollback barrier',()=>{
 let app:INestApplication;const prior=process.env.CASHBACK_FORUM_READ_ONLY;const submit=jest.fn();
 beforeAll(async()=>{process.env.CASHBACK_FORUM_READ_ONLY='true';const m=await Test.createTestingModule({controllers:[ContentModerationController],providers:[{provide:ContentModerationService,useValue:{submit,read:async()=>[],decide:submit,appeal:submit,resolveAppeal:submit}}]}).overrideGuard(JwtAuthGuard).useValue({canActivate:()=>true}).compile();app=m.createNestApplication();app.use(forumWriteBarrier);await app.init();});
 afterAll(async()=>{await app.close();if(prior===undefined)delete process.env.CASHBACK_FORUM_READ_ONLY;else process.env.CASHBACK_FORUM_READ_ONLY=prior;});
 test.each(['/forum/reviews','/forum/moderation/1/decision','/forum/moderation/1/appeal','/forum/moderation/1/resolve-appeal'])('rejects %s before controller even with an accepted auth guard',async path=>{await request(app.getHttpServer()).post(path).send({reason:'Fixture'}).expect(503);expect(submit).not.toHaveBeenCalled();});
 test('retains anonymous published-review reads',async()=>{await request(app.getHttpServer()).get('/forum/reviews').expect(200,[]);});
});
