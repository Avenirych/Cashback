import {Body,Controller,Get,Headers,Param,ParseIntPipe,Post,Req,UseGuards,BadRequestException,ServiceUnavailableException} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {ActivityService} from './activity.service';
interface Request {user:{id:number}}
@Controller('activity')
export class ActivityController {
 constructor(private readonly activity:ActivityService){}
 @Get('policies') policies(){return this.activity.publicPolicies();}
 @Get('me') @UseGuards(JwtAuthGuard) own(@Req() r:Request){return this.activity.own(r.user.id);}
 @Post('appeals') @UseGuards(JwtAuthGuard) appeal(@Req() r:Request,@Body('reason') reason:unknown){return this.activity.appeal(r.user.id,reason);}
 @Get('admin/events') @UseGuards(JwtAuthGuard) events(@Req() r:Request){return this.activity.events(r.user.id);}
 @Get('admin/appeals') @UseGuards(JwtAuthGuard) appeals(@Req() r:Request){return this.activity.appeals(r.user.id);}
 @Post('admin/appeals/:id/resolve') @UseGuards(JwtAuthGuard) resolve(@Req() r:Request,@Param('id',ParseIntPipe) id:number,@Body('resolution') reason:unknown){return this.activity.resolve(r.user.id,id,reason);}
 // A safe test consumes quota only. It cannot call a financial service, create
 // a bonus item or claim a real partner completed a video/survey.
 @Post('demo/:action') @UseGuards(JwtAuthGuard) async demo(@Req() r:Request,@Param('action') action:string,@Headers('idempotency-key') key:string){
  if(process.env.CASHBACK_DEMO_ONLY!=='true'||process.env.HISTORICAL_LOCAL!=='true'||process.env.HISTORICAL_CONTAINER!=='true')throw new ServiceUnavailableException('Local demo only');
  if(!['video','research'].includes(action))throw new BadRequestException('Invalid demo action');
  return this.activity.demoCompleted(r.user.id,action as 'video'|'research',key);
 }
}
