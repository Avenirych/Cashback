import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Additive password capability/intent schema. Run only after approved session-version migration. */
export class AddPasswordRecovery1793836801000 implements MigrationInterface {
 async up(q:QueryRunner):Promise<void>{
  await q.query('SELECT session_version FROM public.users LIMIT 0');
  await q.query(`
   ALTER TABLE public.users
    ADD COLUMN password_reset_digest bytea,
    ADD COLUMN password_reset_expires_at timestamptz,
    ADD COLUMN password_reset_session_version integer,
    ADD CONSTRAINT "CK_users_password_reset_slot" CHECK (
     (password_reset_digest IS NULL AND password_reset_expires_at IS NULL AND password_reset_session_version IS NULL)
     OR (password_reset_digest IS NOT NULL AND octet_length(password_reset_digest)=32 AND password_reset_expires_at IS NOT NULL AND password_reset_session_version IS NOT NULL AND password_reset_session_version>=0));
   CREATE UNIQUE INDEX "UQ_users_password_reset_digest" ON public.users(password_reset_digest) WHERE password_reset_digest IS NOT NULL;
   CREATE TABLE public.auth_password_mail_jobs(
    id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('reset_request','password_changed')),
    recipient_email text NOT NULL,user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    locale text NOT NULL CHECK(locale IN ('ru','en','de','fr')),event_version integer CHECK(event_version>=0),
    state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','done','failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL,started_at timestamptz,finished_at timestamptz,
    CHECK(expires_at>created_at));
   CREATE UNIQUE INDEX "UQ_password_change_intent" ON public.auth_password_mail_jobs(user_id,event_version) WHERE kind='password_changed';
   CREATE INDEX "IDX_password_mail_pending" ON public.auth_password_mail_jobs(available_at,created_at,id) WHERE state='pending';
   ALTER TABLE public.activity_limit_policies DROP CONSTRAINT activity_limit_policies_action_check,
    ADD CONSTRAINT activity_limit_policies_action_check CHECK(action IN ('video','research','review','topic','post','failed_login','registration','resend','registration_total','sensitive','password_reset_request','password_reset_confirm','password_change'));
   ALTER TABLE public.activity_limit_policies DROP CONSTRAINT activity_limit_policies_period_check,
    ADD CONSTRAINT activity_limit_policies_period_check CHECK(period IN ('day','month','quarter_hour','minute','hour'));
   INSERT INTO public.activity_limit_policies(action,partner,period,maximum) VALUES
    ('password_reset_request','password-account','minute',1),('password_reset_request','password-account','hour',3),
    ('password_reset_request','password-source','hour',20),('password_reset_request','password-global','quarter_hour',20),
    ('password_reset_confirm','password-account','quarter_hour',20),('password_reset_confirm','password-source','quarter_hour',20),('password_reset_confirm','password-global','quarter_hour',20),
    ('password_change','password-account','quarter_hour',5),('password_change','password-source','quarter_hour',20),('password_change','password-global','quarter_hour',20);
   CREATE TABLE public.auth_password_schema(version integer PRIMARY KEY CHECK(version=1));
   INSERT INTO public.auth_password_schema VALUES(1);
  `);
 }
 async down(_q:QueryRunner):Promise<void>{throw Error('PASSWORD_RECOVERY_ROLLBACK_REQUIRES_REVIEW');}
}
