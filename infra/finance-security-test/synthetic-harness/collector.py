"""Bounded-scope synthetic diagnostics, memory only; never print Docker output.

Docker CLI routing is a candidate stdout/stderr separation, NOT completeness
evidence. CLI errors, TTY, driver retention/rotation and a live final interval
are explicitly UNPROVEN. No server-file log reads or docker exec are performed.
"""
import base64
import re
import subprocess
import threading
import time
from dataclasses import dataclass, field
from contract import Blocked, utc
from admission import check_docker
from scanner import CHANNELS, verdict
from oracles import DIAGNOSTIC_FLAGS, diagnostic_status

MAX_BYTES=2*1024*1024
TOTAL_SAVED_BYTES=MAX_BYTES
CHUNK=16*1024
STOP_GRACE=2.0
JOIN_GRACE=1.0
_SLOT=threading.BoundedSemaphore(1)

class ByteBudget:
    def __init__(self,limit=TOTAL_SAVED_BYTES):
        if type(limit) is not int or not 0<limit<=TOTAL_SAVED_BYTES:
            raise ValueError('Invalid capture budget')
        self.limit,self.used=limit,0
        self.lock=threading.Lock()

@dataclass
class Stream:
    payload: bytes | None = field(default=None,repr=False)
    truncated: bool=False
    stream_error: bool=False
    channel_missing: bool=False
    eof: bool=False

@dataclass
class ProcessCapture:
    stdout: Stream
    stderr: Stream
    timeout: bool=False
    nonzero_exit: bool=False
    cleanup_complete: bool=False
    exit_code: int | None=None

    def complete(self,stream):
        return (self.exit_code==0 and self.cleanup_complete is True
                and not self.timeout and not self.nonzero_exit and stream.eof is True
                and not stream.truncated and not stream.stream_error
                and not stream.channel_missing and stream.payload is not None)

def capture_process(argv,*,timeout=15,channel_limit=MAX_BYTES,budget):
    """Concurrent raw pipes. Budgets apply DURING reads, not after capture.

    No queues, communicate or whole-output read. At most two CHUNK temporary
    buffers; saved payload across calls shares budget. Freezing bytes may
    transiently double saved bytes. Exact Python allocator/RSS is not claimed.
    Only the diagnostic CLI process is terminated, NEVER a Docker container.
    """
    if (not isinstance(argv,(list,tuple)) or not argv
            or any(not isinstance(x,str) for x in argv)
            or type(channel_limit) is not int or not 0<channel_limit<=MAX_BYTES
            or not isinstance(timeout,(int,float)) or isinstance(timeout,bool)
            or not 0<timeout<=60 or not isinstance(budget,ByteBudget)):
        raise ValueError('Invalid bounded capture configuration')
    result=ProcessCapture(Stream(),Stream())
    if not _SLOT.acquire(blocking=False):
        for stream in (result.stdout,result.stderr):
            stream.stream_error=stream.channel_missing=True
        return result
    proc=None; reaped=False
    cancel=threading.Event(); guard=threading.Lock()
    states=[]; readers=[]; closers=[]
    deadline=time.monotonic()+timeout

    def close_pipe(state):
        try:
            state['pipe'].close()
            with guard: state['closed']=True
        except Exception:
            with guard: state['stream'].stream_error=True

    def read_pipe(state):
        try:
            while not cancel.is_set():
                chunk=state['pipe'].read(CHUNK)
                if not isinstance(chunk,bytes) or len(chunk)>CHUNK:
                    raise OSError('Binary reader contract violated')
                if not chunk:
                    with guard: state['stream'].eof=True
                    return
                with guard:
                    if cancel.is_set():
                        state['stream'].truncated=True
                        return
                    with budget.lock:
                        take=min(len(chunk),channel_limit-len(state['data']),budget.limit-budget.used)
                        if take>0:
                            state['data'].extend(memoryview(chunk)[:take]); budget.used+=take
                    if take<len(chunk):
                        state['stream'].truncated=True; cancel.set(); return
        except Exception:
            with guard: state['stream'].stream_error=True
            cancel.set()
        finally:
            close_pipe(state)

    def stop_and_reap():
        nonlocal reaped
        try:
            if proc.poll() is None:
                try: proc.terminate()
                except Exception:
                    for stream in (result.stdout,result.stderr): stream.stream_error=True
            try:
                result.exit_code=proc.wait(timeout=STOP_GRACE)
            except subprocess.TimeoutExpired:
                proc.kill(); result.exit_code=proc.wait(timeout=STOP_GRACE)
            reaped=True
        except Exception:
            for stream in (result.stdout,result.stderr): stream.stream_error=True

    try:
        proc=subprocess.Popen(list(argv),stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0,shell=False,close_fds=True)
        for name in ('stdout','stderr'):
            stream=getattr(result,name); pipe=getattr(proc,name,None)
            state={'stream':stream,'pipe':pipe,'data':bytearray(),'closed':False}
            states.append(state)
            if pipe is None:
                stream.channel_missing=stream.stream_error=True
                state['closed']=True; cancel.set()
            else:
                thread=threading.Thread(target=read_pipe,args=(state,),daemon=True)
                readers.append(thread); thread.start()
        while not cancel.is_set():
            remaining=deadline-time.monotonic()
            if remaining<=0:
                result.timeout=True; break
            code=proc.poll()
            if code is not None and all(not thread.is_alive() for thread in readers):
                result.exit_code=proc.wait(timeout=min(remaining,STOP_GRACE)); reaped=True; break
            cancel.wait(min(0.01,remaining))
    except Exception:
        for stream in (result.stdout,result.stderr):
            stream.stream_error=True
            if proc is None: stream.channel_missing=True
    finally:
        cancel.set()
        if proc is not None and not reaped: stop_and_reap()
        for thread in readers: thread.join(timeout=JOIN_GRACE)
        # Potentially blocking close is NEVER performed by the watchdog thread.
        for state in states:
            if state['pipe'] is not None and not state['closed']:
                thread=threading.Thread(target=close_pipe,args=(state,),daemon=True)
                closers.append(thread); thread.start()
        for thread in closers: thread.join(timeout=JOIN_GRACE)
        with guard:
            for state in states:
                stream=state['stream']; stream.payload=bytes(state['data']); state['data'].clear()
                if not stream.eof: stream.truncated=True
                if not state['closed']: stream.stream_error=True
        result.nonzero_exit=result.exit_code is not None and result.exit_code!=0
        result.cleanup_complete=(reaped and all(s['closed'] for s in states)
            and all(not thread.is_alive() for thread in readers+closers))
        if proc is not None and not result.cleanup_complete:
            for stream in (result.stdout,result.stderr): stream.stream_error=True
        if proc is None or result.cleanup_complete: _SLOT.release()
        # Otherwise keep the sole process-local lease CLOSED: no accumulation of
        # unknown children/readers on later calls. No automatic retry or cleanup.
    return result

@dataclass
class Capture:
    channel_id: str
    container_id: str
    start: str
    end: str
    payload: bytes | None = field(repr=False)
    evidence: str = 'UNPROVEN'
    gap: bool = True
    truncated: bool = False
    read_error: bool = False
    stream_error: bool = False
    collection_gap: bool | None = None
    completeness_unproven: bool = True
    timeout: bool = False
    nonzero_exit: bool = False
    channel_missing: bool = False
    source_mismatch: bool = False
    subprocess_complete: bool | None = None
    docker_history_complete: bool | None = None
    postgres_diagnostics_complete: bool | None = None
    client_diagnostics_complete: bool | None = None

FLAG_FIELDS=('stream_error','collection_gap','completeness_unproven','timeout',
             'nonzero_exit','channel_missing','source_mismatch','subprocess_complete',
             'docker_history_complete','postgres_diagnostics_complete','client_diagnostics_complete')

def capture_layers(record):
    if record.channel_id=='client_diagnostics':
        return {'subprocess':'N/A','docker_history':'N/A','postgresql':'N/A',
                'client':record.client_diagnostics_complete}
    return {'subprocess':record.subprocess_complete,'docker_history':record.docker_history_complete,
            'postgresql':record.postgres_diagnostics_complete if record.channel_id.startswith('pg_') else 'N/A',
            'client':'N/A'}

def capture_flags(record):
    layers=capture_layers(record)
    required={'client'} if record.channel_id=='client_diagnostics' else {'subprocess','docker_history'}
    if record.channel_id.startswith('pg_'): required.add('postgresql')
    proven=all(v is True if k in required else v=='N/A' for k,v in layers.items())
    return {'truncated':record.truncated is not False,
            'stream_error':record.stream_error is not False or record.read_error is not False,
            'collection_gap':record.gap is not False or record.collection_gap is not False,
            'completeness_unproven':record.completeness_unproven is not False or not proven
                or record.evidence!='APPROVED_BOUNDED_STREAM',
            'timeout':record.timeout is not False,'nonzero_exit':record.nonzero_exit is not False,
            'channel_missing':record.payload is None or record.channel_missing is not False,
            'source_mismatch':record.source_mismatch is not False}

def expected_source(m,channel):
    if channel.startswith('pg_'): return m['container_id']
    return m['runner']['container_id']

def verifier_scope(scanner):
    try:
        created=scanner.verifier_created
        return 'created' if created is True else 'not_created' if created is False else 'unknown'
    except Exception:
        return 'unknown'

def evidence_row(m,channel,start,end,record=None,scan=None):
    """Safe bounded metadata; no raw bytes/marker material crosses REPORT."""
    flags=({name:True for name in DIAGNOSTIC_FLAGS} if record is None else capture_flags(record))
    scanner_status='NOT_EXECUTED' if scan is None else scan['scanner_status']
    leak=scan is not None and scan['leak_detected'] is True
    layers={'client':'NOT_APPLICABLE','subprocess':'UNPROVEN',
            'docker_history':'UNPROVEN','postgresql':'UNPROVEN' if channel.startswith('pg_') else 'NOT_APPLICABLE'}
    if channel=='client_diagnostics':
        local=(record is not None and record.client_diagnostics_complete is True
               and not any(flags.values()))
        layers={'client':'COMPLETE' if local else 'UNPROVEN','subprocess':'NOT_APPLICABLE',
                'docker_history':'NOT_APPLICABLE','postgresql':'NOT_APPLICABLE'}
    else:
        # A worker report cannot independently attest any external stream.
        flags['completeness_unproven']=True
    source=expected_source(m,channel)
    if record is not None:
        if type(record.container_id) is str and re.fullmatch(r'[a-f0-9]{64}',record.container_id):
            source=record.container_id
        else:
            flags['source_mismatch']=True
    status=diagnostic_status(flags,leak_detected=leak,scanner_ok=scanner_status=='COMPLETE')
    return dict(channel_id=channel,source_identity={
        'container_id':source,
        'kind':'worker_client' if channel=='client_diagnostics' else
               'postgresql_route' if channel=='pg_server_logs' else 'docker_stream'},
        collection_start=start,collection_end=end,
        captured_bytes=0 if record is None or record.payload is None else min(MAX_BYTES,len(record.payload)),
        byte_limit=MAX_BYTES,scanner_status=scanner_status,leak_detected=leak,
        completeness_status='COMPLETE' if status=='PASS' else 'UNPROVEN',
        capture_layers=layers,collection_complete=status=='PASS',status=status,**flags)

def scan_bundle(scanner,m,captures,start,end):
    """Missing/duplicated/unknown channels cannot make absence-of-leaks PASS."""
    results=[]; known_leak=False
    grouped={channel:[] for channel in CHANNELS}
    remaining=4*MAX_BYTES
    try:
        if utc(end)<utc(start): raise Blocked('Capture interval invalid')
        if not isinstance(captures,list) or len(captures)>2*len(CHANNELS):
            raise Blocked('Capture bundle size invalid')
        complete_bundle=(len(captures)==len(CHANNELS)
            and all(isinstance(x,Capture) for x in captures)
            and {x.channel_id for x in captures}==CHANNELS)
        for record in captures:
            if not isinstance(record,Capture): continue
            if record.channel_id not in CHANNELS:
                complete_bundle=False
                # Unknown source cannot pass, but still inspect bounded bytes
                # for a positive synthetic leak without exposing its label.
                result=scanner.inspect('client_diagnostics',record.payload,complete=False,
                                       max_bytes=min(MAX_BYTES,remaining))
                remaining-=result['inspected_bytes']; known_leak|=result['leak_detected'] is True
                continue
            try:
                matches=(record.container_id==expected_source(m,record.channel_id)
                    and utc(record.start)==utc(start) and utc(record.end)==utc(end))
            except Exception: matches=False
            if not matches: record.source_mismatch=True
            if not complete_bundle: record.collection_gap=True
            flags=capture_flags(record)
            initial=diagnostic_status(flags,leak_detected=False,scanner_ok=True)
            result=scanner.inspect(record.channel_id,record.payload,complete=initial=='PASS',
                                   max_bytes=min(MAX_BYTES,remaining))
            remaining-=result['inspected_bytes']
            known_leak|=result['leak_detected'] is True
            record.truncated=record.truncated is not False or result['truncated']
            record.stream_error=record.stream_error is not False or result['stream_error']
            grouped[record.channel_id].append(evidence_row(m,record.channel_id,start,end,record,result))
        for channel in sorted(CHANNELS):
            rows=grouped[channel]
            leak=any(row['leak_detected'] is True for row in rows)
            row=rows[0] if complete_bundle and len(rows)==1 else evidence_row(m,channel,start,end)
            if leak:
                row['leak_detected']=True; row['status']='FAIL'
                row['collection_complete']=False; row['completeness_status']='UNPROVEN'
            results.append(row)
        if known_leak and not any(r['leak_detected'] for r in results):
            # Unknown-source positive remains a FAIL with explicit mismatch,
            # without serializing the untrusted source label or raw evidence.
            row=next(r for r in results if r['channel_id']=='client_diagnostics')
            row.update(leak_detected=True,source_mismatch=True,status='FAIL',
                       collection_complete=False,completeness_status='UNPROVEN')
        legacy=[dict(r,channel=r['channel_id']) for r in results]
        return {'status':'FAIL' if known_leak else verdict(legacy),'channels':results,
                'verifier_scope':verifier_scope(scanner)}
    except Exception:
        # Never echo scanner exceptions. Keep mandatory structured fields even
        # when inspection fails; a previously detected leak stays sticky.
        rows=[evidence_row(m,ch,start,end) for ch in sorted(CHANNELS)]
        for row in rows: row['scanner_status']='ERROR'
        if known_leak:
            rows[0].update(leak_detected=True,status='FAIL')
        return {'status':'FAIL' if known_leak else 'INCONCLUSIVE','channels':rows,
                'verifier_scope':verifier_scope(scanner)}

def collect_docker(m,docker,start,end,*,server_route=None):
    """Read exact approved containers ONLY, after separate collection approval.

    No caller can turn ordinary Docker logs into a complete evidence claim here.
    Separate driver-proven bounds/retention are still required for future PASS.
    """
    check_docker(m,docker)
    utc(start); utc(end)
    captures=[]
    budget=ByteBudget()
    abort=False
    for prefix,container_id in [('pg',m['container_id']),('runner',m['runner']['container_id'])]:
        p=docker.inspect('container',container_id)
        if p['Config']['Tty'] is not False:
            raise Blocked('TTY prevents reliable stream separation')
        log_kind=p['HostConfig']['LogConfig']['Type']
        result=None
        if not abort and log_kind in ('json-file','local'):
            try:
                result=capture_process([docker.executable,'--context',m['docker_context'],'logs','--timestamps',
                    '--since',start,'--until',end,'--tail','10000',container_id],
                    timeout=15,channel_limit=MAX_BYTES,budget=budget)
            except Exception:
                result=None
        if result is None or not result.cleanup_complete or result.timeout or result.nonzero_exit:
            abort=True
        for suffix in ('stdout','stderr'):
            stream=None if result is None else getattr(result,suffix)
            data=None if stream is None else stream.payload
            if stream is not None and (stream.truncated or stream.stream_error or stream.channel_missing): abort=True
            captures.append(Capture(prefix+'_'+suffix,container_id,start,end,data,
                truncated=stream.truncated if stream is not None else False,
                read_error=stream is None or stream.stream_error,
                stream_error=stream is None or stream.stream_error,
                collection_gap=True,completeness_unproven=True,
                timeout=result.timeout if result is not None else False,
                nonzero_exit=result.nonzero_exit if result is not None else False,
                channel_missing=stream is None or stream.channel_missing,
                subprocess_complete=result.complete(stream) if stream is not None else None,
                docker_history_complete=None,postgres_diagnostics_complete=None))
    # Route comes from SELECT after runner SQL identity. No file-log transport
    # is assumed; known stderr routing aliases the SAME unproven stream.
    stderr=next(r for r in captures if r.channel_id=='pg_stderr')
    captures.append(Capture('pg_server_logs',m['container_id'],start,end,
        stderr.payload if server_route=='stderr_only' else None,
        truncated=stderr.truncated,read_error=stderr.read_error,
        stream_error=stderr.stream_error,collection_gap=True,completeness_unproven=True,
        timeout=stderr.timeout,nonzero_exit=stderr.nonzero_exit,
        channel_missing=server_route!='stderr_only' or stderr.channel_missing,
        subprocess_complete=stderr.subprocess_complete,docker_history_complete=None,
        postgres_diagnostics_complete=None))
    return captures

def encode_captures(captures):
    """Private stdin frame only, NEVER argv/report/persisted raw diagnostics."""
    return [dict(channel_id=x.channel_id,container_id=x.container_id,start=x.start,end=x.end,
                 payload=None if x.payload is None else base64.b64encode(x.payload).decode('ascii'),
                 evidence=x.evidence,gap=x.gap,truncated=x.truncated,read_error=x.read_error,
                 flags={name:getattr(x,name) for name in FLAG_FIELDS})
            for x in captures]

def decode_captures(rows):
    results=[]
    total=0
    if not isinstance(rows,list) or len(rows)>len(CHANNELS): raise Blocked('Capture count invalid')
    for row in rows:
        old={'channel_id','container_id','start','end','payload','evidence','gap','truncated','read_error'}
        if set(row) not in (old,old|{'flags'}):
            raise Blocked('Capture packet invalid')
        if row['payload'] is not None and (not isinstance(row['payload'],str)
                or len(row['payload'])>4*((MAX_BYTES+2)//3)):
            raise Blocked('Encoded capture too large')
        data=None if row['payload'] is None else base64.b64decode(row['payload'],validate=True)
        if data is not None and len(data)>MAX_BYTES: raise Blocked('Capture packet too large')
        total+=0 if data is None else len(data)
        if total>2*TOTAL_SAVED_BYTES: raise Blocked('Aggregate capture too large')
        flags=row.get('flags',{})
        if (flags and set(flags)!=set(FLAG_FIELDS)) or any(v is not None and type(v) is not bool for v in flags.values()):
            raise Blocked('Capture flags invalid')
        results.append(Capture(row['channel_id'],row['container_id'],row['start'],row['end'],data,
            row['evidence'],row['gap'],row['truncated'],row['read_error'],**flags))
    return results
