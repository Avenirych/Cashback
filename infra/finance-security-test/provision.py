"""EXPLICIT future installer; refuses existing harness. No automatic init/migration."""
from pathlib import Path
from psycopg import sql
from common import identity, ROLES, scram_verifier, _secret_snapshot, _connect_bootstrap
from common import provisioning_logging_preflight

LOGIN_ROLES = (
    ('installer', 'fs_installer'),
    ('runtime', 'fs_runtime_login'),
    ('authority', 'fs_authority'),
    ('operator', 'fs_operator'),
)

def main():
    snapshot = _secret_snapshot()
    with _connect_bootstrap(snapshot) as c:
        identity(c, bootstrap=True)
        provisioning_logging_preflight(c)
        if c.execute("SELECT to_regnamespace('fs_private')").fetchone()[0] is not None:
            raise RuntimeError('Existing harness refused; no reset or reprovision')
        for name in ['00_roles.sql', '10_boundary.sql']:
            c.execute((Path('sql') / name).read_text(encoding='utf-8'), prepare=False)
        for role, login_role in LOGIN_ROLES:
            if ROLES[role] != login_role:
                raise RuntimeError('Password role mapping conflict')
            verifier = scram_verifier(c, login_role, snapshot[role].decode('ascii'))
            c.execute(sql.SQL('ALTER ROLE {} PASSWORD {}').format(
                sql.Identifier(login_role), sql.Literal(verifier)))
        c.commit()
    print('Isolated harness installed CLOSED; no application migrations applied')

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('Provisioning failed:', type(e).__name__, getattr(e, 'sqlstate', None))
        raise SystemExit(1)  # no raw SQL/secret/DSN/error details
