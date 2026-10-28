import {Inject,Injectable,UnauthorizedException} from '@nestjs/common';
import {PassportStrategy,AuthGuard} from '@nestjs/passport';
import {ExtractJwt,Strategy} from 'passport-jwt';
import type {DataSource} from 'typeorm';
import {requiredJwtSecret} from '../local-configuration';
import {JwtLedgerAuthority} from './jwt-ledger-authority';
export const FINANCE_READER=Symbol('FINANCE_READER');
/** Separate strategy prevents an old numeric-sub token following a reused users.id. */
@Injectable()
export class FinanceJwtStrategy extends PassportStrategy(Strategy,'finance-jwt') {
 constructor(@Inject(FINANCE_READER) private readonly source:DataSource){super({jwtFromRequest:ExtractJwt.fromAuthHeaderAsBearerToken(),ignoreExpiration:false,secretOrKey:requiredJwtSecret()});}
 async validate(payload:unknown){
  const p=payload as any;
  if(!p||!Number.isSafeInteger(p.sub)||p.sub<1||p.sub>2147483647||typeof p.account_uuid!=='string')throw new UnauthorizedException('Finance session identity required');
  const r=this.source.createQueryRunner();
  try{await r.connect();await r.startTransaction('REPEATABLE READ');await r.query('SET TRANSACTION READ ONLY');await new JwtLedgerAuthority(p.account_uuid).resolveOwner(r.manager,String(p.sub));await r.commitTransaction();return{id:p.sub,account_uuid:p.account_uuid};}
  finally{try{if(r.isTransactionActive)await r.rollbackTransaction();}finally{await r.release();}}
 }
}
@Injectable()
export class FinanceJwtGuard extends AuthGuard('finance-jwt'){}
/** Called only by a separately approved issuer after migration and fresh identity lookup. */
export function financeSessionClaims(id:number,accountUuid:string){
 if(!Number.isInteger(id)||id<1||id>2147483647||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(accountUuid))throw Error('Verified account identity required');
 return{sub:id,account_uuid:accountUuid};
}
