/** Owner-approved 28 October rules. Internal only; no public command or activation. */
import {policyPence,sixMonthsUtc,utc} from './owner-policy';
export const BONUS_USE_RULES='BONUS_APPLICATION_2026_10_28';
export type ApplicationWindow={version:typeof BONUS_USE_RULES; startedAt:string; until:string; basis:'receipt'|'transfer'; reference:string};
export function applicationWindow(startedAt:string,basis:ApplicationWindow['basis'],reference:string):ApplicationWindow{
 utc(startedAt);if(!reference)throw Error('Trusted receipt/transfer reference required');
 return {version:BONUS_USE_RULES,startedAt,until:sixMonthsUtc(startedAt),basis,reference};
}
export function canApply(window:ApplicationWindow,now:string){
 if(window.version!==BONUS_USE_RULES||window.until!==sixMonthsUtc(window.startedAt))throw Error('Invalid application terms');
 return utc(now)>=utc(window.startedAt)&&utc(now)<utc(window.until);
}
/** One hundredth of a bonus = one GBP penny ONLY for purchase valuation.
 * Monetary liability is supplied separately by the existing funded ledger. */
export function bonusUnits(value:string):bigint{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(value))throw Error('Exact bonus units required');
 const [whole,fraction='']=value.split('.');return policyPence(BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')));
}
export function unitsText(hundredths:bigint){policyPence(hundredths);return (hundredths/100n)+'.'+(hundredths%100n).toString().padStart(2,'0');}
export function purchaseCap(price:bigint,cashback:bigint,merchantCap:bigint){
 [price,cashback,merchantCap].forEach(policyPence);
 if(cashback>price)return {status:'pending_review' as const,reason:'CASHBACK_EXCEEDS_PRODUCT_PRICE'};
 return {status:'ready' as const,cap:price-cashback<merchantCap?price-cashback:merchantCap};
}
export function bonusView(units:bigint,payable:bigint,window:ApplicationWindow,now:string){
 policyPence(units);policyPence(payable);
 return {bonusUnits:unitsText(units),applicationValuePence:units.toString(),payablePence:payable.toString(),
 canApplyToPurchase:canApply(window,now),applicationUntil:window.until};
}
