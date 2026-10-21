"""Offline-testable exit policy; no DB imports or side effects at import."""
def run_checked(suite, cleanup, emit=print):
    failures = []
    result = None
    try:
        result = suite()
    except BaseException as error:
        failures.append(('suite', error))
    try:
        cleanup()
    except BaseException as error:
        failures.append(('cleanup', error))
    for phase, error in failures:
        # Preserve both error classifications; never print SQL/DSN/secret messages.
        emit('FAIL', phase, type(error).__name__, getattr(error, 'sqlstate', None))
    if failures:
        return 1
    emit('PASS count', result)
    return 0
