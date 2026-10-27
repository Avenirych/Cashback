import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AddUserPhoneAndSmsConsent1792195200000 } from './migrations/1792195200000-AddUserPhoneAndSmsConsent';
import { assertRegistrationPhoneTarget } from './docker-phone-registration-target';
import type { RegistrationPhoneBinding } from './docker-phone-registration-target';

export interface PhoneTarget {
  host: 'postgres-test';
  port: 5432;
  database: string;
  role: 'cashback_test'|'registration_migrator';
  address: string;
  oid: string;
  systemIdentifier: string;
  serverVersionNum: string;
  registration?: RegistrationPhoneBinding;
}

export function assertPhoneTarget(t: PhoneTarget): void {
  if (t.registration || t.database === 'cashback_docker_test') {
    assertRegistrationPhoneTarget(t);
    return;
  }
  if (t.host !== 'postgres-test' || t.port !== 5432 || t.role !== 'cashback_test' ||
      !/^cashback_phone_migration_check_[a-f0-9]{30}$/.test(t.database) ||
      !/^\d+$/.test(t.oid) || !/^\d+$/.test(t.systemIdentifier) ||
      !/^17\d{4}$/.test(t.serverVersionNum) || !t.address) {
    throw new Error('PHONE_TARGET_NOT_APPROVED');
  }
}

class PhoneDataSource extends DataSource {
  override async runMigrations(): Promise<never> { throw new Error('PHONE_GENERIC_CLI_FORBIDDEN'); }
  override async undoLastMigration(): Promise<never> { throw new Error('PHONE_DOWN_FORBIDDEN'); }
}

/** Factory only: no environment discovery, exported instance, or connection on import. */
export function createPhoneMigrationDataSource(target: PhoneTarget, password: string): DataSource {
  assertPhoneTarget(target);
  if(target.registration?.phase==='runtime')throw new Error('PHONE_RUNTIME_CANNOT_MIGRATE');
  if (!password) throw new Error('PHONE_CREDENTIAL_REQUIRED');
  return new PhoneDataSource({
    type: 'postgres', host: target.host, port: target.port, database: target.database,
    username: target.role, password, schema: 'public', entities: [], subscribers: [],
    migrations: [AddUserPhoneAndSmsConsent1792195200000],
    synchronize: false, migrationsRun: false, installExtensions: false,
    migrationsTransactionMode: 'all', logging: false, connectTimeoutMS: 5000,
    extra: { max: 1, statement_timeout: 10000, lock_timeout: 3000, idle_in_transaction_session_timeout: 15000 },
  });
}
