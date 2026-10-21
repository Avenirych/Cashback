"""Future explicitly approved START of an already-created exact runner only.

No CLI entry point that launches anything, no create/build/pull/up/remove/stop.
Private stdin carries only manifest/grants and in-memory diagnostics, no argv
credentials. No retry on transport loss: possible commit requires reconciliation.
"""
import queue
import secrets
import subprocess
import threading
from datetime import datetime,timezone
from pathlib import Path
from admission import DockerReadOnly,check_docker,check_runner,check_sources
from collector import collect_docker,encode_captures
from contract import Blocked,validate_manifest
from protocol import LIMIT,canonical,decode,manifest_digest,authorize,check_binding,no_duplicates,safe_report
from integration import CASES
from oracles import acceptance
import json

def load_manifest(path):
    try:
        return validate_manifest(json.loads(Path(path).read_text(encoding='utf-8'),
                                            object_pairs_hook=no_duplicates))
    except Exception:
        raise Blocked('Strict manifest load refused') from None

class Attached:
    def __init__(self,executable,manifest,case,start_approval):
        m=json.loads(canonical(validate_manifest(manifest)))
        if case not in CASES or 'runner' not in m:
            raise Blocked('Approved runner/case required')
        authorize(start_approval,'start_runner',m,case)
        docker=DockerReadOnly(executable)
        check_docker(m,docker); check_runner(m,docker,phase='created')
        check_sources(m,Path(__file__).resolve().parent.parent)
        self.p=subprocess.Popen([executable,'--context','desktop-linux','start','--attach','--interactive',m['runner']['container_id']],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        self.frames=queue.Queue(maxsize=8)
        self.stderr=bytearray(); self.stderr_truncated=False
        def out():
            try:
                while True:
                    line=self.p.stdout.readline(LIMIT+1)
                    if not line: self.frames.put(None); return
                    if len(line)>LIMIT: self.frames.put(None); return
                    self.frames.put(line)
            except Exception: self.frames.put(None)
        def err():
            try:
                while True:
                    part=self.p.stderr.read(4096)
                    if not part: return
                    room=max(0,LIMIT-len(self.stderr))
                    self.stderr.extend(part[:room])
                    if len(part)>room: self.stderr_truncated=True
            except Exception: self.stderr_truncated=True
        self.out_thread=threading.Thread(target=out,daemon=True)
        self.err_thread=threading.Thread(target=err,daemon=True)
        self.out_thread.start(); self.err_thread.start()
    def send(self,packet):
        raw=canonical(packet)+b'\n'
        if len(raw)>LIMIT: raise Blocked('Protocol payload too large')
        self.p.stdin.write(raw); self.p.stdin.flush()
    def receive(self):
        try:
            return decode(self.frames.get(timeout=60))
        except Exception:
            raise Blocked('Transport interrupted; reconcile before any retry') from None
    def finish(self):
        self.p.stdin.close()
        code=self.p.wait(timeout=30)
        self.out_thread.join(timeout=2); self.err_thread.join(timeout=2)
        if self.out_thread.is_alive() or self.err_thread.is_alive():
            self.stderr_truncated=True
        return code
    def disconnect(self):
        # Close attachment only. NO container lifecycle cleanup or SQL retry.
        try: self.p.stdin.close()
        except Exception: pass
        try:
            if self.p.poll() is None: self.p.terminate()
        except Exception: pass

def execute(manifest,docker_executable,case,*,start_approval,test_approval,diagnostic_approval):
    """One scenario per pre-created runner. Every scope separately explicit."""
    transport=None
    try:
        m=json.loads(canonical(validate_manifest(manifest)))
        if 'runner' not in m or case not in CASES: raise Blocked('Runner/case missing')
        for approval,scope in ((start_approval,'start_runner'),(test_approval,'run_scenario'),
                               (diagnostic_approval,'collect_diagnostics')):
            authorize(approval,scope,m,case)
        docker=DockerReadOnly(docker_executable)
        check_docker(m,docker); check_runner(m,docker,phase='created')
        check_sources(m,Path(__file__).resolve().parent.parent)
        nonce=secrets.token_hex(16)
        binding={'manifest_sha256':manifest_digest(m),'nonce':nonce,'case':case}
        start=datetime.now(timezone.utc).isoformat()
        transport=Attached(docker_executable,m,case,start_approval)
        transport.send(dict(binding,type='HELLO',manifest=m))
        ready=transport.receive()
        check_binding(ready,m,nonce,case,'READY')
        if ready.get('identity')!='PASS': raise Blocked('Runner identity not confirmed')
        if ready.get('server_route') not in ('stderr_only','unknown'):
            raise Blocked('Unknown log routing metadata')
        check_docker(m,docker); check_runner(m,docker,phase='running')
        # Only this matching grant admits tests; starting worker alone cannot.
        transport.send(dict(binding,type='GO',approval=test_approval))
        check_binding(transport.receive(),m,nonce,case,'DONE')
        end=datetime.now(timezone.utc).isoformat()
        captures=collect_docker(m,docker,start,end,server_route=ready['server_route'])
        transport.send(dict(binding,type='DIAGNOSTICS',approval=diagnostic_approval,
                            start=start,end=end,captures=encode_captures(captures)))
        report=transport.receive()
        check_binding(report,m,nonce,case,'REPORT')
        safe_report(report)
        code=transport.finish()
        if report.get('status') not in ('PASS','FAIL','BLOCKED','INCONCLUSIVE','NOT EXECUTED'):
            raise Blocked('Unknown runner status')
        if code != (0 if report['status']=='PASS' else 2):
            report['facts']['correct_exit_status']='FAIL'
        if transport.stderr or transport.stderr_truncated:
            # Host CLI diagnostics are not proven identical to container stderr.
            report['facts']['no_sensitive_client_diagnostics']='INCONCLUSIVE'
        report['status']=acceptance(report['facts'])
        # Only known safe schema from the pinned worker, never stdout/error dumps.
        return {'status':report['status'],'exit_code':code,'diagnostics':report.get('diagnostics'),
                'facts':report.get('facts'),'reconciliation':report.get('reconciliation')}
    except Exception:
        return {'status':'BLOCKED','reason':'GATE_OR_TRANSPORT_FAILURE_RECONCILE_NO_RETRY'}
    finally:
        if transport is not None: transport.disconnect()

if __name__=='__main__':
    raise SystemExit('BLOCKED: explicit scoped approvals required; no resources changed')
