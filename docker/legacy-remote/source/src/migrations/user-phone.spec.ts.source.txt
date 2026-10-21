import type { QueryRunner } from 'typeorm';
import { AddUserPhoneAndSmsConsent1792195200000 } from './1792195200000-AddUserPhoneAndSmsConsent';

describe('Phone additive migration SQL contract (no database)', () => {
  it('keeps legacy phone nullable, checks consistency and does not make it unique', async () => {
    const query=jest.fn().mockResolvedValue(undefined);
    await new AddUserPhoneAndSmsConsent1792195200000().up({query} as unknown as QueryRunner);
    const sql=query.mock.calls.map(call => String(call[0])).join('\n');
    expect(sql).toContain('ADD COLUMN "phone_e164" varchar(16),');
    expect(sql).toContain('"phone_e164" ~ \'^\\+[1-9][0-9]{1,14}$\'');
    expect(sql).toContain('"phone_verified" boolean NOT NULL DEFAULT false');
    expect(sql).toContain('CK_users_phone_verification');
    expect(sql).toContain('CK_marketing_sms_consent');
    expect(sql).not.toMatch(/UNIQUE|UPDATE\s|DELETE\s|DROP\s/);
  });
});
