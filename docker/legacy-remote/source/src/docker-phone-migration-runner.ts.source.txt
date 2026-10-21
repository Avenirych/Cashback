import type { DataSource, QueryRunner } from 'typeorm';
import { createPhoneMigrationDataSource } from './docker-phone-migration-data-source';
import { inspectPhoneDatabase, PHONE_MIGRATION, PHONE_TIMESTAMP, requirePhoneApproval, validatePhoneFacts } from './docker-phone-migration-preflight';
import type { PhoneApproval } from './docker-phone-migration-preflight';
import { AddUserPhoneAndSmsConsent1792195200000 } from './migrations/1792195200000-AddUserPhoneAndSmsConsent';

export interface PhoneRunResult {
  status: 'PASS' | 'BLOCKED';
  reason: 'PREFLIGHT_PASSED' | 'APPLIED' | 'INVALID_MODE' | 'AUTHORIZATION_REQUIRED' |
    'OPERATION_FAILED' | 'COMMIT_OUTCOME_UNKNOWN' | 'CLEANUP_UNCONFIRMED' | 'CONCURRENCY_UNVERIFIED';
}

// Table locks alone do not freeze views, rules, sequence parameters, ACLs or role changes.
// Source/mock validation is insufficient to open this gate. No runtime B/C approval exists.
export const PHONE_APPLY_CONCURRENCY_VERIFIED: boolean = false;
class PhoneConcurrencyUnverified extends Error {}

/** Separate helper permits mock validation of uncertain commit acknowledgement, without
 * bypassing the apply gate or invoking migrations. No retry/rollback can establish non-commit.
 */
export async function commitPhoneTransaction(q: QueryRunner): Promise<PhoneRunResult> {
  try { await q.commitTransaction(); return { status: 'PASS', reason: 'APPLIED' }; }
  catch { return { status: 'BLOCKED', reason: 'COMMIT_OUTCOME_UNKNOWN' }; }
}

/** Source implementation only. No CLI entry point or environment-based authorization.
 * A future trusted caller must supply a separately owner-approved B/C receipt and credential.
 * A caller-created object is NOT evidence of owner approval; it belongs to the trusted code boundary.
 */
export async function runPhoneMigration(
  mode: string, approval: PhoneApproval | null = null, password = '',
): Promise<PhoneRunResult> {
  if (mode !== 'preflight' && mode !== 'apply') return { status: 'BLOCKED', reason: 'INVALID_MODE' };
  // Copy before the first await: authorization cannot change midway through a run.
  let receipt: PhoneApproval | null = null;
  try {
    receipt = approval ? { ...approval, target: { ...approval.target },
      beforeObjects: approval.beforeObjects.map(k => ({ ...k })),
      afterObjects: approval.afterObjects.map(k => ({ ...k })) } : null;
  } catch { return { status: 'BLOCKED', reason: 'AUTHORIZATION_REQUIRED' }; }
  try { requirePhoneApproval(receipt, mode); }
  catch { return { status: 'BLOCKED', reason: 'AUTHORIZATION_REQUIRED' }; }
  let ds: DataSource | undefined;
  let q: QueryRunner | undefined;
  let initializing = false;
  let result: PhoneRunResult = { status: 'BLOCKED', reason: 'OPERATION_FAILED' };
  try {
    ds = createPhoneMigrationDataSource(receipt.target, password);
    initializing = true;
    await ds.initialize();
    initializing = false;
    q = ds.createQueryRunner();
    await q.connect();
    await q.startTransaction(mode === 'apply' ? 'READ COMMITTED' : 'REPEATABLE READ');
    if (mode === 'preflight') await q.query('SET TRANSACTION READ ONLY');
    await q.query("SET LOCAL statement_timeout = '10s'");
    await q.query("SET LOCAL lock_timeout = '3s'");
    await q.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    await q.query("SET LOCAL search_path = pg_catalog, public");
    const isolation = await q.query('SHOW transaction_isolation');
    if (isolation.length !== 1 || isolation[0].transaction_isolation !== (mode === 'apply' ? 'read committed' : 'repeatable read')) {
      throw new Error('PHONE_SNAPSHOT_POLICY_MISMATCH');
    }
    validatePhoneFacts(await inspectPhoneDatabase(q, receipt), receipt);
    if (mode === 'preflight') {
      await q.rollbackTransaction();
      result = { status: 'PASS', reason: 'PREFLIGHT_PASSED' };
    } else {
      requirePhoneApproval(receipt, 'apply');
      // Fixed order. Exclusive table locks also block writes to existing users/preferences.
      await q.query('LOCK TABLE public.migrations IN ACCESS EXCLUSIVE MODE');
      await q.query('LOCK TABLE public.users IN ACCESS EXCLUSIVE MODE');
      await q.query('LOCK TABLE public.marketing_preferences IN ACCESS EXCLUSIVE MODE');
      // READ COMMITTED obtains a new statement snapshot after all locks have been acquired.
      // It does not freeze the entire catalog: keep apply blocked until the wider protocol is verified.
      const lockedIsolation = await q.query('SHOW transaction_isolation');
      if (lockedIsolation.length !== 1 || lockedIsolation[0].transaction_isolation !== 'read committed') {
        throw new Error('PHONE_SNAPSHOT_POLICY_MISMATCH');
      }
      validatePhoneFacts(await inspectPhoneDatabase(q, receipt), receipt);
      if (!PHONE_APPLY_CONCURRENCY_VERIFIED) {
        throw new PhoneConcurrencyUnverified();
      }
      await new AddUserPhoneAndSmsConsent1792195200000().up(q);
      // Schema first; history must still contain exactly six entries at this point.
      const changed = await inspectPhoneDatabase(q, receipt, true);
      validatePhoneFacts({ ...changed, history: [...changed.history, { timestamp: PHONE_TIMESTAMP, name: PHONE_MIGRATION }] }, receipt, true);
      const inserted = await q.query('INSERT INTO public.migrations(timestamp,name) VALUES ($1,$2) RETURNING timestamp::text AS timestamp,name',
        [PHONE_TIMESTAMP, PHONE_MIGRATION]);
      if (inserted.length !== 1 || inserted[0].timestamp !== PHONE_TIMESTAMP || inserted[0].name !== PHONE_MIGRATION) {
        throw new Error('PHONE_HISTORY_WRITE_FAILED');
      }
      validatePhoneFacts(await inspectPhoneDatabase(q, receipt, true), receipt, true);
      result = await commitPhoneTransaction(q);
    }
  } catch (error) {
    result = { status: 'BLOCKED', reason: error instanceof PhoneConcurrencyUnverified ? 'CONCURRENCY_UNVERIFIED' : 'OPERATION_FAILED' };
  } finally {
    // Failed initialization can leave driver state that is not exposed by isInitialized.
    // Do not claim connection cleanup was confirmed in that case.
    let cleanupFailed = initializing;
    if (q) {
      if (q.isTransactionActive) {
        try { await q.rollbackTransaction(); } catch { cleanupFailed = true; }
      }
      try { await q.release(); } catch { cleanupFailed = true; }
    }
    if (ds?.isInitialized) {
      try { await ds.destroy(); } catch { cleanupFailed = true; }
    }
    if (cleanupFailed && result.reason !== 'COMMIT_OUTCOME_UNKNOWN') result = { status: 'BLOCKED', reason: 'CLEANUP_UNCONFIRMED' };
  }
  return result;
}
