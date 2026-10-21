"""Explicit acceptance aggregation. Missing facts never become PASS."""
REQUIRED = frozenset({
    'isolation', 'identity', 'preflight', 'snapshot_integrity', 'scram',
    'transaction_atomicity', 'acl_ownership', 'no_automatic_retry',
    'no_sensitive_client_diagnostics', 'no_verifier_in_inspected_logs',
    'correct_exit_status',
})

def scenario_exception_status(error):
    from contract import Blocked
    return 'BLOCKED' if isinstance(error,Blocked) else 'FAIL'

DIAGNOSTIC_FLAGS = ('truncated','stream_error','collection_gap','completeness_unproven',
                    'timeout','nonzero_exit','channel_missing','source_mismatch')

def diagnostic_status(flags, *, leak_detected, scanner_ok):
    if leak_detected is True:
        return 'FAIL'
    if (scanner_ok is not True or not isinstance(flags,dict)
            or set(flags)!=set(DIAGNOSTIC_FLAGS)
            or any(flags[name] is not False for name in DIAGNOSTIC_FLAGS)):
        return 'INCONCLUSIVE'
    return 'PASS'

def confirmed_diagnostics(diagnostics):
    from protocol import validate_diagnostics
    try:
        return validate_diagnostics(diagnostics)['status']=='PASS'
    except Exception:
        return False

def acceptance(facts, *, diagnostics=None):
    if isinstance(diagnostics,dict):
        rows=diagnostics.get('channels')
        if diagnostics.get('status')=='FAIL' or (isinstance(rows,list) and
                any(isinstance(r,dict) and r.get('leak_detected') is True for r in rows)):
            return 'FAIL'
    if not isinstance(facts, dict) or set(facts) != REQUIRED:
        return 'BLOCKED'
    if any(value == 'FAIL' for value in facts.values()):
        return 'FAIL'
    if any(value not in ('PASS','INCONCLUSIVE','NOT EXECUTED') for value in facts.values()):
        return 'BLOCKED'
    if any(value == 'NOT EXECUTED' for value in facts.values()):
        return 'NOT EXECUTED'
    if any(value == 'INCONCLUSIVE' for value in facts.values()):
        return 'INCONCLUSIVE'
    # Legacy callers supply only facts. Assertions of PASS alone are not
    # positive evidence of every mandatory diagnostic channel.
    return 'PASS' if confirmed_diagnostics(diagnostics) else 'INCONCLUSIVE'

def exit_status(facts, *, cleanup_confirmed, diagnostics=None):
    return 0 if acceptance(facts,diagnostics=diagnostics) == 'PASS' and cleanup_confirmed is True else 1
