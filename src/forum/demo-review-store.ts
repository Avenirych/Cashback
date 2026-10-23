import {promises as fs} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,HttpException,ServiceUnavailableException} from '@nestjs/common';
export interface DemoReview {id:string;authorId:number;author:{username:string;avatar_url:string|null};body:string;title:string;rating:number;language:string;publishedAt:string;expiresAt:string;demo:true;keyHash:string;requestHash:string}
export const DEMO_RETENTION_MS=7*24*3600*1000;
export class DemoReviewStore {
 constructor(private readonly root:string){}
 private async locked<T>(work:(rows:DemoReview[])=>T|Promise<T>):Promise<T>{
  let lock:Awaited<ReturnType<typeof fs.open>>|undefined;let temporary:string|undefined;
  try{
   await fs.mkdir(this.root,{recursive:true});
   if((await fs.lstat(this.root)).isSymbolicLink())throw Error('UNEXPECTED_STORAGE');
   for(let attempt=0;;attempt++){try{lock=await fs.open(join(this.root,'demo-only.lock'),'wx',0o600);break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST'||attempt>=39)throw e;await new Promise(r=>setTimeout(r,25));}}
   const file=join(this.root,'demo-only.json');let rows:DemoReview[]=[];
   try{if((await fs.lstat(file)).isSymbolicLink())throw Error('UNEXPECTED_STORAGE');const raw=JSON.parse(await fs.readFile(file,'utf8'));if(raw.version!==1||!Array.isArray(raw.reviews)||raw.reviews.some((r:DemoReview)=>r.demo!==true||!Number.isSafeInteger(r.authorId)||!Number.isFinite(Date.parse(r.expiresAt))))throw Error('UNEXPECTED_STORAGE');rows=raw.reviews;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   rows=rows.filter(r=>Date.parse(r.expiresAt)>Date.now());
   const result=await work(rows);
   temporary=join(this.root,'demo-only.'+randomUUID()+'.tmp');
   await fs.writeFile(temporary,JSON.stringify({version:1,reviews:rows}),{flag:'wx',mode:0o600});await fs.rename(temporary,file);temporary=undefined;
   return result;
  }catch(e){if(e instanceof HttpException)throw e;throw new ServiceUnavailableException('Local demo storage unavailable; no real publication was accepted');}
  finally{if(temporary)await fs.unlink(temporary).catch(()=>undefined);if(lock){await lock.close();await fs.unlink(join(this.root,'demo-only.lock'));}}
 }
 async list(){return this.locked(rows=>rows.map(r=>({...r})));}
 async add(authorId:number,author:DemoReview['author'],input:{body?:unknown;title?:unknown;rating?:unknown;language?:unknown;demoDeclared?:unknown;agreedToRules?:unknown},key:unknown){
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw new BadRequestException('A valid idempotency key is required');
  if(typeof input.body!=='string'||input.body.trim().length<20||input.body.trim().length>4000||input.body.includes('\0'))throw new BadRequestException('Demo review must contain 20–4000 characters');
  const body=input.body.trim();
  if(input.demoDeclared!==true||input.agreedToRules!==true)throw new BadRequestException('Explicit demo declaration and rules acceptance required');
  if(!['ru','en','de','fr'].includes(String(input.language))||!Number.isInteger(input.rating)||Number(input.rating)<1||Number(input.rating)>5)throw new BadRequestException('Invalid demo review');
  const title=typeof input.title==='string'?input.title.trim():'';if(title.length<3||title.length>255)throw new BadRequestException('Title must contain 3–255 characters');
  const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
  const keyHash=digest(key),requestHash=digest(JSON.stringify([body,title,input.rating,input.language]));
  return this.locked(rows=>{
   const old=rows.find(r=>r.authorId===authorId&&r.keyHash===keyHash);if(old){if(old.requestHash!==requestHash)throw new ConflictException('Idempotency key already used');return old;}
   if(rows.filter(r=>r.authorId===authorId&&Date.parse(r.publishedAt)>Date.now()-3600000).length>=20)throw new HttpException('Demo review rate limit',429);
   if(rows.length>=1000)throw new ServiceUnavailableException('Demo storage capacity reached');
   const time=Math.max(Date.now(),...rows.map(r=>Date.parse(r.publishedAt)+1));
   const row:DemoReview={id:randomUUID(),authorId,author,body,title,rating:Number(input.rating),language:String(input.language),publishedAt:new Date(time).toISOString(),expiresAt:new Date(Date.now()+DEMO_RETENTION_MS).toISOString(),demo:true,keyHash,requestHash};rows.push(row);return row;
  });
 }
 async removeOwn(authorId:number){return this.locked(rows=>{const keep=rows.filter(r=>r.authorId!==authorId);const removed=rows.length-keep.length;rows.splice(0,rows.length,...keep);return{removed};});}
}
