import {Body,Controller,Delete,Get,Headers,Post,Query,Req,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {DemoReviewsService} from './demo-reviews.service';
@Controller('demo-reviews')
export class DemoReviewsController{
 constructor(private readonly reviews:DemoReviewsService){}
 @Get('config')config(){return this.reviews.configuration();}
 @Get()list(@Query('page')page:unknown){return this.reviews.list(page);}
 @Post()@UseGuards(JwtAuthGuard)submit(@Req()req:{user:{id:number}},@Body()body:Parameters<DemoReviewsService['submit']>[1],@Headers('idempotency-key')key:unknown){return this.reviews.submit(req.user.id,body,key);}
 @Delete('mine')@UseGuards(JwtAuthGuard)remove(@Req()req:{user:{id:number}}){return this.reviews.removeOwn(req.user.id);}
}
