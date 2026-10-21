-- ONE SHOT ONLY, manually approved, NEW EMPTY historical database only.
-- Final baseline equivalent to historical entity schema + both migration effects.
-- This does NOT claim that TypeORM migration classes were executed.
\set ON_ERROR_STOP on
\getenv runtime_password HISTORICAL_RUNTIME_PASSWORD
SELECT length(:'runtime_password') >= 24 AS password_ok \gset
\if :password_ok
\else
  \echo HISTORICAL_RUNTIME_PASSWORD_REQUIRED_MIN_24
  \quit 3
\endif
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'cashback_historical_03573b7' OR current_user <> 'cashback_hist_owner'
     OR current_setting('server_version_num')::integer / 10000 <> 17
     OR EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public')
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cashback_hist_runtime') THEN
    RAISE EXCEPTION 'HISTORICAL_NEW_EMPTY_DATABASE_REQUIRED';
  END IF;
END $guard$;
CREATE TABLE public.users (
 id SERIAL PRIMARY KEY, email varchar NOT NULL, name varchar NOT NULL,
 avatar_url varchar, password varchar, balance numeric(10,2) NOT NULL DEFAULT 0,
 email_verified boolean NOT NULL DEFAULT false, email_token varchar,
 email_token_expires_at timestamp, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.forum_topics (
 id SERIAL PRIMARY KEY, title varchar NOT NULL, "authorId" integer REFERENCES public.users(id),
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.forum_posts (
 id SERIAL PRIMARY KEY, "topicId" integer REFERENCES public.forum_topics(id),
 "authorId" integer REFERENCES public.users(id), content varchar NOT NULL,
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.forum_users (
 id SERIAL PRIMARY KEY, user_id integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
 username varchar(30) NOT NULL UNIQUE, avatar_url varchar,
 agreed_to_rules boolean NOT NULL DEFAULT false, agreed_to_rules_at timestamp,
 banned boolean NOT NULL DEFAULT false, ban_reason text,
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.topic (
 id SERIAL PRIMARY KEY, title varchar NOT NULL, "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.post (
 id SERIAL PRIMARY KEY, content text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "topicId" integer REFERENCES public.topic(id), "authorId" integer REFERENCES public.users(id)
);
CREATE TABLE public.analytics_events (
 id SERIAL PRIMARY KEY, type varchar NOT NULL, "userId" integer, data text,
 created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.historical_schema_baseline (
 commit_sha text PRIMARY KEY CHECK (commit_sha='03573b7f47ba3c04dc50312bc71e0a7b904c0ce7'),
 initialized_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO public.historical_schema_baseline(commit_sha) VALUES ('03573b7f47ba3c04dc50312bc71e0a7b904c0ce7');
-- psql quotes this value as a SQL literal. Never run with echo-all/echo-queries.
CREATE ROLE cashback_hist_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD :'runtime_password';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE cashback_historical_03573b7 TO cashback_hist_runtime;
GRANT USAGE ON SCHEMA public TO cashback_hist_runtime;
GRANT SELECT, INSERT, UPDATE ON public.users TO cashback_hist_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_users, public.forum_topics, public.forum_posts,
 public.topic, public.post, public.analytics_events TO cashback_hist_runtime;
GRANT SELECT ON public.historical_schema_baseline TO cashback_hist_runtime;
GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq, public.forum_users_id_seq,
 public.forum_topics_id_seq, public.forum_posts_id_seq, public.topic_id_seq,
 public.post_id_seq, public.analytics_events_id_seq TO cashback_hist_runtime;
COMMIT;
