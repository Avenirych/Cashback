import {Inject,Injectable,UnauthorizedException,ServiceUnavailableException} from '@nestjs/common';
import {PassportStrategy,AuthGuard} from '@nestjs/passport';
import {ExtractJwt,Strategy} from 'passport-jwt';
import type {DataSource} from 'typeorm';
import {requiredJwtSecret} from '../local-configuration';
import {JwtLedgerAuthority} from './jwt-ledger-authority';
import type {FinanceSessionAuthority} from '../auth/session-revocation.service';
import {isSessionVersion} from '../auth/session-version';
export const FINANCE_READER=Symbol('FINANCE_READER');
export const FINANCE_SESSION_AUTHORITY=Symbol('FINANCE_SESSION_AUTHORITY');
/** A separate strategy retains UUID/ledger identity and enforces app-primary revocation. */
@Injectable()
export class FinanceJwtStrategy extends PassportStrategy(Strategy,'finance-jwt') {
 constructor(@Inject(FINANCE_READER) private readonly source:DataSource,
   @Inject(FINANCE_SESSION_AUTHORITY) private readonly sessions:FinanceSessionAuthority){
  super({jwtFromRequest:ExtractJwt.fromAuthHeaderAsBearerToken(),ignoreExpiration:false,secretOrKey:requiredJwtSecret()});
 }
 async validate(payload:unknown){
  const p=payload as any;
  if(!p||!Number.isSafeInteger(p.sub)||p.sub<1||p.sub>2147483647||typeof p.account_uuid!=='string'||!isSessionVersion(p.sv))
   throw new UnauthorizedException('Finance session identity required');
  try { await this.sessions.verifyFinance(p.sub,p.account_uuid,p.sv); }
  catch(e){
   if(e instanceof UnauthorizedException)throw e;
   throw new ServiceUnavailableException('Session authority unavailable');
  }
  const r=this.source.createQueryRunner();
  try{
   await r.connect();await r.startTransaction('REPEATABLE READ');await r.query('SET TRANSACTION READ ONLY');
   await r.query("SET LOCAL statement_timeout='5s'");await r.query("SET LOCAL lock_timeout='1s'");
   await new JwtLedgerAuthority(p.account_uuid).resolveOwner(r.manager,String(p.sub));await r.commitTransaction();
   return{id:p.sub,account_uuid:p.account_uuid,sv:p.sv};
  }catch(e){
   if(e instanceof UnauthorizedException || (e as {getStatus?:()=>number})?.getStatus?.()===403)throw e;
   throw new ServiceUnavailableException('Ledger identity unavailable');
  }finally{
   try{if(r.isTransactionActive)await r.rollbackTransaction();}
   catch{throw new ServiceUnavailableException('Ledger identity unavailable');}
   finally{try{await r.release();}catch{throw new ServiceUnavailableException('Ledger identity unavailable');}}
  }
 }
}
@Injectable()
export class FinanceJwtGuard extends AuthGuard('finance-jwt'){}
/** Called only by a separately approved issuer using a fresh authenticated user snapshot. */
export function financeSessionClaims(id:number,accountUuid:string,sessionVersion:number){
 if(!Number.isInteger(id)||id<1||id>2147483647||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(accountUuid))throw Error('Verified account identity required');
 if(!isSessionVersion(sessionVersion))throw Error('Verified session version required');
 return{sub:id,account_uuid:accountUuid,sv:sessionVersion};
}
