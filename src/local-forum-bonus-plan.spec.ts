import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const sql=readFileSync(resolve(__dirname,'../docker/historical/migrations/20261020-forum-bonus-additive.sql'),'utf8');
test('migration is manual opt-in and pins only approved isolated database/cluster',()=>{
 for(const value of ['approved_forum_bonus_schema','owner-approved-forum-bonus-only','7698666936429441062','cashback_historical_03573b7','cashback_hist_owner','historical_schema_baseline'])expect(sql).toContain(value);
 expect(sql).toContain('\\quit 3');expect(sql).toMatch(/BEGIN;[\s\S]*COMMIT;/);
});
test('additive migration does not mutate accounts, remove objects or skip partial schema',()=>{
 expect(sql).not.toMatch(/^\s*(DROP|ALTER TABLE|INSERT INTO|UPDATE|DELETE FROM)\b/m);
 expect(sql).not.toMatch(/CREATE(?: UNIQUE)? (?:TABLE|TYPE|INDEX) IF NOT EXISTS/);expect(sql).toContain("to_regclass('public.bonus_items') IS NOT NULL");
 expect(sql).toContain("to_regclass('public.bonus_transfers') IS NOT NULL");
});
test('reviewed exchange identities are linked to users and unambiguous forum usernames',()=>{
 expect(sql).toContain('CREATE UNIQUE INDEX forum_users_username_lower_key');
 expect(sql).toContain('GROUP BY lower(username) HAVING count(*)>1');
 for(const name of ['bonus_items','bonus_transfers','bonus_items_source_enum','bonus_items_status_enum'])expect(sql).toContain(name);
 for(const column of ['"fromUserId"','"toUserId"','"fromUsername"','"toUsername"','"idempotencyKey"','"requestHash"','"sourceBonusId"'])expect(sql).toContain(column);
});
test('new runtime permissions exclude ownership, role creation and destructive table privileges',()=>{
 expect(sql).toContain('GRANT SELECT, INSERT, UPDATE ON public.bonus_items TO cashback_hist_runtime');
 expect(sql).toContain('GRANT SELECT, INSERT ON public.bonus_transfers TO cashback_hist_runtime');
 expect(sql).not.toMatch(/GRANT.*(DELETE|TRUNCATE|CREATE|ALL).*TO cashback_hist_runtime/);
 expect(sql).not.toMatch(/CREATE EXTENSION|ALTER ROLE|OWNER TO|GRANT .*WITH GRANT OPTION/);
});
