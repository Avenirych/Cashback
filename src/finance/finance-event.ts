/** Internal ledger fact only. Not a bank/payout command. */
export interface JournalPostedEventV1 {
  readonly type: 'finance.journal.posted';
  readonly schemaVersion: 1;
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly operationId: string;
  readonly createdAt: string;
  readonly data: { readonly currency: 'GBP' };
}
export type FinancialEvent = JournalPostedEventV1;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function snapshotFinancialEvent(input: FinancialEvent): FinancialEvent {
  const keys = ['type','schemaVersion','eventId','idempotencyKey','operationId','createdAt','data'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== keys.length || Object.keys(input).some(k=>!keys.includes(k))) throw new Error('Invalid financial event fields');
  if (input.type !== 'finance.journal.posted' || input.schemaVersion !== 1) throw new Error('Unsupported financial event type/version');
  if (typeof input.eventId !== 'string' || !uuid.test(input.eventId) || typeof input.operationId !== 'string' || !uuid.test(input.operationId)) throw new Error('Invalid event identity');
  if (typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9:_-]{8,160}$/.test(input.idempotencyKey)) throw new Error('Invalid event idempotency key');
  if (typeof input.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.createdAt) || !Number.isFinite(Date.parse(input.createdAt)) || new Date(input.createdAt).toISOString() !== input.createdAt) throw new Error('Invalid event timestamp');
  if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data) || Object.keys(input.data).length !== 1 || Object.keys(input.data)[0] !== 'currency' || input.data.currency !== 'GBP') throw new Error('Invalid event data');
  return { type:input.type,schemaVersion:1,eventId:input.eventId.toLowerCase(),idempotencyKey:input.idempotencyKey,operationId:input.operationId.toLowerCase(),createdAt:input.createdAt,data:{currency:'GBP'} };
}
