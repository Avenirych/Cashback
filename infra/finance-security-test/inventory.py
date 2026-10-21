"""Explicit future read-only inventory; no provisioning."""
from common import connect
if __name__ == '__main__':
    try:
        with connect('bootstrap') as c:
            c.execute('SET TRANSACTION READ ONLY')
            db, version, cluster = c.execute("SELECT current_database(), current_setting('server_version_num'), (SELECT system_identifier::text FROM pg_control_system())").fetchone()
            if db != 'finance_security_test' or cluster == '7695793866029359141':
                raise RuntimeError('Wrong target')
            print('database:', db, 'version:', version, 'cluster:', cluster)
            c.rollback()
    except Exception as e:
        print('Inventory refused:', type(e).__name__)
        raise SystemExit(1)
