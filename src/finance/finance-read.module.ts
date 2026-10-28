import {BadRequestException,Controller,Get,Inject,Module,Req,ServiceUnavailableException,UseGuards} from '@nestjs/common';
import type {DynamicModule} from '@nestjs/common';
import type {DataSource} from 'typeorm';
import {FINANCE_READER,FinanceJwtGuard,FinanceJwtStrategy} from './finance-jwt';
export {FINANCE_READER} from './finance-jwt';
import {BonusUseSnapshot} from './bonus-use-snapshot';
import {JwtLedgerAuthority} from './jwt-ledger-authority';

/** Prepared only: no imports from AppModule. Supply a dedicated RO DataSource, never default source. */
@Controller('api/v1/my/bonus-data')
@UseGuards(FinanceJwtGuard)
export class FinanceReadController {
 constructor(@Inject(FINANCE_READER) private readonly source:DataSource){}
 private async read(req:any,history:boolean){
  if(Object.keys(req.query??{}).length||Object.keys(req.body??{}).length)throw new BadRequestException('No owner selectors accepted');
  const id=req.user?.id;
  if(!Number.isInteger(id)||id<1||id>2147483647)throw new BadRequestException('Authenticated principal required');
  const r=this.source.createQueryRunner();
  try{
   await r.connect();await r.startTransaction('REPEATABLE READ');await r.query('SET TRANSACTION READ ONLY');
   await r.query("SET LOCAL statement_timeout='5s'");await r.query("SET LOCAL lock_timeout='1s'");
   const authority=new JwtLedgerAuthority(req.user.account_uuid);
   let result:unknown;
   if(!history)result=await new BonusUseSnapshot(this.source,authority).read(r.manager,String(id));
   else{
    const owner=await authority.resolveOwner(r.manager,String(id));
    const rows=await r.query(`SELECT p.id,p.side,p."amountPence",a.currency,j."createdAt" FROM finance_postings p
     JOIN finance_accounts a ON a.id=p."accountId" JOIN finance_journals j ON j.id=p."journalId"
     WHERE j.sealed AND EXISTS(SELECT 1 FROM finance_bonus_lots l WHERE l.owner=$1 AND (l.available=a.id OR l.reserved=a.id))
     ORDER BY j."createdAt" DESC,p.id DESC LIMIT 101`,[owner]);
    result={schemaVersion:'bonus-history.v1',scope:'own_lot_accounts',complete:false,hasMore:rows.length>100,entries:rows.slice(0,100)};
   }
   await r.commitTransaction();return result;
  }catch(e){if(r.isTransactionActive)await r.rollbackTransaction();if(e instanceof BadRequestException||[401,403,503].includes((e as any)?.getStatus?.()))throw e;throw new ServiceUnavailableException('Bonus data unavailable');}
  finally{await r.release();}
 }
 @Get() snapshot(@Req() req:any){return this.read(req,false);}
 @Get('history') history(@Req() req:any){return this.read(req,true);}
}
@Module({})
export class FinanceReadModule {
 static prepare(source:DataSource):DynamicModule{
  if((source.options as {name?:string}).name!=='finance-readonly'||(source.options as {username?:string}).username!=='cashback_finance_ro'||source.options.synchronize||source.options.migrationsRun)throw Error('Dedicated non-migrating finance-readonly source required');
  return{module:FinanceReadModule,controllers:[FinanceReadController],providers:[FinanceJwtStrategy,FinanceJwtGuard,{provide:FINANCE_READER,useValue:source}]};
 }
}
