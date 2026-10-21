"""Future privileged fault injection ONLY, separate from runtime suite.
No fault is committed; connection uses new isolated bootstrap credentials.
"""
from common import connect, identity
from runner_control import run_checked


def fault(kind):
    with connect('bootstrap') as c:
        identity(c, bootstrap=True)
        before = c.execute('SELECT generation,n FROM fs_private.protected WHERE id=1').fetchone()
        c.execute('SELECT fs_api.set_authority(true)')
        c.execute('SELECT fs_api.open_synthetic_admission()')
        c.execute('SET LOCAL SESSION AUTHORIZATION fs_runtime_login')
        ctx = c.execute('SELECT fs_api.begin_context()').fetchone()[0]
        c.execute('RESET SESSION AUTHORIZATION')
        if kind == 'missing':
            c.execute('DELETE FROM fs_private.admission WHERE id=1')
        elif kind == 'null':
            # Fault injection models corrupted/old schema. Rolled back with everything else.
            c.execute('ALTER TABLE fs_private.admission ALTER COLUMN open DROP NOT NULL')
            c.execute('UPDATE fs_private.admission SET open=NULL WHERE id=1')
        else:
            raise ValueError('Unknown fault')
        assert c.execute('SELECT is_open FROM fs_api.status()').fetchone()[0] is False
        for query, args in [('SELECT fs_api.begin_context()', ()),
                            ('SELECT fs_api.touch_guard(%s)', (ctx,))]:
            c.execute('SAVEPOINT fault_probe')
            c.execute('SET LOCAL SESSION AUTHORIZATION fs_runtime_login')
            try:
                c.execute(query, args)
            except Exception as error:
                if getattr(error, 'sqlstate', None) != '42501':
                    raise AssertionError('Unexpected fault refusal class') from error
                c.execute('ROLLBACK TO SAVEPOINT fault_probe')
            else:
                raise AssertionError('Corrupt admission allowed operation')
            assert c.execute('SELECT generation,n FROM fs_private.protected WHERE id=1').fetchone() == before
        c.rollback()
        assert c.execute('SELECT generation,n FROM fs_private.protected WHERE id=1').fetchone() == before
        c.rollback()


def suite():
    fault('missing'); fault('null')
    return 2

if __name__ == '__main__':
    # DB context managers rollback on failure, including transactional DDL faults.
    raise SystemExit(run_checked(suite, lambda: None))
