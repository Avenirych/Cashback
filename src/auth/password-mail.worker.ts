import {Injectable,OnModuleInit,OnModuleDestroy} from '@nestjs/common';
import {PasswordSecurityService} from './password-security.service';
/** One in-flight job in the existing backend; no child process or secret-bearing queue payload. */
@Injectable()
export class PasswordMailWorker implements OnModuleInit,OnModuleDestroy{
 private timer:NodeJS.Timeout|undefined;private running:Promise<void>|null=null;private stopped=false;private ticks=0;
 constructor(private readonly passwords:PasswordSecurityService){}
 async onModuleInit(){await this.passwords.initialize();this.timer=setInterval(()=>this.tick(),5000);this.timer.unref();}
 private tick(){if(this.stopped||this.running)return;this.running=(async()=>{try{if(++this.ticks%12===1)await this.passwords.cleanup();await this.passwords.processOne();}catch{/* Generic job state only; never log a mail capability or raw driver/SMTP exception. */}})().finally(()=>{this.running=null;});}
 async onModuleDestroy(){this.stopped=true;if(this.timer)clearInterval(this.timer);try{await this.running;}finally{this.passwords.close();}}
}
