"""In-memory SYNTHETIC material only. Never return values or matching fragments."""
import base64
import json
import re

CHANNELS = frozenset({'pg_stdout', 'pg_stderr', 'pg_server_logs',
                      'runner_stdout', 'runner_stderr', 'client_diagnostics'})
SCAN_LIMIT=2*1024*1024
SCAN_CHUNK=16*1024
MAX_CHUNKS=16384
MAX_MARKERS=32
MAX_MATERIAL=4096

class Scanner:
    def __init__(self):
        self._needles = set()
        self.verifier_created = False
        self._materials=set()
        self._longest=0

    def register(self, material):
        if not isinstance(material,(str,bytes)) or not 16<=len(material)<=MAX_MATERIAL:
            raise ValueError('Synthetic marker invalid')
        if isinstance(material, str):
            try: material = material.encode('ascii')
            except UnicodeError: raise ValueError('Synthetic marker must be ASCII') from None
        if not isinstance(material, bytes) or len(material) < 16:
            raise ValueError('Synthetic marker invalid')
        try:
            text = material.decode('ascii')
        except UnicodeError:
            raise ValueError('Synthetic marker must be ASCII') from None
        if material in self._materials: return
        if len(self._materials)>=MAX_MARKERS: raise ValueError('Synthetic marker budget exceeded')
        self._materials.add(material)
        self._needles.update({material, base64.b64encode(material), material.hex().encode('ascii'),
                              json.dumps(text)[1:-1].encode('ascii')})
        # Significant fragments are bounded, explicit coverage, not universal.
        self._needles.update(material[i:i+16] for i in range(0, len(material)-15, 8))
        if text.startswith('SCRAM-SHA-256$'):
            self.verifier_created = True
            for part in re.split(r'[$:]', text)[2:]:
                if len(part) >= 16:
                    self._needles.add(part.encode('ascii'))
        self._longest=max(map(len,self._needles))

    def inspect(self, channel, payload, *, complete, max_bytes=SCAN_LIMIT):
        if channel not in CHANNELS:
            raise ValueError('Channel not allowlisted')
        if payload is not None and not isinstance(payload, bytes):
            raise ValueError('Channel must be bytes')
        chunks=None if payload is None else (memoryview(payload)[i:i+SCAN_CHUNK]
                for i in range(0,len(payload),SCAN_CHUNK))
        return self.inspect_chunks(channel,chunks,complete=complete,max_bytes=max_bytes)

    def inspect_chunks(self,channel,chunks,*,complete,max_bytes=SCAN_LIMIT):
        if channel not in CHANNELS or type(max_bytes) is not int or not 0<=max_bytes<=SCAN_LIMIT:
            raise ValueError('Invalid bounded scan configuration')
        detected=False; truncated=False; stream_error=False; used=0; carry=b''
        try:
            if chunks is not None:
                for index,chunk in enumerate(chunks):
                    if index>=MAX_CHUNKS:
                        truncated=True; break
                    if not isinstance(chunk,(bytes,memoryview)):
                        raise ValueError('Binary scan chunk required')
                    view=memoryview(chunk).cast('B'); offset=0
                    while offset<len(view):
                        take=min(SCAN_CHUNK,len(view)-offset,max_bytes-used)
                        if take<=0:
                            truncated=True; break
                        window=carry+bytes(view[offset:offset+take])
                        detected=detected or any(needle in window for needle in self._needles)
                        carry=window[-(self._longest-1):] if self._longest>1 else b''
                        offset+=take; used+=take
                    if offset<len(view):
                        truncated=True; break
        except Exception:
            stream_error=True
            truncated=True
        known_complete=(complete is True and chunks is not None and bool(self._needles)
                        and not truncated and not stream_error)
        return {'channel':channel,'channel_id':channel,'leak_detected':detected,
                'collection_complete':known_complete,'truncated':truncated,
                'stream_error':stream_error,'inspected_bytes':used,
                'scanner_status':'ERROR' if stream_error else
                    ('INCOMPLETE' if truncated else
                     'COMPLETE' if chunks is not None and self._needles else 'NOT_EXECUTED'),
                'status':'FAIL' if detected else ('PASS' if known_complete else 'INCONCLUSIVE')}

def verdict(results):
    if not isinstance(results, list) or any(not isinstance(r, dict) for r in results):
        return 'INCONCLUSIVE'
    if any(r.get('leak_detected') is True for r in results):
        return 'FAIL'
    if (not results or {r.get('channel') for r in results} != CHANNELS
            or len(results) != len(CHANNELS)):
        return 'INCONCLUSIVE'
    return 'PASS' if all(r.get('status') == 'PASS' and r.get('collection_complete') is True
                         and r.get('truncated',False) is False and r.get('stream_error',False) is False
                         and r.get('leak_detected') is False for r in results) else 'INCONCLUSIVE'
