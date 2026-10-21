"""In-runner half of the trusted host/attached-stdin protocol.

Host Docker isolation is not inferred from SQL. Host must send a matching GO
only after inspecting the ACTUAL running runner ID and network. Docker/host
administrators and hostile same-process code remain outside this boundary.
"""
import json
from contextlib import contextmanager
from pathlib import Path
from admission import check_identity, check_sources
from contract import Blocked, ScenarioFailure, validate_manifest

class RunnerAdmission:
    def __init__(self,manifest):
        validate_manifest(manifest)
        if 'runner' not in manifest: raise Blocked('Runner manifest missing')
        self._frozen=json.dumps(manifest,sort_keys=True)
        self.source_root=Path(__file__).resolve().parent.parent
        self._host_go=False
        self._approved_case=None

    @property
    def manifest(self): return json.loads(self._frozen)

    def _open(self):
        import psycopg
        from integration import synthetic_materials
        return psycopg.connect(host='pg',port=5432,dbname=self.manifest['database'],
            user=self.manifest['bootstrap_user'],password=synthetic_materials()['bootstrap'].decode('ascii'),
            connect_timeout=5,autocommit=False,
            options='-c statement_timeout=15000 -c lock_timeout=10000')

    def read_identity(self):
        check_sources(self.manifest,self.source_root)
        c=None
        try:
            c=self._open()
            check_identity(c,self.manifest)
            rows=c.execute("SELECT name,setting,pending_restart FROM pg_catalog.pg_settings WHERE name IN ('logging_collector','log_destination')").fetchall()
            settings={r[0]:r[1] for r in rows}
            route=('stderr_only' if len(rows)==2 and settings=={'logging_collector':'off','log_destination':'stderr'}
                   and all(r[2] is False for r in rows) else 'unknown')
            c.rollback()
            return route
        except Exception:
            raise Blocked('In-runner SQL identity refused') from None
        finally:
            if c is not None: c.close()

    def accept_host_go(self,packet,nonce,case):
        # Called only by worker after protocol binding + run-scenario approval.
        from protocol import check_binding, authorize
        check_binding(packet,self.manifest,nonce,case,'GO')
        authorize(packet.get('approval'),'run_scenario',self.manifest,case)
        if self._host_go: raise Blocked('Repeated host grant refused')
        self._host_go=True
        self._approved_case=case

    def require_case(self,case):
        if self._host_go is not True or case!=self._approved_case:
            raise Blocked('Scenario outside host approval')

    @contextmanager
    def connection(self,approved_transport):
        c=None
        try:
            if self._host_go is not True or approved_transport is not None:
                raise Blocked('Host admission grant missing')
            check_sources(self.manifest,self.source_root)
            c=self._open()
            if c.closed or c.autocommit: raise Blocked('Transactional transport required')
            check_identity(c,self.manifest)
            yield c
        except Exception as error:
            if c is not None:
                try: c.rollback()
                except Exception: pass
            if isinstance(error,ScenarioFailure):
                raise ScenarioFailure('Synthetic scenario oracle failed') from None
            raise Blocked('Runner operation refused; reconcile uncertain commit') from None
        finally:
            if c is not None:
                try: c.close()
                except Exception: raise Blocked('Runner connection cleanup failed') from None
