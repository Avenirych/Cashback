BEGIN;
GRANT SELECT,INSERT ON forum_event_details,forum_event_identities TO :"runtime_role";
REVOKE UPDATE,DELETE ON forum_event_details,forum_event_identities FROM :"runtime_role";
REVOKE ALL ON FUNCTION forum_erase_personal_data(integer),forum_purge_expired_details(timestamptz),forum_before_user_erasure() FROM :"runtime_role";
COMMIT;
