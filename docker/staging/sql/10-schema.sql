-- Independent synthetic baseline, authored against current entities and activity-engine contract.
-- No historical SQL inclusion, fixtures, UUID enrollment, finance schema or migration execution.
CREATE ROLE cashback_staging_schema NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA staging_meta AUTHORIZATION cashback_staging_schema;
CREATE TABLE staging_meta.baseline(version int PRIMARY KEY CHECK(version=1), purpose text NOT NULL CHECK(purpose='synthetic-only'));
INSERT INTO staging_meta.baseline VALUES(1,'synthetic-only');
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA public TO cashback_staging_schema;
SET LOCAL ROLE cashback_staging_schema;
CREATE TABLE public.users (
 id serial PRIMARY KEY, email varchar NOT NULL UNIQUE CHECK(email ~ '^[A-Za-z0-9._+%-]+@example[.]invalid$'),
 name varchar NOT NULL, first_name varchar CHECK(first_name IS NULL OR length(btrim(first_name)) BETWEEN 2 AND 100), last_name varchar CHECK(last_name IS NULL OR length(btrim(last_name)) BETWEEN 2 AND 100), phone_e164 varchar CHECK(phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{1,14}$'),
 avatar_url varchar, password varchar, balance numeric(10,2) NOT NULL DEFAULT 0 CHECK(balance=0),
 email_verified boolean NOT NULL DEFAULT false, email_token varchar, email_token_expires_at timestamp,
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.forum_users (
 id serial PRIMARY KEY, user_id integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
 username varchar(30) NOT NULL UNIQUE, avatar_url varchar, agreed_to_rules boolean NOT NULL DEFAULT false,
 agreed_to_rules_at timestamp, banned boolean NOT NULL DEFAULT false, ban_reason text,
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.forum_topics(id serial PRIMARY KEY,title varchar NOT NULL,"authorId" integer REFERENCES public.users(id),created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.forum_posts(id serial PRIMARY KEY,"topicId" integer REFERENCES public.forum_topics(id),"authorId" integer REFERENCES public.users(id),content varchar NOT NULL,created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.topic(id serial PRIMARY KEY,title varchar NOT NULL,"createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.post(id serial PRIMARY KEY,content text NOT NULL,"createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,"topicId" integer REFERENCES public.topic(id),"authorId" integer REFERENCES public.users(id));
CREATE TABLE public.analytics_events(id serial PRIMARY KEY,type varchar NOT NULL,"userId" integer,data text,created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.marketing_preferences (
 id serial PRIMARY KEY,"userId" integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
 "accountUpdates" boolean NOT NULL DEFAULT true,"specialOffers" boolean NOT NULL DEFAULT false,
 "partnerRecommendations" boolean NOT NULL DEFAULT false,"smsMarketing" boolean NOT NULL DEFAULT false,
 "smsMarketingGrantedAt" timestamptz,"smsMarketingRevokedAt" timestamptz,"smsMarketingConsentVersion" varchar(64),
 "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (("smsMarketingGrantedAt" IS NULL AND "smsMarketingRevokedAt" IS NULL AND "smsMarketingConsentVersion" IS NULL AND NOT "smsMarketing") OR
 ("smsMarketingGrantedAt" IS NOT NULL AND "smsMarketingConsentVersion" IS NOT NULL AND length("smsMarketingConsentVersion")>0 AND
 (("smsMarketing" AND "smsMarketingRevokedAt" IS NULL) OR (NOT "smsMarketing" AND "smsMarketingRevokedAt">="smsMarketingGrantedAt"))))
);
-- Legacy entity metadata only: empty, NO runtime grants, no financial API activation.
CREATE TYPE public.bonus_items_source_enum AS ENUM('ads','research','transfer','purchase','refund');
CREATE TYPE public.bonus_items_status_enum AS ENUM('pending','confirmed','spent','expired','failed');
CREATE TABLE public.bonus_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"userId" integer NOT NULL REFERENCES public.users(id),
 source public.bonus_items_source_enum NOT NULL,amount numeric(12,2) NOT NULL,status public.bonus_items_status_enum NOT NULL DEFAULT 'confirmed',
 "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" timestamptz NOT NULL,"usedAt" timestamptz,
 "referenceId" varchar(100),"orderId" varchar(100),"transferMeta" jsonb
);
CREATE INDEX "IDX_bonus_items_available" ON public.bonus_items("userId",status,"expiresAt");
CREATE TABLE public.bonus_transfers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"fromUserId" integer NOT NULL REFERENCES public.users(id),"toUserId" integer NOT NULL REFERENCES public.users(id),
 "fromUsername" varchar(30) NOT NULL,"toUsername" varchar(30) NOT NULL,amount numeric(12,2) NOT NULL,
 "expiresAt" timestamptz NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,status varchar(20) NOT NULL DEFAULT 'completed',
 "idempotencyKey" varchar(100) NOT NULL,"requestHash" varchar(64) NOT NULL,"sourceBonusId" uuid NOT NULL
);
CREATE INDEX "IDX_bonus_transfers_sender" ON public.bonus_transfers("fromUserId","createdAt");
CREATE INDEX "IDX_bonus_transfers_receiver" ON public.bonus_transfers("toUserId","createdAt");
CREATE TABLE public.activity_limits_schema(version integer PRIMARY KEY CHECK(version=1));
INSERT INTO public.activity_limits_schema VALUES(1);
CREATE TABLE public.activity_limit_policies(action text NOT NULL CHECK(action IN ('video','research','review','topic','post','failed_login','registration','resend','registration_total','sensitive')),partner text NOT NULL DEFAULT '*',period text NOT NULL CHECK(period IN ('day','month','quarter_hour','minute')),maximum integer CHECK(maximum>=0),enabled boolean NOT NULL DEFAULT true,PRIMARY KEY(action,partner,period));
INSERT INTO public.activity_limit_policies(action,period,maximum) VALUES
 ('video','day',50),('video','month',1500),('research','day',5),('research','month',100),('review','day',3),('topic','day',5),('post','day',30),('failed_login','quarter_hour',5),('registration','day',5),('resend','quarter_hour',3),('registration_total','minute',60),('sensitive','minute',60);
CREATE TABLE public.activity_limit_usage(subject text NOT NULL,action text NOT NULL,scope text NOT NULL,mode text NOT NULL CHECK(mode IN ('demo','real','security')),period text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,used integer NOT NULL DEFAULT 0 CHECK(used>=0),reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0),PRIMARY KEY(subject,action,scope,mode,period,starts_at));
CREATE TABLE public.activity_limit_operations(id uuid PRIMARY KEY,user_id integer REFERENCES public.users(id) ON DELETE CASCADE,subject text NOT NULL,action text NOT NULL,partner text NOT NULL,mode text NOT NULL CHECK(mode IN ('demo','real','security')),key_hash text NOT NULL,material_hash text NOT NULL,state text NOT NULL CHECK(state IN ('reserved','confirmed','released')),buckets jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(subject,action,partner,mode,key_hash));
CREATE TABLE public.activity_partner_events(partner text NOT NULL,external_id text NOT NULL,material_hash text NOT NULL,operation_id uuid NOT NULL REFERENCES public.activity_limit_operations(id),outcome text NOT NULL CHECK(outcome IN ('complete','failed','reversed')),PRIMARY KEY(partner,external_id));
CREATE TABLE public.activity_security_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,subject_hash text NOT NULL,kind text NOT NULL CHECK(kind IN ('limit','conflict','login_failed','registration','partner_replay')),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL);
CREATE TABLE public.activity_limit_appeals(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id integer REFERENCES public.users(id) ON DELETE CASCADE,reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),subject_hashes text[] NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),resolved_at timestamptz,resolution text CHECK(length(resolution)<=1000));
CREATE TABLE public.activity_user_plans(user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,plan text NOT NULL CHECK(plan IN ('FREE','PREMIUM')),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at));
CREATE INDEX activity_security_expiry ON public.activity_security_events(expires_at);
CREATE INDEX activity_usage_expiry ON public.activity_limit_usage(ends_at);
CREATE INDEX activity_operation_user ON public.activity_limit_operations(user_id);
RESET ROLE;
ALTER TABLE staging_meta.baseline OWNER TO cashback_staging_schema;
