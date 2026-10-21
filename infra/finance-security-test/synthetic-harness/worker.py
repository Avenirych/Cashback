"""Non-default runner entry point. Waits for private HELLO / GO / DIAGNOSTICS.

No Docker CLI/socket, mounts, lifecycle or arbitrary scenario dispatch. All
credentials are PUBLIC synthetic fixtures generated inside this process.
"""
import sys
from contextlib import redirect_stdout,redirect_stderr
from collector import Capture,decode_captures,scan_bundle,MAX_BYTES
from contract import Blocked
from protocol import LIMIT,decode,canonical,manifest_digest,check_binding,authorize,safe_report
from runner_gate import RunnerAdmission
from integration import CASES,run_case,synthetic_materials
from scanner import Scanner
from oracles import REQUIRED,acceptance,scenario_exception_status

CLIENT_BYTES=MAX_BYTES
CLIENT_FRAGMENTS=2048
CLIENT_FRAGMENT_BYTES=4096
CLIENT_TEXT_CHARS=1024

class MemoryText:
    """Single worker-owned sink; never stringify arbitrary objects or errors.

    Input already allocated by the caller is outside this sink's control.
    Encoding is incremental, including for a single very large write.
    """
    def __init__(self):
        self.parts=[]; self.size=0; self.truncated=False; self.stream_error=False
    def write(self,text):
        if type(text) not in (str,bytes):
            self.stream_error=True; self.truncated=True
            return 0
        length=len(text)
        if not length: return 0
        if self.truncated: return length
        offset=0
        while offset<length:
            room=CLIENT_BYTES-self.size
            if room<=0 or len(self.parts)>=CLIENT_FRAGMENTS:
                self.truncated=True; break
            if type(text) is str:
                count=min(CLIENT_TEXT_CHARS,length-offset)
                raw=text[offset:offset+count].encode('utf-8',errors='replace')
            else:
                count=min(CLIENT_FRAGMENT_BYTES,length-offset)
                raw=text[offset:offset+count]
            take=min(len(raw),room,CLIENT_FRAGMENT_BYTES)
            if take:
                self.parts.append(raw[:take]); self.size+=take
            if take<len(raw):
                self.truncated=True; break
            offset+=count
        return length
    def flush(self): pass
    def bytes(self):
        # Both the fragment list and joined copy have explicit upper bounds.
        return b''.join(self.parts)

def private_error(error,target):
    # str(error), custom __str__, chained diagnostics and concatenation can
    # allocate without bounds. Do not invoke them. Uninspected error material
    # makes this capture incomplete, never evidence that no secret was emitted.
    target.truncated=True

def send(packet):
    try:
        if packet.get('type')=='REPORT': safe_report(packet)
        raw=canonical(packet)+b'\n'
    except Exception:
        raise Blocked('Safe protocol serialization refused') from None
    if len(raw)>LIMIT: raise Blocked('Safe protocol frame too large')
    sys.stdout.buffer.write(raw); sys.stdout.buffer.flush()

def receive(): return decode(sys.stdin.buffer.readline(LIMIT+1))

def main():
    hello=receive()
    if set(hello)!={'type','manifest','manifest_sha256','nonce','case'}:
        raise Blocked('HELLO shape invalid')
    m,nonce,case=hello['manifest'],hello['nonce'],hello['case']
    check_binding(hello,m,nonce,case,'HELLO')
    if case not in CASES: raise Blocked('Scenario not allowlisted')
    gate=RunnerAdmission(m)
    server_route=gate.read_identity()  # Identity first, then read-only log routing.
    binding={'manifest_sha256':manifest_digest(m),'nonce':nonce,'case':case}
    send(dict(binding,type='READY',identity='PASS',server_route=server_route))
    gate.accept_host_go(receive(),nonce,case)
    scanner=Scanner()
    for value in synthetic_materials().values(): scanner.register(value)
    # A single shared byte/fragment budget for all worker-owned diagnostics.
    client=MemoryText()
    stdout=stderr=client
    facts={name:'NOT EXECUTED' for name in REQUIRED}
    facts['isolation']=facts['identity']='PASS'
    result=None
    try:
        with redirect_stdout(stdout),redirect_stderr(stderr):
            result,_=run_case(gate,None,case,scanner=scanner,
                              diagnostic_sink=lambda e: private_error(e,client))
        for name in ('preflight','snapshot_integrity','transaction_atomicity','acl_ownership','no_automatic_retry'):
            facts[name]='PASS'
        facts['scram']='PASS' if scanner.verifier_created else 'NOT EXECUTED'
        if result['outcome']=='COMMIT_UNKNOWN':
            # Reconciliation already performed; no retry, no general success grant.
            facts['no_automatic_retry']='BLOCKED'
    except Exception as error:
        private_error(error,client)
        facts['transaction_atomicity']=scenario_exception_status(error)
    send(dict(binding,type='DONE'))
    packet=receive()
    check_binding(packet,m,nonce,case,'DIAGNOSTICS')
    authorize(packet.get('approval'),'collect_diagnostics',m,case)
    start,end=packet['start'],packet['end']
    captures=decode_captures(packet['captures'])
    # Host data never supplies completeness for Docker logs. No retention proof
    # exists yet, so a modified packet cannot silently promote it to PASS.
    for record in captures:
        record.evidence='UNPROVEN'; record.gap=True
        record.collection_gap=True; record.completeness_unproven=True
        record.subprocess_complete=None; record.docker_history_complete=None
        record.postgres_diagnostics_complete=None; record.client_diagnostics_complete=None
    captures.append(Capture('client_diagnostics',m['runner']['container_id'],start,end,client.bytes(),
        evidence='APPROVED_BOUNDED_STREAM',gap=False,truncated=client.truncated,
        stream_error=client.stream_error,collection_gap=False,
        completeness_unproven=client.truncated or client.stream_error,
        client_diagnostics_complete=not client.truncated and not client.stream_error))
    diagnostics=scan_bundle(scanner,m,captures,start,end)
    facts['no_sensitive_client_diagnostics']=next(
        (r['status'] for r in diagnostics['channels'] if r['channel_id']=='client_diagnostics'),
        'INCONCLUSIVE')
    facts['no_verifier_in_inspected_logs']=diagnostics['status']
    facts['correct_exit_status']='PASS'  # outer controller also checks actual process exit.
    status=acceptance(facts,diagnostics=diagnostics)
    # Never print result/verifier/raw diagnostics/exception objects.
    send(dict(binding,type='REPORT',status=status,diagnostics=diagnostics,facts=facts,
              reconciliation=None if result is None else result['reconciliation']))
    return 0 if status=='PASS' else 2

if __name__=='__main__':
    try:
        raise SystemExit(main())
    except Exception:
        # Pre-identity/protocol failure: no SQL mutation, no raw diagnostics.
        try: send({'type':'BLOCKED','status':'BLOCKED'})
        except Exception: pass
        raise SystemExit(2)
