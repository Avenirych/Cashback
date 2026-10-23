import {Injectable,OnApplicationBootstrap,ServiceUnavailableException} from '@nestjs/common';
import {DataSource} from 'typeorm';
import type {Request,Response,NextFunction} from 'express';
import {localDemoReviewsEnabled} from './local-demo-reviews';
export const MODERATION_SCHEMA_VERSION=3;
export function forumWriteBarrier(req:Request,res:Response,next:NextFunction){
 const path=req.path.toLowerCase().replace(/\/+$/,'')||'/';
 const demo=localDemoReviewsEnabled();
 if(process.env.CASHBACK_DEMO_ONLY==='true' && ((!demo && path==='/auth/register' && req.method.toUpperCase()==='POST') || path==='/forum/moderation'||path.startsWith('/forum/moderation/'))){res.status(503).json({message:'Demo mode: registration and moderation operations are closed'});return;}
 // These authenticated personal-profile operations cannot publish a topic/post/review.
 if(demo && req.method.toUpperCase()==='POST'&&['/forum/register','/forum/avatar'].includes(path)){next();return;}
 if(process.env.CASHBACK_FORUM_READ_ONLY==='true' && !['GET','HEAD','OPTIONS'].includes(req.method.toUpperCase()) && (path==='/forum'||path.startsWith('/forum/'))){res.status(503).json({message:'Forum is temporarily read-only'});return;}
 next();
}
@Injectable()
export class ModerationSchemaGate implements OnApplicationBootstrap {
 constructor(private readonly db:DataSource){}
 async onApplicationBootstrap(){
  try{
   const [r]=await this.db.query("SELECT to_regclass('public.forum_moderation_schema') IS NOT NULL AS installed");
   if(!r?.installed){if(process.env.CASHBACK_CONTENT_MODERATION==='true')throw Error();return;}
   const rows=await this.db.query('SELECT version FROM forum_moderation_schema');
   if(rows.length!==1||Number(rows[0].version)!==MODERATION_SCHEMA_VERSION)throw Error();
  }catch{throw new ServiceUnavailableException('Incompatible or unavailable moderation schema; backend startup refused');}
 }
}
