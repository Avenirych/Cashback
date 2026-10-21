import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import { FinanceService } from './finance.service';
import { snapshotFinancialEvent } from './finance-event';
import type { FinancialEvent } from './finance-event';
import type { Posting } from './ledger';
@Injectable()
export class FinanceEventsService {
 constructor(private readonly finance: FinanceService) {}
 /** All results provisional until caller commit; errors must abort caller command. */
 async postEventWithManager(manager: EntityManager, input: FinancialEvent, postings: readonly Posting[]): Promise<{journalId:string;eventId:string;replay:boolean}> {
  const event = snapshotFinancialEvent(input);
  const lines = postings.map(line => ({ ...line }));
  const hash = createHash('sha256').update(JSON.stringify(event)).digest('hex');
  // Existing ledger lock spans both ledger and outbox insertion in the caller transaction.
  const journal = await this.finance.postWithManager(manager,event.idempotencyKey,lines);
  const previous = await manager.query('SELECT "eventId","journalId","envelopeHash" FROM public.finance_outbox WHERE "idempotencyKey"=$1',[event.idempotencyKey]);
  if (previous.length) {
   if (!journal.replay || previous[0].journalId!==journal.journalId || previous[0].envelopeHash!==hash || previous[0].eventId!==event.eventId) throw new Error('Financial event envelope conflict');
   return {...journal,eventId:previous[0].eventId};
  }
  // Do not retrofit facts onto a previous legacy/plain post under the same key.
  if (journal.replay) throw new Error('Journal already exists without this financial event');
  const payload={currency:'GBP',journalId:journal.journalId,postingCount:lines.length};
  await manager.query('INSERT INTO public.finance_outbox("eventId",type,"schemaVersion","idempotencyKey","operationId","journalId","createdAt","envelopeHash",payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',[event.eventId,event.type,event.schemaVersion,event.idempotencyKey,event.operationId,journal.journalId,event.createdAt,hash,JSON.stringify(payload)]);
  return {...journal,eventId:event.eventId};
 }
}
