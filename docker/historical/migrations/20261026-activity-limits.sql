-- Explicit owner-run migration only; never TypeORM synchronize/migrationsRun.
BEGIN;
CREATE TABLE activity_limits_schema(version integer PRIMARY KEY CHECK(version=1));
INSERT INTO activity_limits_schema VALUES(1);
CREATE TABLE activity_limit_policies(
 action text NOT NULL CHECK(action IN ('video','research','review','topic','post','failed_login','registration','resend','registration_total','sensitive')),
 partner text NOT NULL DEFAULT '*', period text NOT NULL CHECK(period IN ('day','month','quarter_hour','minute')),
 maximum integer CHECK(maximum>=0), enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(action,partner,period)
);
INSERT INTO activity_limit_policies(action,period,maximum) VALUES
 ('video','day',50),('video','month',1500),('research','day',5),('research','month',100),
 ('review','day',3),('topic','day',5),('post','day',30),('failed_login','quarter_hour',5),
 ('registration','day',5),('resend','quarter_hour',3),('registration_total','minute',60),('sensitive','minute',60);
CREATE TABLE activity_limit_usage(
 subject text NOT NULL,action text NOT NULL,scope text NOT NULL,mode text NOT NULL CHECK(mode IN ('demo','real','security')),
 period text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 used integer NOT NULL DEFAULT 0 CHECK(used>=0),reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0),
 PRIMARY KEY(subject,action,scope,mode,period,starts_at)
);
CREATE TABLE activity_limit_operations(
 id uuid PRIMARY KEY,user_id integer REFERENCES users(id) ON DELETE CASCADE,
 subject text NOT NULL,action text NOT NULL,partner text NOT NULL,mode text NOT NULL CHECK(mode IN ('demo','real','security')),
 key_hash text NOT NULL,material_hash text NOT NULL,state text NOT NULL CHECK(state IN ('reserved','confirmed','released')),
 buckets jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(subject,action,partner,mode,key_hash)
);
CREATE TABLE activity_partner_events(
 partner text NOT NULL,external_id text NOT NULL,material_hash text NOT NULL,
 operation_id uuid NOT NULL REFERENCES activity_limit_operations(id),outcome text NOT NULL CHECK(outcome IN ('complete','failed','reversed')),
 PRIMARY KEY(partner,external_id)
);
CREATE TABLE activity_security_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,subject_hash text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('limit','conflict','login_failed','registration','partner_replay')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL
);
CREATE TABLE activity_limit_appeals(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id integer REFERENCES users(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),subject_hashes text[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),resolved_at timestamptz,
 resolution text CHECK(length(resolution)<=1000)
);
CREATE TABLE activity_user_plans(
 user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 plan text NOT NULL CHECK(plan IN ('FREE','PREMIUM')),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at)
);
CREATE INDEX activity_security_expiry ON activity_security_events(expires_at);
CREATE INDEX activity_usage_expiry ON activity_limit_usage(ends_at);
CREATE INDEX activity_operation_user ON activity_limit_operations(user_id);
-- No user is assigned PREMIUM; no sale/payment or financial tables touched.
COMMIT;
