import {Global,Module,Injectable,NestInterceptor,ExecutionContext,CallHandler} from '@nestjs/common';
import {APP_INTERCEPTOR} from '@nestjs/core';
import {from,Observable,switchMap} from 'rxjs';
import {randomUUID} from 'node:crypto';
import {ActivityService} from './activity.service';
import {ActivityController} from './activity.controller';
@Injectable()
class ActivityRequestInterceptor implements NestInterceptor {
 constructor(private readonly activity:ActivityService){}
 intercept(context:ExecutionContext,next:CallHandler):Observable<unknown>{
  if(context.getType()!=='http'||!this.activity.enabled())return next.handle();
  const r=context.switchToHttp().getRequest();
  if(!r.user?.id||!['POST','PATCH','DELETE'].includes(r.method)||!/^\/(forum|demo-reviews|activity)(\/|$)/.test(r.path))return next.handle();
  // Authentication guards run first. Never use an ID supplied in a request body.
  const operation=this.activity.reserve({subject:this.activity.subject(r.user.id),userId:r.user.id,action:'sensitive',partner:'http',mode:'security',key:randomUUID(),material:'request'}).then(op=>this.activity.settle(op.id,'confirmed'));
  return from(operation).pipe(switchMap(()=>next.handle()));
 }
}
@Global()
@Module({providers:[ActivityService,{provide:APP_INTERCEPTOR,useClass:ActivityRequestInterceptor}],controllers:[ActivityController],exports:[ActivityService]})
export class ActivityModule {}
