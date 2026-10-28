import {ServiceUnavailableException} from '@nestjs/common';
import type {User} from './user.entity';
/** Server-only row evidence. Never read account_uuid from a DTO or entity property. */
const identities=new WeakMap<User,{id:number;uuid:string|null}>();
export function validAccountUuid(value:unknown):value is string {
 return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
/** Called exclusively for the same SELECT/INSERT RETURNING/UPDATE RETURNING row. */
export function rememberServerIdentity(user:User,uuid:unknown):User {
 if(!Number.isInteger(user.id)||user.id<1||user.id>2147483647||uuid!=null&&!validAccountUuid(uuid))throw new ServiceUnavailableException('Account identity unavailable');
 identities.set(user,{id:user.id,uuid:uuid==null?null:uuid});return user;
}
export function serverAccountUuid(user:User):string|null|undefined {
 const saved=identities.get(user);
 if(saved&&saved.id!==user.id)throw new ServiceUnavailableException('Account identity unavailable');
 return saved?.uuid;
}
