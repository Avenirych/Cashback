SET LOCAL ROLE fs_owner;
-- Synthetic counter only: NOT finance lots/ledger/cash or business operations.
CREATE TABLE fs_private.admission(id int PRIMARY KEY CHECK(id=1), open boolean NOT NULL DEFAULT false);
INSERT INTO fs_private.admission VALUES(1,false);
CREATE TABLE fs_private.auth(id int PRIMARY KEY CHECK(id=1), epoch bigint NOT NULL CHECK(epoch>0), enabled boolean NOT NULL);
INSERT INTO fs_private.auth VALUES(1,1,false);
CREATE TABLE fs_private.identities(login name PRIMARY KEY, principal uuid NOT NULL,
 participant uuid NOT NULL, verified boolean NOT NULL, enabled boolean NOT NULL);
INSERT INTO fs_private.identities VALUES('fs_runtime_login',
 '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',true,true);
CREATE TABLE fs_private.contexts(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 xid xid8 NOT NULL, pid int NOT NULL, login name NOT NULL, principal uuid NOT NULL,
 participant uuid NOT NULL, epoch bigint NOT NULL);
CREATE TABLE fs_private.protected(id int PRIMARY KEY, generation bigint NOT NULL CHECK(generation>0), n bigint NOT NULL CHECK(n>=0));
INSERT INTO fs_private.protected VALUES(1,1,0);
CREATE TABLE fs_private.audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action text NOT NULL, epoch bigint NOT NULL);

CREATE FUNCTION fs_private.lock_gate() RETURNS void LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(726405,0);
 UPDATE fs_private.admission SET open=open WHERE id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOSED_MISSING' USING ERRCODE='42501'; END IF;
 UPDATE fs_private.auth SET epoch=epoch WHERE id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'AUTH_MISSING' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION fs_private.check_authority() RETURNS void LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF (SELECT open FROM fs_private.admission WHERE id=1) IS NOT TRUE THEN RAISE EXCEPTION 'CLOSED' USING ERRCODE='42501'; END IF;
 IF (SELECT enabled FROM fs_private.auth WHERE id=1) IS NOT TRUE OR NOT EXISTS(
 SELECT 1 FROM fs_private.identities WHERE login=session_user AND verified AND enabled)
 THEN RAISE EXCEPTION 'AUTH_DENIED' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION fs_api.begin_context() RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$ DECLARE result bigint; BEGIN
 PERFORM fs_private.lock_gate(); PERFORM fs_private.check_authority();
 INSERT INTO fs_private.contexts(xid,pid,login,principal,participant,epoch)
 SELECT pg_current_xact_id(),pg_backend_pid(),session_user,i.principal,i.participant,a.epoch
 FROM fs_private.identities i CROSS JOIN fs_private.auth a WHERE i.login=session_user
 RETURNING id INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'CONTROL_MISSING' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION fs_api.touch_guard(ctx bigint) RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$ DECLARE result bigint; BEGIN
 PERFORM fs_private.lock_gate(); PERFORM fs_private.check_authority();
 IF NOT EXISTS(SELECT 1 FROM fs_private.contexts c JOIN fs_private.auth a ON a.epoch=c.epoch
 JOIN fs_private.identities i ON i.login=c.login AND i.principal=c.principal AND i.participant=c.participant
 WHERE c.id=ctx AND c.xid=pg_current_xact_id() AND c.pid=pg_backend_pid() AND c.login=session_user)
 THEN RAISE EXCEPTION 'CONTEXT_DENIED' USING ERRCODE='42501'; END IF;
 UPDATE fs_private.protected SET generation=generation+1,n=n+1 WHERE id=1 RETURNING generation INTO STRICT result;
 IF result IS NULL THEN RAISE EXCEPTION 'CONTROL_MISSING' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION fs_api.set_authority(value boolean) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 PERFORM fs_private.lock_gate();
 UPDATE fs_private.auth SET enabled=value,epoch=epoch+1 WHERE id=1;
 INSERT INTO fs_private.audit(action,epoch) SELECT 'authority',epoch FROM fs_private.auth;
END $$;
CREATE FUNCTION fs_api.close_admission() RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 PERFORM fs_private.lock_gate(); UPDATE fs_private.admission SET open=false WHERE id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOSED_MISSING' USING ERRCODE='42501'; END IF;
END $$;
-- TEST-ONLY open gate: advisory prototype, NOT production acceptance/reopen authority.
CREATE FUNCTION fs_api.open_synthetic_admission() RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 PERFORM fs_private.lock_gate(); UPDATE fs_private.admission SET open=true WHERE id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOSED_MISSING' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION fs_api.status() RETURNS TABLE(is_open boolean,generation bigint,n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp
AS $$ SELECT (SELECT a.open FROM fs_private.admission a WHERE a.id=1) IS TRUE,p.generation,p.n FROM fs_private.protected p WHERE p.id=1 $$;
CREATE FUNCTION fs_api.cluster_identity() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$ SELECT system_identifier::text FROM pg_catalog.pg_control_system() $$;
REVOKE ALL ON ALL TABLES IN SCHEMA fs_private FROM PUBLIC,fs_runtime_login,fs_authority,fs_operator;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA fs_private FROM PUBLIC,fs_runtime_login,fs_authority,fs_operator;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA fs_private,fs_api FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fs_api.begin_context(),fs_api.touch_guard(bigint) TO fs_runtime_login;
GRANT EXECUTE ON FUNCTION fs_api.set_authority(boolean) TO fs_authority;
GRANT EXECUTE ON FUNCTION fs_api.close_admission(),fs_api.open_synthetic_admission() TO fs_operator;
GRANT EXECUTE ON FUNCTION fs_api.status(),fs_api.cluster_identity() TO fs_runtime_login,fs_authority,fs_operator;
RESET ROLE;
