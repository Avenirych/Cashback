"""INTEGRATION adapters, inert until explicitly called by an approved driver.

No transport or lifecycle launcher is provided. A fresh cluster is required per
case. This module NEVER calls the parent's __main__ entry point automatically.
"""
from contextlib import ExitStack
from types import MappingProxyType
from unittest.mock import patch
from runner_gate import RunnerAdmission
from contract import Blocked, ScenarioFailure
from scanner import Scanner
from targets import load_targets

CASES = frozenset({
    'success', 'permission_denied', 'missing_role', 'statement_timeout',
    'second_sql_error', 'alter_error', 'explicit_rollback',
    'commit_unknown_before', 'commit_unknown_after', 'repeat',
    'after_sql_1', 'after_sql_2', 'after_alter_1', 'after_alter_2',
    'after_alter_3', 'after_alter_4',
})

class InjectedFailure(RuntimeError): pass
class CommitUnknown(RuntimeError): pass

def synthetic_materials():
    """PUBLIC, fictitious fixtures; never suitable for any real account."""
    names = ('bootstrap', 'installer', 'runtime', 'authority', 'operator')
    return MappingProxyType({name: ('%02x' % (i+1) * 32).encode('ascii')
                             for i, name in enumerate(names)})

class FixturePath:
    def __init__(self, texts, name='sql'):
        self.texts, self.name = texts, name
    def __truediv__(self, name):
        if self.name != 'sql' or name not in self.texts:
            raise Blocked('Unapproved SQL fixture')
        return FixturePath(self.texts, name)
    def read_text(self, encoding):
        if encoding != 'utf-8' or self.name not in self.texts:
            raise Blocked('Fixture encoding/path mismatch')
        return self.texts[self.name]

class FaultConnection:
    def __init__(self, c, case, sql_texts):
        self.c, self.case, self.sql_texts = c, case, sql_texts
        self.files = self.alters = self.commits = 0
        self.alter_attempts = 0
        self.current_verifier = None
    def __getattr__(self, name): return getattr(self.c, name)
    def __enter__(self): return self
    def __exit__(self, kind, value, tb):
        if kind is not None: self.c.rollback()
        return False
    def execute(self, query, args=None, **kwargs):
        from psycopg import sql
        is_file = isinstance(query, str) and query in self.sql_texts.values()
        is_alter = isinstance(query, sql.Composed)
        if is_alter: self.alter_attempts += 1
        if is_file and self.files == 1 and self.case == 'second_sql_error':
            return self.c.execute('SELECT 1/0')
        if is_alter and self.case == 'statement_timeout':
            self.c.execute("SET LOCAL statement_timeout = '50ms'")
            return self.c.execute('SELECT pg_catalog.pg_sleep(0.2)')
        if is_alter and self.case == 'permission_denied':
            # Genuine reduced-privilege ALTER; restored by rollback, never committed.
            self.c.execute('SET LOCAL SESSION AUTHORIZATION fs_runtime_login')
        if is_alter and self.case in ('missing_role', 'alter_error'):
            # Same actual sensitive verifier; change only target to a nonexistent fixture role.
            query = sql.SQL('ALTER ROLE {} PASSWORD {}').format(
                sql.Identifier('fs_synthetic_missing_role'), sql.Literal(self.current_verifier))
        result = self.c.execute(query, args, **kwargs)
        if is_file:
            self.files += 1
            if self.case == 'after_sql_' + str(self.files): raise InjectedFailure()
        if is_alter:
            self.alters += 1
            if self.case == 'after_alter_' + str(self.alters): raise InjectedFailure()
        return result
    def commit(self):
        self.commits += 1
        if self.commits != 1: raise ScenarioFailure('Automatic commit retry')
        if self.case in ('explicit_rollback', 'commit_unknown_before'):
            self.c.rollback()
            if self.case == 'explicit_rollback': raise InjectedFailure()
            raise CommitUnknown()
        self.c.commit()
        if self.case == 'commit_unknown_after': raise CommitUnknown()

def catalogue(c):
    """No password/verifier columns; exact stable catalogue state for rollback."""
    queries = {
        'roles': "SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname LIKE 'fs_%' ORDER BY rolname",
        'schemas': "SELECT nspname,pg_get_userbyid(nspowner),nspacl::text FROM pg_namespace WHERE nspname IN ('fs_private','fs_api','public') ORDER BY nspname",
        'objects': "SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner),c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('fs_private','fs_api') ORDER BY 1,2",
        'functions': "SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('fs_private','fs_api') ORDER BY 1,2,3",
        'memberships': "SELECT parent.rolname,member.rolname,a.admin_option,a.inherit_option,a.set_option FROM pg_auth_members a JOIN pg_roles parent ON parent.oid=a.roleid JOIN pg_roles member ON member.oid=a.member WHERE parent.rolname LIKE 'fs_%' OR member.rolname LIKE 'fs_%' ORDER BY 1,2",
        'database_acl': "SELECT datacl::text FROM pg_database WHERE datname=current_database()",
        'defaults': "SELECT pg_get_userbyid(defaclrole),defaclnamespace,defaclobjtype,defaclacl::text FROM pg_default_acl WHERE pg_get_userbyid(defaclrole) LIKE 'fs_%' ORDER BY 1,2,3",
    }
    return {key: c.execute(query).fetchall() for key, query in queries.items()}

def installed_oracle(c, actual_verifiers):
    """Observable expected boundary. Any missing fact fails; no diagnostics output."""
    roles = c.execute("SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=ANY(%s) ORDER BY rolname",
        (['fs_owner','fs_runtime','fs_installer','fs_runtime_login','fs_authority','fs_operator'],)).fetchall()
    expected = {'fs_owner':False, 'fs_runtime':False, 'fs_installer':True,
                'fs_runtime_login':True, 'fs_authority':True, 'fs_operator':True}
    if len(roles) != 6 or any(row[1] is not expected[row[0]] or any(row[2:]) for row in roles):
        raise ScenarioFailure('Role flags oracle failed')
    schemas = c.execute("SELECT nspname,pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname IN ('fs_private','fs_api') ORDER BY 1").fetchall()
    if schemas != [('fs_api','fs_owner'),('fs_private','fs_owner')]: raise ScenarioFailure('Schema owner oracle failed')
    if c.execute('SELECT open FROM fs_private.admission WHERE id=1').fetchall() != [(False,)]: raise ScenarioFailure('Admission not CLOSED')
    if c.execute('SELECT enabled FROM fs_private.auth WHERE id=1').fetchall() != [(False,)]: raise ScenarioFailure('Authorization enabled')
    if c.execute('SELECT generation,n FROM fs_private.protected WHERE id=1').fetchall() != [(1,0)]: raise ScenarioFailure('Counter oracle failed')
    if c.execute("SELECT count(*),bool_and(pg_get_userbyid(c.relowner)='fs_owner') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fs_private' AND c.relkind='r'").fetchone() != (6,True): raise ScenarioFailure('Table ownership failed')
    if c.execute("SELECT bool_and(pg_get_userbyid(c.relowner)='fs_owner') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fs_private'").fetchone() != (True,): raise ScenarioFailure('Relation/sequence ownership failed')
    if c.execute("SELECT count(*),bool_and(pg_get_userbyid(p.proowner)='fs_owner' AND cardinality(p.proconfig)=1 AND replace(p.proconfig[1],' ','')='search_path=pg_catalog,pg_temp') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('fs_private','fs_api')").fetchone() != (9,True): raise ScenarioFailure('Function ownership/search path failed')
    for role in ('fs_runtime_login','fs_authority','fs_operator'):
        if c.execute("SELECT has_schema_privilege(%s,'fs_api','USAGE'),has_database_privilege(%s,current_database(),'CONNECT'),has_database_privilege(%s,current_database(),'CREATE,TEMPORARY')",(role,role,role)).fetchone() != (True,True,False): raise ScenarioFailure('API/database privilege oracle failed')
        if c.execute("SELECT pg_has_role(%s,'fs_owner','MEMBER') OR pg_has_role(%s,'fs_installer','MEMBER')",(role,role)).fetchone() != (False,): raise ScenarioFailure('Role escalation oracle failed')
        if c.execute("SELECT has_schema_privilege(%s,'fs_private','USAGE')",(role,)).fetchone() != (False,): raise ScenarioFailure('Private schema exposed')
        if c.execute("SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fs_private' AND c.relkind='r' AND has_table_privilege(%s,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))",(role,)).fetchone() != (False,): raise ScenarioFailure('Direct table privileges exposed')
        if c.execute("SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fs_private' AND c.relkind='S' AND has_sequence_privilege(%s,c.oid,'USAGE,SELECT,UPDATE'))",(role,)).fetchone() != (False,): raise ScenarioFailure('Direct sequence privileges exposed')
    if c.execute("SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname IN ('fs_private','fs_api') AND a.grantee=0 AND a.privilege_type='EXECUTE')").fetchone() != (False,): raise ScenarioFailure('PUBLIC execute exposed')
    if c.execute("SELECT EXISTS(SELECT 1 FROM pg_database d CROSS JOIN LATERAL aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) a WHERE d.datname=current_database() AND a.grantee=0)").fetchone() != (False,): raise ScenarioFailure('PUBLIC database privileges exposed')
    if c.execute("SELECT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public' AND a.grantee=0 AND a.privilege_type='CREATE')").fetchone() != (False,): raise ScenarioFailure('PUBLIC schema CREATE exposed')
    if c.execute("SELECT pg_has_role('fs_installer','fs_owner','MEMBER')").fetchone() != (True,): raise ScenarioFailure('Installer owner membership missing')
    if c.execute("SELECT EXISTS(SELECT 1 FROM pg_default_acl WHERE defaclrole='fs_owner'::regrole AND defaclnamespace=0 AND defaclobjtype='f'), NOT EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole='fs_owner'::regrole AND d.defaclnamespace=0 AND d.defaclobjtype='f' AND a.grantee=0 AND a.privilege_type='EXECUTE')").fetchone() != (True,True): raise ScenarioFailure('Default function ACL oracle failed')
    allowed = {'fs_runtime_login': {'begin_context','touch_guard','status','cluster_identity'},
               'fs_authority': {'set_authority','status','cluster_identity'},
               'fs_operator': {'close_admission','open_synthetic_admission','status','cluster_identity'}}
    for role, names in allowed.items():
        rows = c.execute("SELECT p.proname,has_function_privilege(%s,p.oid,'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('fs_private','fs_api')",(role,)).fetchall()
        if any(flag is not (name in names) for name,flag in rows): raise ScenarioFailure('Function privilege oracle failed')
    if len(actual_verifiers) != 4: raise ScenarioFailure('Verifier capture incomplete')
    for role,value in actual_verifiers.items():
        if c.execute('SELECT rolpassword=%s FROM pg_authid WHERE rolname=%s',(value,role)).fetchone() != (True,): raise ScenarioFailure('Password state oracle failed')

def run_case(gate, approved_transport, case, *, scanner=None, diagnostic_sink=None):
    """Explicit invocation only, one fresh synthetic cluster per case.

    Driver must capture stdout/stderr/logs and pass to Scanner separately. Return
    never claims logging PASS: collection is outside this adapter.
    """
    if type(gate) is not RunnerAdmission or case not in CASES:
        raise Blocked('Unknown integration admission/case')
    gate.require_case(case)
    values = synthetic_materials()
    scanner, captured = scanner if scanner is not None else Scanner(), {}
    for value in values.values(): scanner.register(value)
    attempts, commit_count, outcome = 0, 0, 'UNKNOWN'
    failure_state = None
    with gate.connection(approved_transport) as c:
        common, provision = load_targets()
        texts = {name: (gate.source_root/'sql'/name).read_text(encoding='utf-8')
                 for name in ('00_roles.sql','10_boundary.sql')}
        baseline = catalogue(c); c.rollback()
        if c.execute("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=ANY(%s))",(['fs_owner','fs_runtime','fs_installer','fs_runtime_login','fs_authority','fs_operator'],)).fetchone() != (False,): raise Blocked('Fresh cluster required')
        if c.execute("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('fs_private','fs_api'))").fetchone() != (False,): raise Blocked('Fresh synthetic namespaces required')
        c.rollback()
        proxy = FaultConnection(c, case, texts)
        original_scram = common.scram_verifier
        def capture(connection, role, value):
            result = original_scram(connection, role, value)
            scanner.register(result); captured[role] = result
            proxy.current_verifier = result
            return result
        def connect(snapshot):
            nonlocal attempts
            attempts += 1
            if attempts != 1 or any(snapshot[k] != v for k,v in values.items()): raise ScenarioFailure('Snapshot/retry oracle failed')
            return proxy
        with ExitStack() as stack:
            stack.enter_context(patch.dict(common.os.environ, {'FS_EXPECTED_CLUSTER':gate.manifest['expected_cluster_id']}))
            stack.enter_context(patch.object(provision,'_secret_snapshot',return_value=values))
            stack.enter_context(patch.object(provision,'_connect_bootstrap',side_effect=connect))
            stack.enter_context(patch.object(provision,'Path',side_effect=lambda name: FixturePath(texts,name)))
            stack.enter_context(patch.object(provision,'scram_verifier',side_effect=capture))
            try:
                provision.main()
                outcome = 'APPLIED'
            except CommitUnknown as error:
                outcome = 'COMMIT_UNKNOWN'
                if diagnostic_sink is not None: diagnostic_sink(error)
            except Exception as error:
                outcome = 'FAILED'
                failure_state = getattr(error,'sqlstate',None)
                if diagnostic_sink is not None: diagnostic_sink(error)
        commit_count = proxy.commits
        # Refusal in an earlier phase must NOT masquerade as the intended fault.
        phase = (proxy.files, proxy.alter_attempts, proxy.alters, proxy.commits)
        if case.startswith('after_sql_'):
            required_phase = (int(case[-1]),0,0,0)
        elif case.startswith('after_alter_'):
            n = int(case[-1]); required_phase = (2,n,n,0)
        elif case == 'second_sql_error':
            required_phase = (1,0,0,0)
        elif case in ('permission_denied','missing_role','alter_error','statement_timeout'):
            required_phase = (2,1,0,0)
        else:
            required_phase = (2,4,4,1)
        if phase != required_phase:
            raise ScenarioFailure('Required injection phase not reached')
        expected_states = {'permission_denied':'42501','missing_role':'42704',
                           'alter_error':'42704','statement_timeout':'57014',
                           'second_sql_error':'22012'}
        if case in expected_states and failure_state != expected_states[case]:
            raise ScenarioFailure('Expected SQL error class not observed')
    # Independent connection, independently re-admitted, no retry of provisioning.
    with gate.connection(approved_transport) as observer:
        after = catalogue(observer)
        if after == baseline:
            reconciled = 'NOT_APPLIED'
        else:
            installed_oracle(observer,captured)
            reconciled = 'FULLY_APPLIED'
        observer.rollback()
    expected = 'FULLY_APPLIED' if case in ('success','repeat','commit_unknown_after') else 'NOT_APPLIED'
    if reconciled != expected or attempts != 1 or commit_count > 1:
        raise ScenarioFailure('Atomicity/reconciliation failed; STOP')
    if case in ('success','repeat') and outcome != 'APPLIED':
        raise ScenarioFailure('Successful operation not confirmed')
    if case.startswith('commit_unknown') and outcome != 'COMMIT_UNKNOWN':
        raise ScenarioFailure('Commit ambiguity injection not reached')
    if case not in ('success','repeat','commit_unknown_before','commit_unknown_after') and outcome != 'FAILED':
        raise ScenarioFailure('Expected failure not observed')
    if case == 'repeat':
        with gate.connection(approved_transport) as repeat:
            repeated = FaultConnection(repeat,'success',texts)
            with ExitStack() as stack:
                stack.enter_context(patch.dict(common.os.environ, {'FS_EXPECTED_CLUSTER':gate.manifest['expected_cluster_id']}))
                stack.enter_context(patch.object(provision,'_secret_snapshot',return_value=values))
                stack.enter_context(patch.object(provision,'_connect_bootstrap',return_value=repeated))
                stack.enter_context(patch.object(provision,'Path',side_effect=lambda name: FixturePath(texts,name)))
                try: provision.main()
                except RuntimeError: repeat.rollback()
                else: raise ScenarioFailure('Explicit repeat unexpectedly allowed')
            if repeated.files or repeated.alters or repeated.commits or catalogue(repeat) != after:
                raise ScenarioFailure('Explicit repeat changed state')
            repeat.rollback()
    return {'case':case,'transaction_status':'PASS','reconciliation':reconciled,
            'attempts':attempts,'outcome':outcome,'diagnostics_status':'INCONCLUSIVE'}, scanner

def preflight_only(gate, approved_transport, *, expected_pass):
    """INTEGRATION after separately approved fixture setup; never repair GUC."""
    if type(gate) is not RunnerAdmission or type(expected_pass) is not bool:
        raise Blocked('Unknown preflight admission/expectation')
    with gate.connection(approved_transport) as c:
        common, _ = load_targets()
        before = catalogue(c)
        passed = False
        try:
            common.provisioning_logging_preflight(c)
            passed = True
        except RuntimeError:
            c.rollback()
        if passed is not expected_pass:
            raise ScenarioFailure('Preflight outcome mismatch')
        c.rollback()
    with gate.connection(approved_transport) as observer:
        if catalogue(observer) != before:
            raise ScenarioFailure('Preflight changed catalogue')
        observer.rollback()
    return {'preflight':'PASS','diagnostics_status':'INCONCLUSIVE'}

if __name__ == '__main__':
    raise SystemExit('BLOCKED: no approved execution driver/transport; no operation performed')
