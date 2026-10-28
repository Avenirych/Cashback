import {ForbiddenException,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import type {EntityManager} from 'typeorm';
import type {BonusSnapshotAuthority} from './bonus-use-snapshot';
export class JwtLedgerAuthority implements BonusSnapshotAuthority {
 constructor(private readonly expectedUuid?:string){}
 async resolveOwner(m:EntityManager,principal:string):Promise<string>{
  if(!/^[1-9][0-9]{0,9}$/.test(principal)||BigInt(principal)>2147483647n)throw new UnauthorizedException();
  const rows=await m.query('SELECT id,email_verified,account_uuid FROM public.users WHERE id=$1',[principal]);
  if(rows.length===0)throw new UnauthorizedException();
  if(rows.length!==1)throw new ServiceUnavailableException('Ledger identity unavailable');
  if(rows[0].email_verified!==true)throw new ForbiddenException('Verified email required');
  const uuid=rows[0].account_uuid;
  if(typeof uuid!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(uuid))throw new ServiceUnavailableException('Ledger identity unavailable');
  if(this.expectedUuid!==undefined && this.expectedUuid!==uuid)throw new UnauthorizedException('Finance session identity changed');
  return 'cb:user:'+uuid;
 }
}
