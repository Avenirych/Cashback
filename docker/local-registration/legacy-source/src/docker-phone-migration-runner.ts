import type { DataSource, QueryRunner } from 'typeorm';
import { createPhoneMigrationDataSource } from './docker-phone-migration-data-source';
import { inspectPhoneDatabase, PHONE_MIGRATION, PHONE_TIMESTAMP, requirePhoneApproval, validatePhoneFacts } from './docker-phone-migration-preflight';
import type { PhoneApproval } from './docker-phone-migration-preflight';
import { AddUserPhoneAndSmsConsent1792195200000 } from './migrations/1792195200000-AddUserPhoneAndSmsConsent';
import { Table } from 'typeorm';
import { assertPhoneTarget } from './docker-phone-migration-data-source';
import type { PhoneTarget } from './docker-phone-migration-data-source';
import { fingerprintPhoneCatalog, PHONE_CATALOG_SQL, PHONE_PREVIOUS, PHONE_UNSUPPORTED_SQL } from './docker-phone-migration-preflight';
import type { CatalogObject } from './docker-phone-migration-preflight';
import { InitialApplicationTables1733927999000 } from './migrations/1733927999000-InitialApplicationTables';
import { AddMarketingPreferences1733928000000 } from './migrations/1733928000000-AddMarketingPreferences';
import { AddEmailVerification1735000000000 } from './migrations/1735000000000-AddEmailVerification';
import { AddForumUsers1791394800000 } from './migrations/1791394800000-AddForumUsers';
import { CreateBonusTables1791630000000 } from './migrations/CreateBonusTables';
import { AddUsersEmailUnique1791888000000 } from './migrations/1791888000000-AddUsersEmailUnique';
import { verifyRegistrationPhoneSession } from './docker-phone-registration-target';
import { PhoneConcurrencyBlocked, PhoneConcurrencyProtocol } from './docker-phone-concurrency';
import type { PhoneConcurrencyControl } from './docker-phone-concurrency';

export interface PhoneRunResult {
  status: 'PASS' | 'BLOCKED';
  reason: 'PREFLIGHT_PASSED' | 'APPLIED' | 'INVALID_MODE' | 'AUTHORIZATION_REQUIRED' |
    'OPERATION_FAILED' | 'COMMIT_OUTCOME_UNKNOWN' | 'CLEANUP_UNCONFIRMED' | 'CONCURRENCY_UNVERIFIED';
}

// Table locks alone do not freeze views, rules, sequence parameters, ACLs or role changes.
// Source/mock validation is insufficient to open this gate. No runtime B/C approval exists.
export const PHONE_APPLY_CONCURRENCY_VERIFIED: boolean = false;
class PhoneConcurrencyUnverified extends Error {}

export interface PhoneBaselineApproval {
  operation: 'phone-baseline-six-only';
  permission: 'BASELINE';
  target: PhoneTarget;
  afterSixSha256: string;
}

/** Fixed source order; construction does not connect or execute up(). */
export function phoneBaselineMigrations() {
  return [new InitialApplicationTables1733927999000(),new AddMarketingPreferences1733928000000(),
    new AddEmailVerification1735000000000(),new AddForumUsers1791394800000(),
    new CreateBonusTables1791630000000(),new AddUsersEmailUnique1791888000000()];
}

/** Extension of this Harness, not a generic CLI or alternate seventh-migration path.
 * Source-prepared only: the existing unverified concurrency gate blocks this operation
 * BEFORE connection. No receipt, environment flag or caller argument opens that gate.
 * Registration targets additionally require fresh opaque Docker/SQL evidence.
 */
export async function runPhoneBaselineBootstrap(
  approval: PhoneBaselineApproval | null = null, password = '', concurrency?: PhoneConcurrencyControl,
): Promise<PhoneRunResult> {
  let receipt: PhoneBaselineApproval;
  try {
    if (!approval || approval.operation !== 'phone-baseline-six-only' || approval.permission !== 'BASELINE' ||
        !/^[a-f0-9]{64}$/.test(approval.afterSixSha256) || !password) throw new Error('UNAPPROVED');
    receipt = {...approval,target:{...approval.target}};
    assertPhoneTarget(receipt.target);
    if(receipt.target.registration&&receipt.target.registration.phase!=='baseline')throw new Error('BASELINE_PHASE_REQUIRED');
  } catch { return {status:'BLOCKED',reason:'AUTHORIZATION_REQUIRED'}; }
  if (!PHONE_APPLY_CONCURRENCY_VERIFIED) return {status:'BLOCKED',reason:'CONCURRENCY_UNVERIFIED'};

  let ds: DataSource | undefined, q: QueryRunner | undefined;
  let initializing = false;
  let restoreQueries:(()=>void)|undefined;
  let result: PhoneRunResult = {status:'BLOCKED',reason:'OPERATION_FAILED'};
  try {
    ds = createPhoneMigrationDataSource(receipt.target,password);
    // Reuse the guarded datasource. Its generic runMigrations/down remain forbidden.
    const baseline = phoneBaselineMigrations();
    if (JSON.stringify(baseline.map(m=>m.constructor.name)) !== JSON.stringify(PHONE_PREVIOUS.map(([,name])=>name))) {
      throw new Error('BASELINE_SOURCE_ORDER_MISMATCH');
    }
    ds.setOptions({migrations:baseline.map(m=>m.constructor as new () => typeof m)});
    initializing = true; await ds.initialize(); initializing = false;
    q = ds.createQueryRunner(); await q.connect(); await q.startTransaction('READ COMMITTED');
    await q.query("SET LOCAL statement_timeout = '10s'");
    await q.query("SET LOCAL lock_timeout = '3s'");
    await q.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    await q.query('SET LOCAL search_path = pg_catalog, public');
    await verifyRegistrationPhoneSession(q, receipt.target);
    const [identity] = await q.query(`SELECT current_database() AS database,current_user AS role,
      inet_server_addr()::text AS address,inet_server_port()::int AS port,
      (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
      (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier",
      current_setting('server_version_num') AS "serverVersionNum"`);
    const expected = receipt.target;
    for (const key of ['database','role','address','port','oid','systemIdentifier','serverVersionNum'] as const) {
      if (!identity || identity[key] !== expected[key]) throw new Error('BASELINE_IDENTITY_MISMATCH');
    }
    const unsupported = await q.query(PHONE_UNSUPPORTED_SQL);
    if (unsupported.length !== 1 || unsupported[0].count !== '0') throw new Error('BASELINE_NOT_EMPTY');
    const nonempty = await q.query(`SELECT (
      (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace) +
      (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace) +
      (SELECT count(*) FROM pg_type WHERE typnamespace='public'::regnamespace) +
      (SELECT count(*) FROM pg_extension WHERE extname<>'plpgsql') +
      (SELECT count(*) FROM pg_subscription WHERE subdbid=(SELECT oid FROM pg_database WHERE datname=current_database())) +
      (SELECT count(*) FROM pg_largeobject_metadata))::text AS count`);
    if (nonempty.length !== 1 || nonempty[0].count !== '0') throw new Error('BASELINE_NOT_EMPTY');
    if (receipt.target.registration) {
      if (!(concurrency?.protocol instanceof PhoneConcurrencyProtocol)) throw new PhoneConcurrencyUnverified();
      await concurrency.protocol.prepare(q,receipt);
      await concurrency.protocol.verify(concurrency.evidence);
      if(!concurrency.transaction)throw new PhoneConcurrencyUnverified();
      concurrency.protocol.validateTransactionFence(concurrency.transaction);
      await concurrency.protocol.assertApplyEligible(q,receipt);
      await concurrency.transaction.begin();
      restoreQueries=guardPhoneMutationQueries(q,concurrency.transaction);
    }
    await q.createTable(new Table({name:'migrations',columns:[
      {name:'id',type:'integer',isPrimary:true,isGenerated:true,generationStrategy:'increment'},
      {name:'timestamp',type:'bigint'}, {name:'name',type:'varchar'},
    ]}),false);
    for (const [index,migration] of baseline.entries()) {
      await migration.up(q);
      const [timestamp,name] = PHONE_PREVIOUS[index];
      await q.query('INSERT INTO public.migrations(timestamp,name) VALUES ($1,$2)',[timestamp,name]);
    }
    const history = await q.query('SELECT timestamp::text AS timestamp,name FROM public.migrations ORDER BY id');
    if (JSON.stringify(history.map((r:{timestamp:string;name:string})=>[r.timestamp,r.name])) !== JSON.stringify(PHONE_PREVIOUS)) throw new Error('BASELINE_HISTORY_MISMATCH');
    const catalog: CatalogObject[] = await q.query(PHONE_CATALOG_SQL);
    if (fingerprintPhoneCatalog(catalog,catalog) !== receipt.afterSixSha256) throw new Error('BASELINE_SCHEMA_MISMATCH');
    restoreQueries?.();restoreQueries=undefined;
    result = await commitPhoneTransaction(q,receipt.target.registration?concurrency?.transaction:undefined,!!receipt.target.registration);
  } catch (error) { result = {status:'BLOCKED',reason:
    error instanceof PhoneConcurrencyBlocked || error instanceof PhoneConcurrencyUnverified ? 'CONCURRENCY_UNVERIFIED' : 'OPERATION_FAILED'}; }
  finally {
    if (concurrency?.protocol instanceof PhoneConcurrencyProtocol) concurrency.protocol.close();
    let failed = initializing;
    restoreQueries?.();
    if (q) {
      try { if (q.isTransactionActive&&!(receipt?.target.registration&&result.reason==='COMMIT_OUTCOME_UNKNOWN')) {
        if(receipt?.target.registration&&concurrency?.transaction&&['ACTIVE','ABORTED'].includes(concurrency.transaction.outcome))await concurrency.transaction.confirmRollback(()=>q!.rollbackTransaction());
        else await q.rollbackTransaction();
      } } catch { failed = true; }
      try { await q.release(); } catch { failed = true; }
    }
    if (ds?.isInitialized) { try { await ds.destroy(); } catch { failed = true; } }
    if (failed && result.reason !== 'COMMIT_OUTCOME_UNKNOWN') result = {status:'BLOCKED',reason:'CLEANUP_UNCONFIRMED'};
  }
  return result;
}

/** Separate helper permits mock validation of uncertain commit acknowledgement, without
 * bypassing the apply gate or invoking migrations. No retry/rollback can establish non-commit.
 */
export async function commitPhoneTransaction(q: QueryRunner, fence?:import('./docker-phone-concurrency').PhoneFencedTransaction, required=false): Promise<PhoneRunResult> {
  if(required&&!fence)return {status:'BLOCKED',reason:'CONCURRENCY_UNVERIFIED'};
  if(fence){
    try {return await fence.commit(()=>q.commitTransaction())==='COMMITTED'?{status:'PASS',reason:'APPLIED'}:{status:'BLOCKED',reason:'COMMIT_OUTCOME_UNKNOWN'};}
    catch {return {status:'BLOCKED',reason:'CONCURRENCY_UNVERIFIED'};}
  }
  try { await q.commitTransaction(); return { status: 'PASS', reason: 'APPLIED' }; }
  catch { return { status: 'BLOCKED', reason: 'COMMIT_OUTCOME_UNKNOWN' }; }
}

/** Source implementation only. No CLI entry point or environment-based authorization.
 * A future trusted caller must supply a separately owner-approved B/C receipt and credential.
 * A caller-created object is NOT evidence of owner approval; it belongs to the trusted code boundary.
 */
export async function runPhoneMigration(
  mode: string, approval: PhoneApproval | null = null, password = '', concurrency?: PhoneConcurrencyControl,
): Promise<PhoneRunResult> {
  if (mode !== 'preflight' && mode !== 'apply') return { status: 'BLOCKED', reason: 'INVALID_MODE' };
  // Copy before the first await: authorization cannot change midway through a run.
  let receipt: PhoneApproval | null = null;
  try {
    receipt = approval ? { ...approval, target: { ...approval.target },
      beforeObjects: approval.beforeObjects.map(k => ({ ...k })),
      afterObjects: approval.afterObjects.map(k => ({ ...k })) } : null;
  } catch { return { status: 'BLOCKED', reason: 'AUTHORIZATION_REQUIRED' }; }
  try { requirePhoneApproval(receipt, mode); if(receipt.target.registration?.phase&&receipt.target.registration.phase!=='phone')throw new Error('PHONE_PHASE_REQUIRED'); }
  catch { return { status: 'BLOCKED', reason: 'AUTHORIZATION_REQUIRED' }; }
  let ds: DataSource | undefined;
  let q: QueryRunner | undefined;
  let initializing = false;
  let restoreQueries:(()=>void)|undefined;
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
      if (receipt.target.registration) {
        if (!(concurrency?.protocol instanceof PhoneConcurrencyProtocol)) throw new PhoneConcurrencyUnverified();
        const before = {...receipt,permission:'B' as const};
        await concurrency.protocol.prepare(q,before);
        await concurrency.protocol.verify(concurrency.evidence);
        if(!concurrency.transaction)throw new PhoneConcurrencyUnverified();
        concurrency.protocol.validateTransactionFence(concurrency.transaction);
        await concurrency.protocol.assertApplyEligible(q,receipt);
        await concurrency.transaction.begin();
        restoreQueries=guardPhoneMutationQueries(q,concurrency.transaction);
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
      restoreQueries?.();restoreQueries=undefined;
      result = await commitPhoneTransaction(q,receipt.target.registration?concurrency?.transaction:undefined,!!receipt.target.registration);
    }
  } catch (error) {
    result = { status: 'BLOCKED', reason: error instanceof PhoneConcurrencyUnverified || error instanceof PhoneConcurrencyBlocked ? 'CONCURRENCY_UNVERIFIED' : 'OPERATION_FAILED' };
  } finally {
    if (concurrency?.protocol instanceof PhoneConcurrencyProtocol) concurrency.protocol.close();
    // Failed initialization can leave driver state that is not exposed by isInitialized.
    // Do not claim connection cleanup was confirmed in that case.
    let cleanupFailed = initializing;
    restoreQueries?.();
    if (q) {
      if (q.isTransactionActive&&!(receipt?.target.registration&&result.reason==='COMMIT_OUTCOME_UNKNOWN')) {
        try {
          if(receipt?.target.registration&&concurrency?.transaction&&['ACTIVE','ABORTED'].includes(concurrency.transaction.outcome))await concurrency.transaction.confirmRollback(()=>q!.rollbackTransaction());
          else await q.rollbackTransaction();
        } catch { cleanupFailed = true; }
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

/** Every query inside up(), not just the outer call, checks continuous external fencing. */
function guardPhoneMutationQueries(q:QueryRunner,fence:import('./docker-phone-concurrency').PhoneFencedTransaction):()=>void {
  const original=q.query;
  q.query=((...args:Parameters<QueryRunner['query']>)=>fence.mutation(()=>original.apply(q,args))) as QueryRunner['query'];
  return ()=>{q.query=original;};
}
