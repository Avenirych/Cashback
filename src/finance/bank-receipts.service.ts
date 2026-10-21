import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { BANK_EVIDENCE_VERIFIER } from './bank-evidence-verifier';
import type { BankEvidenceVerifier, BankReceiptFacts } from './bank-evidence-verifier';
import { lockBankIdentity } from './evidence-locks';
import type { TransactionalBankEvidenceVerifier } from './bank-evidence-verifier';
import { FinanceEventsService } from './finance-events.service';
import { assertPence } from './money';
export interface RegisterBankReceiptCommand extends BankReceiptFacts {
 readonly evidenceReference:string;
 readonly bankAccountId:string;
 readonly unallocatedAccountId:string;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function bankScopeKey(sourceNamespace:string,accountScope:string):string { return sha([sourceNamespace,accountScope.toLowerCase()]); }
function timestamp(v:string):boolean { return typeof v==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v; }
@Injectable()
export class BankReceiptsService {
 constructor(private readonly dataSource:DataSource,private readonly events:FinanceEventsService,
  @Optional() @Inject(BANK_EVIDENCE_VERIFIER) private readonly verifier?:BankEvidenceVerifier) {}
 async registerWithManager(manager:EntityManager,input:RegisterBankReceiptCommand):Promise<{receiptId:string;lotId:string;journalId:string;eventId:string;replay:boolean}> {
  const runner=manager?.queryRunner;
  if(manager?.connection!==this.dataSource||!runner||runner.connection!==this.dataSource||runner.manager!==manager||runner.isReleased||!runner.isTransactionActive)throw new Error('Active receipt transaction manager required');
  if(!this.verifier)throw new Error('Trusted bank evidence verifier is not configured');
  const allowed=['sourceNamespace','accountScope','transactionId','currency','amountPence','receivedAt','evidenceReference','bankAccountId','unallocatedAccountId'];
  if(!input||typeof input!=='object'||Object.keys(input).length!==allowed.length||Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('Invalid receipt command fields');
  if(typeof input.sourceNamespace!=='string'||!/^[A-Za-z0-9:_-]{3,60}$/.test(input.sourceNamespace)||typeof input.transactionId!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(input.transactionId))throw new Error('Invalid bank transaction identity');
  for(const v of [input.accountScope,input.evidenceReference,input.bankAccountId,input.unallocatedAccountId])if(typeof v!=='string'||!uuid.test(v))throw new Error('Invalid opaque receipt reference');
  if(input.currency!=='GBP'||!timestamp(input.receivedAt))throw new Error('Invalid receipt currency/date');
  assertPence(input.amountPence);if(input.amountPence===0n)throw new Error('Receipt must be positive');
  const c={...input,accountScope:input.accountScope.toLowerCase(),evidenceReference:input.evidenceReference.toLowerCase(),bankAccountId:input.bankAccountId.toLowerCase(),unallocatedAccountId:input.unallocatedAccountId.toLowerCase()};
  const facts:BankReceiptFacts={sourceNamespace:c.sourceNamespace,accountScope:c.accountScope,transactionId:c.transactionId,currency:'GBP',amountPence:c.amountPence,receivedAt:c.receivedAt};
  // Same outer gate as evidence/coverage and policy21, before any bank identity
  // or account lock. Also safe when receipt recognition and repayment are composed.
  await manager.query('SELECT pg_advisory_xact_lock(726405,0)');
  const verifier=this.verifier as TransactionalBankEvidenceVerifier;
  if(typeof verifier.verifyWithManager!=='function'||typeof verifier.bindReceiptWithManager!=='function')throw new Error('Transactional verifier required; legacy fallback forbidden');
  await lockBankIdentity(manager,facts);
  const proof=await verifier.verifyWithManager(manager,c.evidenceReference,{...facts});
  if(!proof||proof.status!=='verified'||typeof proof.verificationId!=='string'||!uuid.test(proof.verificationId)||proof.evidenceReference!==c.evidenceReference||typeof proof.verifierReference!=='string'||!/^[A-Za-z0-9:_-]{3,60}$/.test(proof.verifierReference)||
   proof.sourceNamespace!==facts.sourceNamespace||proof.accountScope!==facts.accountScope||proof.transactionId!==facts.transactionId||proof.currency!=='GBP'||proof.amountPence!==facts.amountPence||proof.receivedAt!==facts.receivedAt)throw new Error('Bank evidence does not verify the claimed receipt');
  const identity=sha([c.sourceNamespace,c.accountScope,c.transactionId]),key='bank_receipt:'+identity;
  const materialHash=sha([c.sourceNamespace,c.accountScope,c.transactionId,c.currency,c.amountPence.toString(),c.receivedAt,c.bankAccountId,c.unallocatedAccountId]);
  await manager.query('SELECT pg_advisory_xact_lock(726403, hashtext($1))',[identity]);
  const prior=await manager.query('SELECT r.id,r."materialHash",r."journalId",r."eventId",l.id AS "lotId" FROM public.finance_bank_receipts r JOIN public.finance_funding_lots l ON l."receiptId"=r.id WHERE r."idempotencyKey"=$1',[key]);
  if(prior.length){if(prior[0].materialHash!==materialHash)throw new Error('Bank receipt data conflict');await verifier.bindReceiptWithManager(manager,proof,prior[0].id);return {receiptId:prior[0].id,lotId:prior[0].lotId,journalId:prior[0].journalId,eventId:prior[0].eventId,replay:true};}
  const accounts=await manager.query('SELECT id,kind,"accountKey",currency FROM public.finance_accounts WHERE id=ANY($1::uuid[]) ORDER BY id',[[c.bankAccountId,c.unallocatedAccountId].sort()]);
  const scope=bankScopeKey(c.sourceNamespace,c.accountScope);
  if(accounts.length!==2||!accounts.some((a:{id:string;kind:string;accountKey:string;currency:string})=>a.id===c.bankAccountId&&a.kind==='company_bank_cash'&&a.accountKey==='bank_cash:'+scope&&a.currency==='GBP')||
   !accounts.some((a:{id:string;kind:string;accountKey:string;currency:string})=>a.id===c.unallocatedAccountId&&a.kind==='unallocated_received_funds'&&a.accountKey==='bank_unallocated:'+scope&&a.currency==='GBP'))throw new Error('Receipt accounts do not match bank source scope');
  const receiptId=randomUUID(),lotId=randomUUID();
  const journal=await this.events.postEventWithManager(manager,{type:'finance.journal.posted',schemaVersion:1,eventId:receiptId,idempotencyKey:key,operationId:receiptId,createdAt:new Date().toISOString(),data:{currency:'GBP'}},[
   {accountId:c.bankAccountId,side:'debit',amount:c.amountPence},{accountId:c.unallocatedAccountId,side:'credit',amount:c.amountPence}]);
  await manager.query('INSERT INTO public.finance_bank_receipts(id,"sourceNamespace","accountScope","transactionId","idempotencyKey","materialHash",currency,"amountPence","receivedAt","verificationId","evidenceReference","verifierReference","verificationStatus","journalId","eventId","bankAccountId","unallocatedAccountId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',[receiptId,c.sourceNamespace,c.accountScope,c.transactionId,key,materialHash,'GBP',c.amountPence.toString(),c.receivedAt,proof.verificationId.toLowerCase(),c.evidenceReference,proof.verifierReference,'verified',journal.journalId,journal.eventId,c.bankAccountId,c.unallocatedAccountId]);
  await manager.query('INSERT INTO public.finance_funding_lots(id,"receiptId",currency,"amountPence",status,purpose) VALUES($1,$2,$3,$4,$5,$6)',[lotId,receiptId,'GBP',c.amountPence.toString(),'restricted','awaiting_classification']);
  await verifier.bindReceiptWithManager(manager,proof,receiptId);
  return {receiptId,lotId,journalId:journal.journalId,eventId:journal.eventId,replay:false};
 }
}
