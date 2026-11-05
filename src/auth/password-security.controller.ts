import {Body,Controller,Header,HttpCode,Post,Req,UseGuards,BadRequestException} from '@nestjs/common';
import {JwtAuthGuard} from './jwt-auth.guard';
import {NonFinancialMutation} from '../financial-write-deny';
import {PasswordSecurityService} from './password-security.service';
interface Request{socket?:{remoteAddress?:string};user:{id:number;sv:number;account_uuid?:string}}
function body(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k))||Buffer.byteLength(JSON.stringify(value),'utf8')>8192)throw new BadRequestException('Invalid password request');
 return value as Record<string,unknown>;
}
const source=(r:Request)=>(r.socket?.remoteAddress||'unknown').slice(0,128);
@Controller('auth')
export class PasswordSecurityController{
 constructor(private readonly passwords:PasswordSecurityService){}
 @Post('password-reset/request') @NonFinancialMutation() @HttpCode(202) @Header('Cache-Control','no-store')
 request(@Body() value:unknown,@Req() r:Request){const b=body(value,['email','locale']);return this.passwords.request(b.email,b.locale,source(r));}
 @Post('password-reset/confirm') @NonFinancialMutation() @HttpCode(204) @Header('Cache-Control','no-store')
 async confirm(@Body() value:unknown,@Req() r:Request):Promise<void>{const b=body(value,['token','newPassword']);await this.passwords.confirm(b.token,b.newPassword,source(r));}
 @Post('password/change') @NonFinancialMutation() @UseGuards(JwtAuthGuard) @HttpCode(204) @Header('Cache-Control','no-store')
 async change(@Body() value:unknown,@Req() r:Request):Promise<void>{const b=body(value,['currentPassword','newPassword','locale']);await this.passwords.change(r.user,b.currentPassword,b.newPassword,b.locale,source(r));}
}
