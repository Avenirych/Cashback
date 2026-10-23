import {Injectable,ServiceUnavailableException,ForbiddenException,BadRequestException,OnModuleInit,OnModuleDestroy,Logger,Optional} from '@nestjs/common';
import {ActivityService} from '../activity/activity.service';
import {digest} from '../activity/activity-engine';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ForumUserService} from './forum-user.service';
import {DemoReview,DemoReviewStore} from './demo-review-store';
import {localDemoReviewsEnabled} from './local-demo-reviews';
@Injectable()
export class DemoReviewsService implements OnModuleInit,OnModuleDestroy {
 private readonly store=new DemoReviewStore('/app/demo-reviews');
 private timer:NodeJS.Timeout|undefined;
 onModuleInit(){if(!localDemoReviewsEnabled())return;const cleanup=()=>{void this.store.list().catch(()=>new Logger('DemoReviews').warn('Local demo retention cleanup unavailable'));};cleanup();this.timer=setInterval(cleanup,3600000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 constructor(private readonly members:ForumUserService,@Optional() private readonly activity?:ActivityService){}
 configuration(){return{enabled:localDemoReviewsEnabled(),demo:true,retentionDays:7};}
 private enabled(){if(!localDemoReviewsEnabled())throw new ServiceUnavailableException('Local demo reviews disabled');}
 private public(row:DemoReview){return{id:row.id,author:row.author,body:row.body,title:row.title,rating:row.rating,language:row.language,publishedAt:row.publishedAt,demo:true,kind:'submitted-demo'};}
 async list(pageValue:unknown){
  this.enabled();const page=pageValue===undefined?1:Number(pageValue);if(!Number.isSafeInteger(page)||page<1||page>10000)throw new BadRequestException('Invalid page');
  let seeds:Array<{id:string;name:string;text:Record<string,string>;fictional:boolean}>;
  try{seeds=JSON.parse(readFileSync(join(process.cwd(),'demo-review-examples.json'),'utf8'));if(seeds.length!==10||seeds.some(s=>s.fictional!==true))throw Error();}catch{throw new ServiceUnavailableException('Demo examples unavailable');}
  const examples=seeds.map((s,i)=>({id:s.id,author:{username:s.name,avatar_url:null},body:s.text,title:'',rating:null,language:null,publishedAt:new Date(Date.UTC(2026,9,12,0,0,10-i)).toISOString(),demo:true,kind:'fictional-example'}));
  const all=[...(await this.store.list()).map(r=>this.public(r)),...examples].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||b.id.localeCompare(a.id));
  return{items:all.slice((page-1)*10,page*10),page,pageSize:10,total:all.length,demo:true,retentionDays:7};
 }
 async submit(userId:number,input:Parameters<DemoReviewStore['add']>[2],key:unknown){
  this.enabled();const member=await this.members.activeMember(userId);
  if(member.banned)throw new ForbiddenException('Forum access restricted');
  const write=()=>this.store.add(userId,{username:member.username,avatar_url:member.avatar_url},input,key);
  if(process.env.CASHBACK_ACTIVITY_LIMITS==='true'){
   if(!this.activity)throw new ServiceUnavailableException('Activity protection required');
   if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw new BadRequestException('Idempotency key required');
   const material=JSON.stringify([typeof input.title==='string'?input.title.trim():input.title,typeof input.body==='string'?input.body.trim():input.body,input.rating,input.language]);
   const result=await this.activity.perform(userId,'review','local-demo','demo',key,material,write,async()=>{try{return !(await this.store.list()).some(r=>r.authorId===userId&&r.keyHash===digest(key));}catch{return false;}});
   return this.public(result);
  }
  return this.public(await write());
 }
 async removeOwn(userId:number){this.enabled();await this.members.assertVerifiedUser(userId);return this.store.removeOwn(userId);}
}
