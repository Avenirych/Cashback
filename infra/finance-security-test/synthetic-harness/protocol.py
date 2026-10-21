"""Private attached-stdin protocol. Not a public TCP authority endpoint."""
import hashlib
import json
import re
from contract import Blocked, validate_manifest

LIMIT = 8*1024*1024
EVIDENCE_LIMIT=2*1024*1024
LAYER_NAMES={'client','subprocess','docker_history','postgresql'}
LAYER_VALUES={'COMPLETE','UNPROVEN','NOT_APPLICABLE'}

def validate_diagnostics(value):
    """Validate bounded metadata ONLY, not an external-history attestation.

    Worker may attest its own client capture. There is no trusted external
    completeness proof in this protocol version; external COMPLETE is refused.
    """
    from scanner import CHANNELS
    from oracles import DIAGNOSTIC_FLAGS,diagnostic_status
    from contract import utc
    try:
        if (type(value) is not dict or set(value)!={'status','channels','verifier_scope'}
                or value['status'] not in ('PASS','FAIL','INCONCLUSIVE')
                or value['verifier_scope'] not in ('created','not_created','unknown')
                or type(value['channels']) is not list or len(value['channels'])>len(CHANNELS)):
            raise ValueError
        seen=set()
        fields={'channel_id','source_identity','collection_start','collection_end',
                'captured_bytes','byte_limit','scanner_status','leak_detected',
                'completeness_status','capture_layers','collection_complete','status'}|set(DIAGNOSTIC_FLAGS)
        for row in value['channels']:
            if type(row) is not dict or set(row)!=fields: raise ValueError
            channel=row['channel_id']
            if type(channel) is not str or channel not in CHANNELS or channel in seen: raise ValueError
            seen.add(channel)
            source=row['source_identity']
            kind=('worker_client' if channel=='client_diagnostics' else
                  'postgresql_route' if channel=='pg_server_logs' else 'docker_stream')
            if (type(source) is not dict or set(source)!={'container_id','kind'}
                    or source['kind']!=kind or type(source['container_id']) is not str
                    or re.fullmatch(r'[a-f0-9]{64}',source['container_id']) is None): raise ValueError
            for key in ('collection_start','collection_end'):
                if type(row[key]) is not str or not 1<=len(row[key])<=40: raise ValueError
            if utc(row['collection_end'])<utc(row['collection_start']): raise ValueError
            if (type(row['byte_limit']) is not int or row['byte_limit']!=EVIDENCE_LIMIT
                    or type(row['captured_bytes']) is not int
                    or not 0<=row['captured_bytes']<=row['byte_limit']): raise ValueError
            if any(type(row[k]) is not bool for k in (*DIAGNOSTIC_FLAGS,'leak_detected','collection_complete')):
                raise ValueError
            if row['scanner_status'] not in ('COMPLETE','INCOMPLETE','ERROR','NOT_EXECUTED'): raise ValueError
            layers=row['capture_layers']
            if (type(layers) is not dict or set(layers)!=LAYER_NAMES
                    or any(type(v) is not str or v not in LAYER_VALUES for v in layers.values())):
                raise ValueError
            if channel=='client_diagnostics':
                if any(layers[k]!='NOT_APPLICABLE' for k in LAYER_NAMES-{'client'}): raise ValueError
                required=('client',)
            else:
                if (layers['client']!='NOT_APPLICABLE'
                        or layers['subprocess']!='UNPROVEN' or layers['docker_history']!='UNPROVEN'
                        or layers['postgresql']!=('UNPROVEN' if channel.startswith('pg_') else 'NOT_APPLICABLE')):
                    raise ValueError
                required=('subprocess','docker_history')+ (('postgresql',) if channel.startswith('pg_') else ())
            complete=all(layers[k]=='COMPLETE' for k in required)
            if not complete and row['completeness_unproven'] is not True: raise ValueError
            flags={k:row[k] for k in DIAGNOSTIC_FLAGS}
            status=diagnostic_status(flags,leak_detected=row['leak_detected'],
                                     scanner_ok=row['scanner_status']=='COMPLETE')
            if (row['status']!=status or row['collection_complete'] is not (status=='PASS')
                    or row['completeness_status']!=('COMPLETE' if status=='PASS' else 'UNPROVEN')):
                raise ValueError
        overall=('FAIL' if any(r['leak_detected'] for r in value['channels']) else
                 'PASS' if seen==CHANNELS and all(r['status']=='PASS' for r in value['channels']) else 'INCONCLUSIVE')
        if value['status']!=overall: raise ValueError
        return value
    except Exception:
        raise Blocked('Structured diagnostic evidence refused') from None

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':')).encode('ascii')

def manifest_digest(m):
    return hashlib.sha256(canonical(validate_manifest(m))).hexdigest()

def no_duplicates(pairs):
    result = {}
    for key,value in pairs:
        if key in result: raise Blocked('Duplicate protocol key')
        result[key]=value
    return result

def decode(raw):
    try:
        if not isinstance(raw,bytes) or not raw.endswith(b'\n') or len(raw)>LIMIT:
            raise Blocked('Protocol frame incomplete')
        value=json.loads(raw,object_pairs_hook=no_duplicates)
        if not isinstance(value,dict): raise Blocked('Protocol frame invalid')
        return value
    except Exception:
        raise Blocked('Protocol frame refused') from None

def authorize(approval,scope,m,case):
    # Approval file is an operator-reviewed scope record, NOT a production auth token.
    if (not isinstance(approval,dict)
            or set(approval)!={'scope','manifest_sha256','runner_id','case','approved'}
            or approval['scope']!=scope or approval['approved'] is not True
            or approval['manifest_sha256']!=manifest_digest(m)
            or approval['runner_id']!=m['runner']['container_id'] or approval['case']!=case):
        raise Blocked('Separate explicit approval required')

def check_binding(packet,m,nonce,case,kind):
    if (packet.get('type')!=kind or packet.get('manifest_sha256')!=manifest_digest(m)
            or packet.get('nonce')!=nonce or packet.get('case')!=case
            or re.fullmatch(r'[a-f0-9]{32}',nonce or '') is None):
        raise Blocked('Session binding mismatch')

def safe_report(report):
    """Reject unknown report keys/values rather than forwarding worker output."""
    from scanner import CHANNELS
    from oracles import REQUIRED,acceptance
    from integration import CASES
    statuses={'PASS','FAIL','BLOCKED','INCONCLUSIVE','NOT EXECUTED'}
    if (type(report) is not dict
            or set(report)!={'type','manifest_sha256','nonce','case','status','diagnostics','facts','reconciliation'}
            or report['type']!='REPORT'
            or type(report['manifest_sha256']) is not str
            or re.fullmatch(r'[a-f0-9]{64}',report['manifest_sha256']) is None
            or type(report['nonce']) is not str or re.fullmatch(r'[a-f0-9]{32}',report['nonce']) is None
            or type(report['case']) is not str or report['case'] not in CASES
            or type(report['facts']) is not dict
            or report['status'] not in statuses or set(report['facts'])!=REQUIRED
            or any(v not in statuses for v in report['facts'].values())
            or report['status']!=acceptance(report['facts'],diagnostics=report['diagnostics'])
            or report['reconciliation'] not in (None,'FULLY_APPLIED','NOT_APPLIED')):
        raise Blocked('Safe report contract mismatch')
    diagnostics=validate_diagnostics(report['diagnostics'])
    if any(row['leak_detected'] for row in diagnostics['channels']) and diagnostics['status']!='FAIL':
        raise Blocked('Detected leak status suppressed')
    if diagnostics['status']=='PASS' and (
            len(diagnostics['channels'])!=len(CHANNELS)
            or {r['channel_id'] for r in diagnostics['channels']}!=CHANNELS
            or any(r['status']!='PASS' or not r['collection_complete'] or r['leak_detected']
                   for r in diagnostics['channels'])):
        raise Blocked('Incomplete channels cannot pass')
    if report['facts']['no_verifier_in_inspected_logs']!=diagnostics['status']:
        raise Blocked('Diagnostic oracle mismatch')
    client=next((r['status'] for r in diagnostics['channels'] if r['channel_id']=='client_diagnostics'),
                'INCONCLUSIVE')
    if report['facts']['no_sensitive_client_diagnostics']!=client:
        raise Blocked('Client diagnostic oracle mismatch')
    return report
