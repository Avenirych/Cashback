import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { disposableDataSource, assertTarget, migrationNames } from './data-source';
import { User } from '../../src/users/user.entity';
import { UsersService } from '../../src/users/users.service';
import { AuthService } from '../../src/auth/auth.service';
import { AuthController } from '../../src/auth/auth.controller';
import { MailService } from '../../src/mail/mail.service';

/** Explicit CLI only; not discovered by the normal unit-test regex. */
export async function runIntegration(env: NodeJS.ProcessEnv): Promise<void> {
  const ds = disposableDataSource(env);
  let app: INestApplication | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const phase = (name: string) => console.log(JSON.stringify({ phase: name }));
  try {
    phase('identity-and-empty-database');
    await ds.initialize();
    await assertTarget(ds, env, true);
    phase('six-migrations-transaction-all');
    const applied = await ds.runMigrations({ transaction: 'all' });
    assert.deepEqual(applied.map(m => m.name), migrationNames);
    assert.deepEqual((await ds.query('SELECT name FROM public.migrations ORDER BY id')).map((m: { name: string }) => m.name), migrationNames);
    const constraint = await ds.query(`SELECT contype,pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='UQ_users_email'`);
    assert.deepEqual(constraint, [{ contype: 'u', definition: 'UNIQUE (email)' }]);

    phase('concurrent-http-registration');
    const users = new UsersService(ds.getRepository(User));
    const lookup = users.getByEmail.bind(users);
    let arrivals = 0;
    let release!: () => void;
    const bothLookedUp = new Promise<void>((resolve, reject) => {
      release = () => { clearTimeout(timeout); resolve(); };
      timeout = setTimeout(() => reject(new Error('Synthetic concurrency barrier timeout')), 10000);
    });
    users.getByEmail = async email => {
      const result = await lookup(email);
      assert.equal(result, null);
      if (++arrivals === 2) release();
      await bothLookedUp;
      return result;
    };
    const email = 'concurrency+fixture@example.test';
    let emailDeliveries = 0, jwtIssues = 0;
    const mail = {
      sendVerificationEmail: async (_email: string, token: string) => {
        assert.equal(_email, email); assert.match(token, /^[a-f0-9]{64}$/);
        emailDeliveries++; return null;
      },
    };
    const jwt = { sign: () => { jwtIssues++; return 'synthetic-session-result'; } };
    const auth = new AuthService(users, jwt as unknown as JwtService, mail as unknown as MailService);
    const testing = await Test.createTestingModule({ controllers: [AuthController], providers: [{ provide: AuthService, useValue: auth }] }).compile();
    app = testing.createNestApplication(); app.useLogger(false); await app.init();
    try {
      const make = (value: string) => request(app!.getHttpServer()).post('/auth/register').send({ email: value, name: 'Synthetic', password: 'Synthetic1!' });
      const results = await Promise.all([make(email), make(' \tCONCURRENCY+FIXTURE@EXAMPLE.TEST\n')]);
      assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
      const loser = results.find(r => r.status === 409)!;
      assert.deepEqual(loser.body, { statusCode: 409, error: 'Conflict', message: 'Registration with this email is unavailable' });
    } finally { clearTimeout(timeout); }
    assert.equal(emailDeliveries, 1); assert.equal(jwtIssues, 1);
    assert.equal(await ds.getRepository(User).count(), 1);
    assert.equal(await ds.getRepository(User).countBy({ email }), 1);
    for (const table of ['analytics_events','topic','post','forum_users','forum_topics','forum_posts','bonus_items','bonus_transfers','marketing_preferences']) {
      const [row] = await ds.query(`SELECT count(*)::int AS count FROM public."${table}"`);
      assert.equal(row.count, 0);
    }
    await app.close(); app = undefined;
    phase('raw-23505-exact-constraint');
    let conflict: unknown;
    try { await users.create({ email, name: 'Synthetic duplicate' }); } catch (error) { conflict = error; }
    assert(conflict && typeof conflict === 'object' && 'driverError' in conflict);
    const driver = conflict.driverError as { code?: string; constraint?: string };
    assert.equal(driver.code, '23505'); assert.equal(driver.constraint, 'UQ_users_email');
    assert.equal(await ds.getRepository(User).count(), 1);
    assert.equal(await ds.showMigrations(), false);

    phase('down-and-repeat-up');
    await assertTarget(ds, env, false);
    await ds.undoLastMigration({ transaction: 'all' });
    assert.equal((await ds.query('SELECT count(*)::int AS count FROM public.migrations'))[0].count, 5);
    assert.deepEqual((await ds.runMigrations({ transaction: 'all' })).map(m => m.name), [migrationNames[5]]);
    assert.equal(await ds.getRepository(User).count(), 1);

    phase('synthetic-duplicates-migration-refusal');
    await ds.undoLastMigration({ transaction: 'all' });
    await users.create({ email, name: 'Synthetic duplicate' });
    assert.equal(await ds.getRepository(User).count(), 2);
    let migrationFailure: unknown;
    try { await ds.runMigrations({ transaction: 'all' }); } catch (error) { migrationFailure = error; }
    assert(migrationFailure && typeof migrationFailure === 'object' && 'driverError' in migrationFailure);
    assert.equal((migrationFailure.driverError as { code?: string }).code, '23505');
    assert.equal(await ds.getRepository(User).count(), 2);
    assert.equal((await ds.query('SELECT count(*)::int AS count FROM public.migrations'))[0].count, 5);
    assert.equal((await ds.query(`SELECT count(*)::int AS count FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='UQ_users_email'`))[0].count, 0);
    console.log(JSON.stringify({ success: true, concurrentStatuses: [201,409], emailDeliveries: 1, jwtIssues: 1, disposableDatabaseRetained: true }));
  } finally {
    if (timeout) clearTimeout(timeout);
    if (app) await app.close();
    if (ds.isInitialized) await ds.destroy();
  }
}

if (require.main === module) {
  runIntegration(process.env).catch(() => {
    console.error('Integration stopped; no automatic repair or cleanup; disposable database retained');
    process.exitCode = 1;
  });
}
