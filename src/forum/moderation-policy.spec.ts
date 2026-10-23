import {calendarMonths,moderationSignals,restriction} from './moderation-policy';
import {ForumService} from './forum.service';
import {ContentModerationService} from './content-moderation.service';

test.each([
  ['2027-01-31T12:15:00Z',1,'2027-02-28T12:15:00.000Z'],
  ['2028-01-31T12:15:00Z',1,'2028-02-29T12:15:00.000Z'],
  ['2026-10-31T12:15:00Z',6,'2027-04-30T12:15:00.000Z'],
])('calendar sanction end %s plus %s months', (start,months,end)=>{
  expect(calendarMonths(new Date(start),Number(months)).toISOString()).toBe(end);
});
test('four confirmed levels, exact automatic expiry and reversal recalculation',()=>{
  const dates=[new Date('2026-10-01'),new Date('2026-10-02'),new Date('2026-10-03'),new Date('2026-10-04')];
  const now=new Date('2026-10-10');
  expect(restriction(dates.slice(0,1),now)).toMatchObject({level:1,blocked:false,until:null});
  expect(restriction(dates.slice(0,2),now).until?.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  expect(restriction(dates.slice(0,3),now).until?.toISOString()).toBe('2027-04-03T00:00:00.000Z');
  expect(restriction(dates,now)).toEqual({level:4,blocked:true,until:null});
  expect(restriction(dates.slice(0,2),new Date('2026-11-02'))).toMatchObject({level:2,blocked:false});
  expect(restriction(dates.filter((_,i)=>i!==3),now).level).toBe(3);
});
test.each(['I will kill you','я тебя убью','Ich werde dich töten','Je vais te tuer','Я тебя убью; I will kill you'])('threat signal queues mixed-language material: %s',value=>{
  expect(moderationSignals(value)).toContain('possible-direct-threat');
});
test.each(['The service disappointed me.','Мне не понравился сервис.','Der Service war enttäuschend.','Le service m’a déçu.','I disagree with this decision and oppose hateful speech.'])('criticism and disagreement are not automatic violations: %s',value=>{
  expect(moderationSignals(value)).toEqual(['human-context-review']);
});
test('structural credential/disclosure signals have no automatic sanction',()=>{
  expect(moderationSignals('password: synthetic-secret')).toContain('possible-credentials');
  expect(moderationSignals('contact@example.invalid')).toContain('possible-personal-data');
  expect(restriction([])).toEqual({level:0,blocked:false,until:null});
});
test('installed moderation schema never falls back to unfiltered legacy reads when flag disabled',async()=>{
  const old=process.env.CASHBACK_CONTENT_MODERATION;delete process.env.CASHBACK_CONTENT_MODERATION;
  try{
    const topics={find:jest.fn()},mod={installed:jest.fn().mockResolvedValue(true),read:jest.fn().mockResolvedValue([]),submit:jest.fn().mockRejectedValue(new Error('Disabled'))};
    const service=new ForumService(topics as never,{} as never,{} as never,mod as unknown as ContentModerationService);
    expect(await service.getTopics()).toEqual([]);expect(topics.find).not.toHaveBeenCalled();
    await expect(service.createTopic(1,'Title')).rejects.toThrow('Disabled');
    expect(mod.submit).toHaveBeenCalled();
  }finally{if(old===undefined)delete process.env.CASHBACK_CONTENT_MODERATION;else process.env.CASHBACK_CONTENT_MODERATION=old;}
});
