"""Future PostgreSQL suite. NEVER imported by the static checker."""
import time
from concurrent.futures import ThreadPoolExecutor
from common import connect, identity
from runner_control import run_checked


def call(role, query, args=()):
    with connect(role) as c:
        return c.execute(query, args).fetchall() if query.startswith('SELECT') else c.execute(query, args)


def denied(query, args=()):
    before = state()
    with connect('runtime') as c:
        try:
            c.execute(query, args)
        except Exception as e:
            assert e.sqlstate == '42501', 'Expected permission denial'
            c.rollback()
            assert state() == before, 'Denied operation changed state'
            return
        raise AssertionError('Unexpected runtime permission')


def state():
    rows = call('operator', 'SELECT * FROM fs_api.status()')
    assert len(rows) == 1, 'Missing or duplicated status row'
    opened, generation, n = rows[0]
    assert type(opened) is bool and generation > 0 and n >= 0
    return opened, generation, n


def setup():
    call('authority', 'SELECT fs_api.set_authority(true)')
    call('operator', 'SELECT fs_api.open_synthetic_admission()')


def main():
    with connect('runtime') as c:
        identity(c)
    results = []
    def check(name, test):
        test(); results.append(name); print('PASS', name)

    def direct():
        for q in ["INSERT INTO fs_private.protected VALUES(2,1,0)",
                  "UPDATE fs_private.protected SET n=999", "DELETE FROM fs_private.protected",
                  "TRUNCATE fs_private.protected", "SET ROLE fs_owner", "SET ROLE fs_installer",
                  "SET SESSION AUTHORIZATION fs_operator", "SELECT fs_private.lock_gate()",
                  "SELECT fs_api.open_synthetic_admission()",
                  "INSERT INTO fs_private.admission VALUES(1,true)",
                  "UPDATE fs_private.admission SET open=NULL",
                  "DELETE FROM fs_private.admission",
                  "UPDATE fs_private.contexts SET participant='33333333-3333-4333-8333-333333333333'"]:
            denied(q)
    check('direct SQL / privilege escalation / internal helper', direct)
    setup()
    check('missing context', lambda: denied('SELECT fs_api.touch_guard(%s)', (999999,)))
    def forged():
        with connect('runtime') as c:
            c.execute("SET LOCAL app.participant = 'forged'")
            try:
                c.execute('SELECT fs_api.touch_guard(999999)')
            except Exception as e:
                assert e.sqlstate == '42501'; c.rollback(); return
            raise AssertionError('Forged variable accepted')
    check('session variable is not identity', forged)
    def binding():
        before = state()
        with connect('runtime') as c:
            ctx = c.execute('SELECT fs_api.begin_context()').fetchone()[0]
            returned = c.execute('SELECT fs_api.touch_guard(%s)', (ctx,)).fetchone()[0]
            inside = c.execute('SELECT * FROM fs_api.status()').fetchone()
            assert inside == (True, before[1] + 1, before[2] + 1)
            assert returned == inside[1]
            c.commit()
            assert state() == inside
            try:
                c.execute('SELECT fs_api.touch_guard(%s)', (ctx,))
            except Exception as e:
                assert e.sqlstate == '42501'; c.rollback()
                assert state() == inside
                return
            raise AssertionError('Context crossed transaction')
    check('successful context / guard / cross-transaction denial', binding)
    def rollback():
        before = state()
        with connect('runtime') as c:
            ctx = c.execute('SELECT fs_api.begin_context()').fetchone()[0]
            c.execute('SELECT fs_api.touch_guard(%s)', (ctx,))
            assert c.execute('SELECT * FROM fs_api.status()').fetchone() == (True, before[1]+1, before[2]+1)
            c.rollback()
        assert state() == before
    check('guard rollback', rollback)
    def concurrent_revoke():
        setup()
        before = state()
        with connect('runtime') as a, connect('authority') as b:
            ctx = a.execute('SELECT fs_api.begin_context()').fetchone()[0]
            pid = b.info.backend_pid
            def revoke():
                b.execute('SELECT fs_api.set_authority(false)'); b.commit()
            with ThreadPoolExecutor(max_workers=1) as pool:
                f = pool.submit(revoke)
                deadline = time.monotonic() + 8
                blocked = False
                while time.monotonic() < deadline:
                    if a.execute('SELECT cardinality(pg_blocking_pids(%s))', (pid,)).fetchone()[0] > 0:
                        blocked = True; break
                    time.sleep(.02)
                if not blocked:
                    a.rollback(); f.result(timeout=12)
                    raise AssertionError('No actual lock barrier observed')
                a.execute('SELECT fs_api.touch_guard(%s)', (ctx,)); a.commit()
                f.result(timeout=12)
        assert state() == (True, before[1] + 1, before[2] + 1)
        denied('SELECT fs_api.begin_context()')
    check('command first / concurrent authority revoke / subsequent denial', concurrent_revoke)
    def concurrent_changes():
        setup()
        before = state()
        with connect('runtime') as a, connect('runtime') as b:
            ctx = a.execute('SELECT fs_api.begin_context()').fetchone()[0]
            a.execute('SELECT fs_api.touch_guard(%s)', (ctx,))
            assert a.execute('SELECT * FROM fs_api.status()').fetchone() == (True, before[1]+1, before[2]+1)
            def second():
                other = b.execute('SELECT fs_api.begin_context()').fetchone()[0]
                b.execute('SELECT fs_api.touch_guard(%s)', (other,)); b.commit()
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(second)
                deadline = time.monotonic()+8
                while time.monotonic() < deadline:
                    if a.execute('SELECT cardinality(pg_blocking_pids(%s))', (b.info.backend_pid,)).fetchone()[0] > 0:
                        break
                    time.sleep(.02)
                else:
                    a.rollback(); future.result(timeout=12)
                    raise AssertionError('Missing concurrent guard barrier')
                a.commit(); future.result(timeout=12)
        assert state() == (True, before[1]+2, before[2]+2)
    check('two concurrent permitted changes / exact persisted generations', concurrent_changes)
    def closed():
        call('operator', 'SELECT fs_api.close_admission()')
        denied('SELECT fs_api.begin_context()')
    check('CLOSED admission', closed)
    def failed_cutover():
        assert state()[0] is False
        with connect('operator') as c:
            try:
                c.execute('SELECT fs_api.open_synthetic_admission()')
                c.execute('SELECT 1/0')
            except Exception as e:
                assert e.sqlstate == '22012'; c.rollback()
        assert state()[0] is False
    check('failed cutover transaction remains CLOSED', failed_cutover)
    return len(results)

def cleanup():
    call('operator', 'SELECT fs_api.close_admission()')
    assert state()[0] is False, 'Final CLOSED not confirmed'

if __name__ == '__main__':
    raise SystemExit(run_checked(main, cleanup))
