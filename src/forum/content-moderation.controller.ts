import {Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Req, UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {ContentModerationService} from './content-moderation.service';
interface Request {user:{id:number}}
@Controller('forum')
export class ContentModerationController {
  constructor(private readonly moderation: ContentModerationService) {}
  @Get('reviews') reviews() {return this.moderation.read('reviews');}
  @Get('reviews/config') config() {return this.moderation.configuration();}
  @Get('rules/acceptance') @UseGuards(JwtAuthGuard)
  acceptance(@Req() r:Request){return this.moderation.acceptance(r.user.id);}
  @Post('rules/accept') @UseGuards(JwtAuthGuard)
  accept(@Req() r:Request,@Body('agreedToRules') agreed:unknown){return this.moderation.acceptRules(r.user.id,agreed);}
  @Post('reviews') @UseGuards(JwtAuthGuard)
  submit(@Req() r: Request, @Body() body: {title?:unknown;body?:unknown;rating?:unknown;experienceConfirmed?:unknown}, @Headers('idempotency-key') key?:string) {
    return this.moderation.submit(r.user.id,'review',body,key);
  }
  @Get('moderation/mine') @UseGuards(JwtAuthGuard)
  mine(@Req() r: Request) {return this.moderation.mine(r.user.id);}
  @Get('moderation/queue') @UseGuards(JwtAuthGuard)
  queue(@Req() r: Request) {return this.moderation.queue(r.user.id);}
  @Post('moderation/:id/report') @UseGuards(JwtAuthGuard)
  report(@Req() r:Request,@Param('id',ParseIntPipe) id:number,@Body('reason') reason:unknown) {return this.moderation.report(r.user.id,id,reason);}
  @Post('moderation/:id/appeal') @UseGuards(JwtAuthGuard)
  appeal(@Req() r:Request,@Param('id',ParseIntPipe) id:number,@Body('reason') reason:unknown) {return this.moderation.appeal(r.user.id,id,reason);}
  @Post('moderation/:id/decision') @UseGuards(JwtAuthGuard)
  decide(@Req() r:Request,@Param('id',ParseIntPipe) id:number,@Body() body:{decision:'publish'|'confirm'|'hold';reason:unknown}) {return this.moderation.decide(r.user.id,id,body.decision,body.reason);}
  @Post('moderation/:id/resolve-appeal') @UseGuards(JwtAuthGuard)
  resolve(@Req() r:Request,@Param('id',ParseIntPipe) id:number,@Body() body:{revoke?:unknown;reason:unknown}) {return this.moderation.resolveAppeal(r.user.id,id,body.revoke===true,body.reason);}
  @Post('moderation/:id/revoke') @UseGuards(JwtAuthGuard)
  revoke(@Req() r:Request,@Param('id',ParseIntPipe) id:number,@Body('reason') reason:unknown) {return this.moderation.resolveAppeal(r.user.id,id,true,reason,true);}
}
