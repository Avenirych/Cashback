import {PolicyPurchase} from './policy-purchase';
import {PolicyContext} from './policy-context';
import {BonusUseTerms} from './bonus-use-terms';
import {applicationWindow} from './bonus-use-policy';
import {POLICY_21} from './policy-2026-10-21';
function fixture(amounts:string[],cashback:string,expired=false,gift=false){
 const source={} as any,records=new Map<string,any>(),posts:any[]=[];
 const group=amounts.map((amount,i)=>({id:'r'+i,lot:'l'+i,amount,click:'click',state:'active',owner:'buyer',available:'free'+i,reserved:'held'+i,confirmed:'2026-01-0'+(i+1)+'T00:00:00Z'}));
 const selected={actor:'buyer',versions:[],winner:['source','order'],cap:'10000',rankedOrders:[{source:'source',id:'order',value:'10000',firstIngested:'2026-01-01T00:00:00Z'}]};
 records.set('selection|click|selection',{payload:selected});
 let debt=4000n;
 const m:any={connection:source,queryRunner:null,query:jest.fn(async(sql:string,args:any[])=>{
  if(sql.startsWith('SELECT "sourceNamespace"'))return [];
  if(sql.includes('min("ingestedAt")'))return[{t:'2026-01-01T00:00:00Z'}];
  if(sql.includes("r.state='active'"))return group;
  if(sql.startsWith('SELECT r.*,l.owner'))return[group.find(r=>r.id===args[0])];
  if(sql.includes('FROM finance_bonus_use_terms'))return group.map(r=>({lot:r.lot,...applicationWindow('2026-01-01T00:00:00Z','receipt','receipt')}));
  if(sql.startsWith('SELECT l.*,p.owner')){const i=group.findIndex(r=>r.lot===args[0]);return[{id:args[0],owner:'buyer',available:'free'+i,parent:gift?'parent':null,parent_owner:gift?'sender':null,responsible:'sender',origin:'origin'}];}
  if(sql.startsWith('SELECT d.'))return debt?[{id:'debt',account:'sender-debt',balancePence:debt.toString(),cap:'4000',confirmed:'2026-01-01T00:00:00Z'}]:[];
  if(sql.startsWith('UPDATE')||sql.startsWith('INSERT'))return[];
  throw Error('Unexpected query '+sql);
 })};
 m.queryRunner={connection:source,manager:m,isReleased:false,isTransactionActive:true};
 const facts={click:'click',selection:'selection',reservation:'r0',currentVersionsVerified:true,possibleCashbackPence:cashback,giftOrigins:['sender'],giftLineageVerified:true,linkedDebtSetVerified:true};
 const c:any={source,policy:POLICY_21,enter:async()=>({actor:'buyer',proof:'verified',facts}),serverReceiptTime:async()=>expired?'2026-07-01T00:00:00Z':'2026-02-01T00:00:00Z',
  get:async(_m:any,k:string,s:string,key:string)=>records.get(k+'|'+s+'|'+key),
  record:async(_m:any,k:string,s:string,key:string,payload:any)=>{records.set(k+'|'+s+'|'+key,{payload});},
  account:async(_m:any,key:string)=>key,
  post:async(_m:any,lines:any[])=>{posts.push(lines);debt-=lines.filter(l=>l.accountId==='sender-debt').reduce((n,l)=>n+l.amount,0n);return{journalId:'journal'};}
 };
 c.command=(...args:any[])=>(PolicyContext.prototype.command as any).apply(c,args);
 return{m,c,group,posts,facts,run:()=>new PolicyPurchase(c,new BonusUseTerms(c)).apply(m,'principal','request-key-123','trusted-reference')};
}
describe('isolated existing purchase orchestration with new application terms',()=>{
 it.each([['1000','1000','0'],['8750','8750','0'],['9000','8750','250']])('applies below/at/over cap: %s',async(amount,used,excess)=>{
  const x=fixture([amount],'1250'),r=await x.run();expect(r.used).toBe(used);expect(r.excess).toBe(excess);
  expect(x.posts).toHaveLength(1);
  expect(x.posts[0].filter((l:any)=>l.side==='debit').reduce((n:bigint,l:any)=>n+l.amount,0n)).toBe(BigInt(amount));
 });
 it('expired application releases full reserve to same lot, no liability cancellation',async()=>{
  const x=fixture(['1000'],'0',true),r=await x.run();expect(r.used).toBe('0');expect(r.excess).toBe('1000');
  expect(x.posts[0]).toEqual([{accountId:'held0',side:'debit',amount:1000n},{accountId:'free0',side:'credit',amount:1000n}]);
 });
 it('multiple lots retain FIFO, provenance and their own returned accounts',async()=>{
  const x=fixture(['5000','5000'],'2500'),r=await x.run();expect(r.used).toBe('7500');expect(r.excess).toBe('2500');
  expect(x.posts[0]).toContainEqual({accountId:'free1',side:'credit',amount:2500n});
  expect(x.posts[0].some((l:any)=>l.accountId==='free0')).toBe(false);
  expect(x.m.query.mock.calls.some(([q]:[string])=>/UPDATE finance_bonus_use_terms/.test(q))).toBe(false);
 });
 it('replayed request cannot double spend or return',async()=>{
  const x=fixture(['9000'],'1250'),first=await x.run();expect(await x.run()).toEqual(first);expect(x.posts).toHaveLength(1);
 });
 it('variant A: linked sender debt first, residual remains with recipient',async()=>{
  const x=fixture(['10000'],'5000',false,true),r=await x.run();expect(r.used).toBe('5000');expect(r.excess).toBe('5000');
  expect(x.posts[0]).toContainEqual({accountId:'sender-debt',side:'credit',amount:4000n});
  expect(x.posts[0]).toContainEqual({accountId:'free0',side:'credit',amount:1000n});
 });
 it('cashback above price never posts or silently changes cashback',async()=>{
  const x=fixture(['10000'],'10001');expect((await x.run()).reason).toBe('CASHBACK_EXCEEDS_PRODUCT_PRICE');expect(x.posts).toHaveLength(0);
 });
});
