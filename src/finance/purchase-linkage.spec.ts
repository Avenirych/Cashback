import {PurchaseLinkageService} from './purchase-linkage';
import type {PurchaseLinkageAuthority,OrderEvidence} from './purchase-linkage';
import type {DataSource,EntityManager} from 'typeorm';
const facts:OrderEvidence={clickId:'click:1',buyerReference:'buyer:1',partnerReference:'partner:1',offerReference:'offer:1',sourceNamespace:'synthetic:test',orderId:'order:1'};
function setup(){
  const source={} as DataSource;let click:Record<string,unknown>|undefined;const orders=new Map<string,string>();let current={...facts};
  const query=jest.fn(async(sql:string,p:unknown[]=[])=>{
    if(sql.startsWith('INSERT INTO public.finance_purchase_clicks')&&!click)click={buyerReference:p[1],partnerReference:p[2],offerReference:p[3],materialHash:p[4]};
    if(sql.startsWith('SELECT "materialHash"'))return click?[click]:[];
    if(sql.startsWith('SELECT "buyerReference"'))return click?[click]:[];
    if(sql.startsWith('INSERT INTO public.finance_purchase_orders')&&!orders.has(String(p[1])))orders.set(String(p[1]),String(p[2]));
    if(sql.startsWith('SELECT "clickId"'))return orders.has(String(p[1]))?[{clickId:orders.get(String(p[1]))}]:[];
    return [];
  });
  const manager={connection:source,query} as unknown as EntityManager;Object.assign(manager,{queryRunner:{connection:source,manager,isReleased:false,isTransactionActive:true}});
  const authority:PurchaseLinkageAuthority={verifyClick:async()=>({...current}),verifyOrder:async()=>({...current})};
  return {source,manager,query,orders,service:new PurchaseLinkageService(source,authority),change:(patch:Partial<OrderEvidence>)=>{current={...current,...patch}}};
}
test('production default authority rejects before SQL',async()=>{const h=setup();await expect(new PurchaseLinkageService(h.source).recordClickWithManager(h.manager,'caller','proof')).rejects.toThrow('AUTHORITY_NOT_CONFIGURED');expect(h.query).not.toHaveBeenCalled();});
test('trusted click can link one or multiple stable partner orders without creating money',async()=>{
  const h=setup();await h.service.recordClickWithManager(h.manager,'caller','proof');
  expect(await h.service.recordOrderWithManager(h.manager,'caller','proof')).toMatchObject({state:'pending_review',moneyMovedPence:0n});
  h.change({orderId:'order:2'});await h.service.recordOrderWithManager(h.manager,'caller','proof');expect(h.orders.size).toBe(2);
  await h.service.recordOrderWithManager(h.manager,'caller','proof');expect(h.orders.size).toBe(2);
  expect(h.query.mock.calls.some(([sql])=>/finance_postings|finance_journals/.test(sql))).toBe(false);
});
test('click identity cannot be reused for another buyer and order ownership is enforced',async()=>{
  const h=setup();await h.service.recordClickWithManager(h.manager,'caller','proof');h.change({buyerReference:'buyer:2'});
  await expect(h.service.recordClickWithManager(h.manager,'caller','proof')).rejects.toThrow('CONFLICT');
  await expect(h.service.recordOrderWithManager(h.manager,'caller','proof')).rejects.toThrow('OWNER_MISMATCH');
});
test('foreign/inactive transaction cannot perform linkage',async()=>{const h=setup();await expect(h.service.recordClickWithManager({} as EntityManager,'caller','proof')).rejects.toThrow('Active caller');expect(h.query).not.toHaveBeenCalled();});
