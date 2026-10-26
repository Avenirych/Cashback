import {formatResearchBonus} from './researchBonusText';

test.each([[1,'до 1 бонуса'],[2,'до 2 бонусов'],[5,'до 5 бонусов'],[11,'до 11 бонусов'],[21,'до 21 бонуса'],[22,'до 22 бонусов'],[31,'до 31 бонуса'],[41,'до 41 бонуса'],[50,'до 50 бонусов']] as const)('Russian genitive for an upper bound %s',(value,text)=>{
 expect(formatResearchBonus(value,'RU')).toBe(text);
});
test.each([['EN',1,'up to 1 bonus'],['EN',2,'up to 2 bonuses'],['DE',1,'bis zu 1 Bonus'],['DE',2,'bis zu 2 Boni'],['FR',1,'jusqu’à 1 bonus'],['FR',2,'jusqu’à 2 bonus']] as const)('%s correctly labels %s bonus units',(lang,value,text)=>{
 expect(formatResearchBonus(value,lang)).toBe(text);
});
test.each([['RU','от 5 до 21 бонуса'],['EN','from 5 to 21 bonuses'],['DE','von 5 bis 21 Boni'],['FR','de 5 à 21 bonus']] as const)('%s preserves both bounds without modifying the source',(lang,text)=>{
 const value=Object.freeze({min:5,max:21});expect(formatResearchBonus(value,lang)).toBe(text);expect(value).toEqual({min:5,max:21});
});
test('equal bounds have one correctly inflected value',()=>expect(formatResearchBonus({min:21,max:21},'RU')).toBe('до 21 бонуса'));
