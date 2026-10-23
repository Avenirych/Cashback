import {ContentModerationService} from './content-moderation.service';
import {ServiceUnavailableException,BadRequestException} from '@nestjs/common';
describe('moderation readiness fails closed',()=>{
 const original=process.env.CASHBACK_CONTENT_MODERATION;
 afterEach(()=>{if(original===undefined)delete process.env.CASHBACK_CONTENT_MODERATION;else process.env.CASHBACK_CONTENT_MODERATION=original;});
 test('database readiness lookup failure cannot use legacy unfiltered reads',async()=>{const s=new ContentModerationService({query:jest.fn().mockRejectedValue(Error('private database detail'))} as any);process.env.CASHBACK_CONTENT_MODERATION='false';await expect(s.installed()).rejects.toThrow(ServiceUnavailableException);await expect(s.read('reviews')).rejects.toThrow('Cannot establish moderation readiness');});
 test('flag disabled never starts a write transaction',async()=>{const transaction=jest.fn();const s=new ContentModerationService({transaction} as any);process.env.CASHBACK_CONTENT_MODERATION='false';await expect(s.acceptRules(1,true)).rejects.toThrow(ServiceUnavailableException);expect(transaction).not.toHaveBeenCalled();});
 test('reviews cannot omit personal experience declaration or use an invalid rating',async()=>{const transaction=jest.fn();const s=new ContentModerationService({transaction} as any);await expect(s.submit(1,'review',{title:'Review',body:'Actual personal experience content',rating:5})).rejects.toThrow(BadRequestException);await expect(s.submit(1,'review',{title:'Review',body:'Actual personal experience content',rating:6,experienceConfirmed:true})).rejects.toThrow(BadRequestException);expect(transaction).not.toHaveBeenCalled();});
});
