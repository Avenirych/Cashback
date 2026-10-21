import { createHash } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';

export interface ClickEvidence {
  clickId: string; buyerReference: string; partnerReference: string; offerReference: string;
}
export interface OrderEvidence extends ClickEvidence { sourceNamespace: string; orderId: string }
/** Production adapter must resolve authenticated actor, ownership and source facts.
 * Caller-provided IDs or role strings are not proof. No active adapter is supplied.
 */
export interface PurchaseLinkageAuthority {
  verifyClick(manager: EntityManager, principal: string, proofReference: string): Promise<ClickEvidence>;
  verifyOrder(manager: EntityManager, principal: string, proofReference: string): Promise<OrderEvidence>;
}
export class DisabledPurchaseLinkageAuthority implements PurchaseLinkageAuthority {
  async verifyClick(): Promise<never> { throw new Error('PURCHASE_AUTHORITY_NOT_CONFIGURED'); }
  async verifyOrder(): Promise<never> { throw new Error('PURCHASE_AUTHORITY_NOT_CONFIGURED'); }
}
/** Internal evidence linkage only. No redirect, reservation, pricing or money movement.
 * All writes join the caller transaction. No public endpoint or automatic caller.
 */
export class PurchaseLinkageService {
  constructor(private readonly source: DataSource, private readonly authority: PurchaseLinkageAuthority = new DisabledPurchaseLinkageAuthority()) {}
  private assertManager(manager: EntityManager) {
    const runner=manager?.queryRunner;
    if(manager?.connection!==this.source||!runner||runner.connection!==this.source||runner.manager!==manager||runner.isReleased||!runner.isTransactionActive)
      throw new Error('Active caller transaction required');
  }
  private validate(facts: ClickEvidence) {
    for(const value of [facts.clickId,facts.buyerReference,facts.partnerReference,facts.offerReference])
      if(typeof value!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(value))throw new Error('Invalid trusted linkage identity');
  }
  async recordClickWithManager(manager: EntityManager, principal: string, proofReference: string) {
    this.assertManager(manager);
    const facts={...(await this.authority.verifyClick(manager,principal,proofReference))};this.validate(facts);
    const hash=createHash('sha256').update(JSON.stringify([facts.clickId,facts.buyerReference,facts.partnerReference,facts.offerReference])).digest('hex');
    await manager.query('INSERT INTO public.finance_purchase_clicks(id,"buyerReference","partnerReference","offerReference","materialHash") VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[facts.clickId,facts.buyerReference,facts.partnerReference,facts.offerReference,hash]);
    const rows=await manager.query('SELECT "materialHash" FROM public.finance_purchase_clicks WHERE id=$1 FOR UPDATE',[facts.clickId]) as {materialHash:string}[];
    if(rows.length!==1||rows[0].materialHash!==hash)throw new Error('CLICK_IDENTITY_CONFLICT');
    return {clickId:facts.clickId,moneyMovedPence:0n};
  }
  async recordOrderWithManager(manager: EntityManager, principal: string, proofReference: string) {
    this.assertManager(manager);
    const facts={...(await this.authority.verifyOrder(manager,principal,proofReference))};this.validate(facts);
    if(!/^[A-Za-z0-9:_-]{1,160}$/.test(facts.sourceNamespace)||!/^[A-Za-z0-9:_-]{1,160}$/.test(facts.orderId))throw new Error('Invalid trusted order identity');
    const clicks=await manager.query('SELECT "buyerReference","partnerReference","offerReference" FROM public.finance_purchase_clicks WHERE id=$1 FOR UPDATE',[facts.clickId]) as ClickEvidence[];
    if(clicks.length!==1||clicks[0].buyerReference!==facts.buyerReference||clicks[0].partnerReference!==facts.partnerReference||clicks[0].offerReference!==facts.offerReference)throw new Error('ORDER_CLICK_OWNER_MISMATCH');
    await manager.query('INSERT INTO public.finance_purchase_orders("sourceNamespace","orderId","clickId",state) VALUES($1,$2,$3,$4) ON CONFLICT("sourceNamespace","orderId") DO NOTHING',[facts.sourceNamespace,facts.orderId,facts.clickId,'pending_review']);
    const rows=await manager.query('SELECT "clickId" FROM public.finance_purchase_orders WHERE "sourceNamespace"=$1 AND "orderId"=$2 FOR UPDATE',[facts.sourceNamespace,facts.orderId]) as {clickId:string}[];
    if(rows.length!==1||rows[0].clickId!==facts.clickId)throw new Error('ORDER_IDENTITY_CONFLICT');
    return {clickId:facts.clickId,orderId:facts.orderId,state:'pending_review' as const,moneyMovedPence:0n};
  }
}
