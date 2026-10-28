import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Offline-only identity enrollment; never included in the live DataSource. */
export class AddFinanceIdentity1793201000000 implements MigrationInterface {
 name='AddFinanceIdentity1793201000000';
 async up(q:QueryRunner){const [role]=await q.query('SELECT rolsuper,rolcanlogin FROM pg_roles WHERE rolname=current_user');if(!role||role.rolsuper||role.rolcanlogin)throw Error('Trusted NOLOGIN migration owner required');await q.query(`
 CREATE SCHEMA finance_identity;
 REVOKE ALL ON SCHEMA finance_identity FROM PUBLIC;
 CREATE TABLE finance_identity.account_identities(owner_uuid uuid PRIMARY KEY,issued_user_id integer NOT NULL,issued_at timestamptz NOT NULL DEFAULT clock_timestamp());
 ALTER TABLE public.users ADD COLUMN account_uuid uuid;
 INSERT INTO finance_identity.account_identities(owner_uuid,issued_user_id) SELECT gen_random_uuid(),id FROM public.users;
 UPDATE public.users u SET account_uuid=r.owner_uuid FROM finance_identity.account_identities r WHERE r.issued_user_id=u.id;
 ALTER TABLE public.users ALTER COLUMN account_uuid SET NOT NULL;
 ALTER TABLE public.users ADD CONSTRAINT users_account_uuid_unique UNIQUE(account_uuid),ADD CONSTRAINT users_account_uuid_registry FOREIGN KEY(account_uuid) REFERENCES finance_identity.account_identities(owner_uuid);
 CREATE FUNCTION finance_identity.enroll() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,finance_identity,pg_temp AS $$
 BEGIN
 NEW.account_uuid=pg_catalog.gen_random_uuid();
 INSERT INTO finance_identity.account_identities(owner_uuid,issued_user_id) VALUES(NEW.account_uuid,NEW.id);
 RETURN NEW;
 END $$;
 REVOKE ALL ON FUNCTION finance_identity.enroll() FROM PUBLIC;
 CREATE FUNCTION finance_identity.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
 BEGIN RAISE EXCEPTION 'Finance identity is immutable'; END $$;
 REVOKE ALL ON FUNCTION finance_identity.immutable() FROM PUBLIC;
 CREATE TRIGGER users_finance_enroll BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION finance_identity.enroll();
 CREATE TRIGGER users_finance_identity BEFORE UPDATE ON public.users FOR EACH ROW WHEN(OLD.account_uuid IS DISTINCT FROM NEW.account_uuid) EXECUTE FUNCTION finance_identity.immutable();
 CREATE TRIGGER registry_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_identity.account_identities FOR EACH STATEMENT EXECUTE FUNCTION finance_identity.immutable();
 `);}
 async down():Promise<void>{throw Error('Issued identities must be retained; forward-only rollback required');}
}
