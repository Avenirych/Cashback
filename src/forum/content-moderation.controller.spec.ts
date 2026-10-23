import {Test} from '@nestjs/testing';
import {INestApplication,UnauthorizedException} from '@nestjs/common';
import request from 'supertest';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {ContentModerationController} from './content-moderation.controller';
import {ContentModerationService} from './content-moderation.service';
import {startGuardedHttpTestApp} from '../../test/guarded-http-app';
describe('moderation routes and authenticated identity',()=>{
  let app:INestApplication;
  const service={read:jest.fn().mockResolvedValue([]),configuration:jest.fn().mockResolvedValue({enabled:false}),submit:jest.fn().mockResolvedValue({status:'pending'}),mine:jest.fn().mockResolvedValue({}),queue:jest.fn().mockResolvedValue([]),report:jest.fn().mockResolvedValue({accepted:true}),appeal:jest.fn().mockResolvedValue({accepted:true}),decide:jest.fn(),resolveAppeal:jest.fn(),acceptRules:jest.fn(),acceptance:jest.fn()};
  beforeAll(async()=>{
    const m=await Test.createTestingModule({controllers:[ContentModerationController],providers:[{provide:ContentModerationService,useValue:service}]}).overrideGuard(JwtAuthGuard).useValue({canActivate(c:any){const r=c.switchToHttp().getRequest();if(r.headers.authorization!=='fixture')throw new UnauthorizedException();r.user={id:7};return true;}}).compile();
    app=m.createNestApplication();await startGuardedHttpTestApp(app);
  });
  afterAll(async()=>{await app.close();});
  test('only published public review endpoint is anonymous',async()=>{await request(app.getHttpServer()).get('/forum/reviews').expect(200,[]);await request(app.getHttpServer()).get('/forum/reviews/config').expect(200,{enabled:false});});
  test.each(['/forum/reviews','/forum/moderation/1/report','/forum/moderation/1/appeal','/forum/moderation/1/decision','/forum/moderation/1/revoke','/forum/moderation/1/resolve-appeal','/forum/rules/accept'])('anonymous POST %s rejected',async path=>{await request(app.getHttpServer()).post(path).send({}).expect(401);});
  test.each(['/forum/moderation/mine','/forum/moderation/queue','/forum/rules/acceptance'])('anonymous GET %s rejected',async path=>{await request(app.getHttpServer()).get(path).expect(401);});
  test('body cannot choose review author, publish status or moderator role',async()=>{
    const body={title:'Title',body:'A genuine detailed experience',rating:1,experienceConfirmed:true,userId:99,state:'published',moderator:true};
    await request(app.getHttpServer()).post('/forum/reviews').set('Authorization','fixture').set('Idempotency-Key','fixture-key').send(body).expect(201);
    expect(service.submit).toHaveBeenLastCalledWith(7,'review',body,'fixture-key');
    // Service consumes only allowlisted material; identity always comes from validated JWT.
  });
});
