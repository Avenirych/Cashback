/** Internal planning primitives, not authorization or money movement.
 * No public endpoint/worker calls these. A future trusted orchestrator must read
 * facts and execute postings in ONE locked transaction; caller booleans are not proof.
 */
import { assertPence, splitRevenue } from './money';
import type { RevenueKind } from './money';

export type Decision<T> = { status: 'ready'; plan: T } | { status: 'blocked'; reason: string };
export interface RevenueFacts {
  kind: RevenueKind;
  confirmed: boolean;
  /** Trusted policy result, never a public client assertion. */
  finality: 'satisfied' | 'pending' | 'unknown';
  receivedPence: bigint;
  commissionPence: bigint;
  costsPence: bigint | null;
  bankingFeesPence: bigint | null;
  transferExpensesPence: bigint | null;
  otherCostsPence: bigint | null;
  feeCoveragePence: bigint;
  customerCoveragePence: bigint;
  budgetApproved: boolean;
}
/** A confirmation alone never makes cashback available. Funds are not all profit. */
export function planRevenue(facts: RevenueFacts): Decision<{
  received: bigint; customerLiability: bigint; platformShare: bigint;
  expenses: bigint; bankingFees: bigint; transferExpenses: bigint; otherCosts: bigint; platformNetIncome: bigint;
}> {
  for (const amount of [facts.receivedPence, facts.commissionPence,
    facts.feeCoveragePence, facts.customerCoveragePence]) assertPence(amount);
  if (facts.costsPence !== null) assertPence(facts.costsPence);
  for (const cost of [facts.bankingFeesPence, facts.transferExpensesPence, facts.otherCostsPence]) if (cost !== null && cost !== undefined) assertPence(cost);
  if (!facts.confirmed) return { status: 'blocked', reason: 'PARTNER_CONFIRMATION_REQUIRED' };
  if (facts.finality !== 'satisfied') return { status: 'blocked', reason: 'REFUND_FINALITY_REQUIRED' };
  if (facts.commissionPence === 0n || facts.receivedPence !== facts.commissionPence)
    return { status: 'blocked', reason: 'EXACT_RECEIPT_ALLOCATION_REQUIRED' };
  if (facts.costsPence === null) return { status: 'blocked', reason: 'COSTS_UNKNOWN' };
  if (facts.bankingFeesPence == null || facts.transferExpensesPence == null || facts.otherCostsPence == null)
    return { status: 'blocked', reason: 'EXPENSE_BREAKDOWN_REQUIRED' };
  if (facts.bankingFeesPence + facts.transferExpensesPence + facts.otherCostsPence !== facts.costsPence)
    return { status: 'blocked', reason: 'EXPENSE_RECONCILIATION_REQUIRED' };
  const split = splitRevenue(facts.commissionPence, facts.kind);
  if (split.platform <= facts.costsPence) return { status: 'blocked', reason: 'NET_MARGIN_NOT_POSITIVE' };
  if (!facts.budgetApproved || facts.feeCoveragePence < facts.costsPence || facts.customerCoveragePence < split.user)
    return { status: 'blocked', reason: 'COVERAGE_OR_BUDGET_REQUIRED' };
  return { status: 'ready', plan: { received: split.total, customerLiability: split.user,
    platformShare: split.platform, expenses: facts.costsPence, bankingFees: facts.bankingFeesPence,
    transferExpenses: facts.transferExpensesPence, otherCosts: facts.otherCostsPence,
    platformNetIncome: split.platform - facts.costsPence } };
}

export interface ConfirmedSource {
  id: string;
  ownerId: string;
  confirmed: boolean;
  availablePence: bigint;
  actualFundsPence: bigint;
  protectedReservation: boolean;
}
/** Sources have an explicitly ordered input, not a guessed business priority.
 * No expiry, platform cut, unrelated-person seizure or negative balance is introduced.
 */
export function planDebtCollection(debtorId: string, outstanding: bigint, sources: readonly ConfirmedSource[]) {
  assertPence(outstanding);
  if (!debtorId) throw new Error('Debtor identity required');
  const seen = new Set<string>();
  let remaining = outstanding;
  const allocations: { sourceId: string; amountPence: bigint }[] = [];
  for (const source of sources) {
    if (!source.id || seen.has(source.id)) throw new Error('Duplicate or missing source identity');
    seen.add(source.id);
    assertPence(source.availablePence); assertPence(source.actualFundsPence);
    if (source.ownerId !== debtorId || !source.confirmed || source.protectedReservation) continue;
    const available = source.availablePence < source.actualFundsPence ? source.availablePence : source.actualFundsPence;
    const amount = available < remaining ? available : remaining;
    if (amount > 0n) allocations.push({ sourceId: source.id, amountPence: amount });
    remaining -= amount;
  }
  return { allocations, collectedPence: outstanding - remaining, outstandingPence: remaining };
}

export interface OrderCandidate { id: string; eligible: boolean; comparableCostPence: bigint }
/** Q13 finality/metric/ties require a trusted approved policy. Never guess them. */
export function selectBonusOrder(orders: readonly OrderCandidate[], policy: {
  metricApproved: boolean; groupFinal: boolean;
}): Decision<{ orderId: string }> {
  if (!policy.metricApproved || !policy.groupFinal) return { status: 'blocked', reason: 'ORDER_POLICY_OR_FINALITY_UNRESOLVED' };
  const ids = new Set<string>();
  let highest: OrderCandidate | undefined;
  let tie = false;
  for (const order of orders) {
    if (!order.id || ids.has(order.id)) throw new Error('Duplicate or missing order identity');
    ids.add(order.id); assertPence(order.comparableCostPence);
    if (!order.eligible) continue;
    if (!highest || order.comparableCostPence > highest.comparableCostPence) { highest = order; tie = false; }
    else if (order.comparableCostPence === highest.comparableCostPence) tie = true;
  }
  if (!highest || tie) return { status: 'blocked', reason: tie ? 'TIE_POLICY_UNRESOLVED' : 'NO_ELIGIBLE_ORDER' };
  return { status: 'ready', plan: { orderId: highest.id } };
}

/** Recording a request/review is NOT applying a refund, cancellation or chargeback. */
export function unresolvedAdjustment(kind: 'full_refund' | 'partial_refund' | 'cancellation') {
  return { status: 'blocked' as const, kind, reason: 'LIABILITY_AND_TRANSITION_POLICY_REQUIRED', moneyMovedPence: 0n };
}
