import {BadRequestException} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
/** Shared by normal account registration/login and the explicitly authorized staging operator. */
export async function hashAccountPassword(password:string){
 if(typeof password!=='string'||password.length<8||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password)||!/[^A-Za-z0-9]/.test(password))throw new BadRequestException('Password must contain at least 8 characters, an uppercase letter, a lowercase letter, a digit, and a special character');
 if(Buffer.byteLength(password,'utf8')>72)throw new BadRequestException('Password must not exceed 72 UTF-8 bytes');
 return bcrypt.hash(password,10);
}
export const verifyAccountPassword=(password:string,hash:string)=>bcrypt.compare(password,hash);
