"""UNIT/MOCK only: in-memory binary pipes, never a real subprocess or Docker."""
import io
import subprocess
import threading
import unittest
from unittest.mock import patch
import collector
from scanner import Scanner

class Pipe:
    def __init__(self,data,stop,*,block=False,read_error=False,close_error=False):
        self.raw=io.BytesIO(data); self.stop=stop; self.block=block
        self.read_error=read_error; self.close_error=close_error
        self.eof=False; self.closed=False
    def read(self,size):
        if self.read_error: raise OSError('synthetic private read error')
        if self.block: self.stop.wait()
        if self.stop.is_set(): data=b''
        else: data=self.raw.read(size)
        if not data: self.eof=True
        return data
    def close(self):
        if self.close_error: raise OSError('synthetic private close error')
        self.closed=True

class Child:
    def __init__(self,out=b'',err=b'',*,block=False,read_error=False,close_error=False,
                 exit_code=0,terminate_error=False):
        self.stop=threading.Event()
        self.stdout=Pipe(out,self.stop,block=block,read_error=read_error,close_error=close_error)
        self.stderr=Pipe(err,self.stop,block=block)
        self.code=exit_code; self.terminated=False; self.killed=False
        self.terminate_error=terminate_error
    def poll(self):
        if self.killed: return -9
        if self.terminated: return -15
        return self.code if self.stdout.eof and self.stderr.eof else None
    def wait(self,timeout):
        code=self.poll()
        if code is None: raise subprocess.TimeoutExpired('synthetic-child',timeout)
        return code
    def terminate(self):
        if self.terminate_error: raise OSError('synthetic private terminate error')
        self.terminated=True; self.stop.set()
    def kill(self):
        self.killed=True; self.stop.set()

class BoundedCapture(unittest.TestCase):
    def invoke(self,child,*,limit=128,total=256,timeout=0.2):
        # Isolated mock lease avoids contaminating other tests after intentional
        # cleanup failure; no production retry/reset API exists.
        with patch.object(collector,'_SLOT',threading.BoundedSemaphore(1)),patch.object(collector,'JOIN_GRACE',0.05),patch.object(collector,'STOP_GRACE',0.05):
            with patch.object(collector.subprocess,'Popen',return_value=child) as start:
                result=collector.capture_process(['synthetic-child'],timeout=timeout,
                    channel_limit=limit,budget=collector.ByteBudget(total))
        start.assert_called_once()
        self.assertTrue(start.call_args.kwargs['bufsize']==0)
        self.assertTrue(start.call_args.kwargs['shell'] is False)
        return result
    def test_both_binary_streams_complete(self):
        child=Child(b'\xff\x00binary',b'\xfe\x80stderr')
        result=self.invoke(child)
        self.assertTrue(result.stdout.payload==b'\xff\x00binary')
        self.assertTrue(result.stderr.payload==b'\xfe\x80stderr')
        self.assertTrue(result.complete(result.stdout) and result.complete(result.stderr))
    def test_limits_during_read_and_aggregate(self):
        child=Child(b'x'*1024,b'y'*1024)
        result=self.invoke(child,limit=32,total=48)
        self.assertTrue(len(result.stdout.payload)<=32 and len(result.stderr.payload)<=32)
        self.assertTrue(len(result.stdout.payload)+len(result.stderr.payload)<=48)
        self.assertTrue(result.stdout.truncated or result.stderr.truncated)
        self.assertFalse(result.complete(result.stdout) and result.complete(result.stderr))
    def test_timeout_and_kill_fallback(self):
        child=Child(block=True,terminate_error=True)
        result=self.invoke(child,timeout=0.01)
        self.assertTrue(result.timeout and child.killed)
        self.assertTrue(result.stdout.stream_error)
    def test_nonzero_read_and_close_failures(self):
        for child in (Child(exit_code=3),Child(read_error=True),Child(close_error=True)):
            result=self.invoke(child)
            self.assertFalse(result.complete(result.stdout))
    def test_spawn_failure_is_safe_and_not_retried(self):
        with patch.object(collector,'_SLOT',threading.BoundedSemaphore(1)):
            with patch.object(collector.subprocess,'Popen',side_effect=OSError('synthetic private error')) as start:
                result=collector.capture_process(['synthetic-child'],budget=collector.ByteBudget())
        start.assert_called_once(); self.assertTrue(result.stdout.channel_missing)
    def test_unconfirmed_cleanup_closes_admission_for_next_child(self):
        child=Child(close_error=True)
        with patch.object(collector,'_SLOT',threading.BoundedSemaphore(1)),patch.object(collector,'JOIN_GRACE',0.01):
            with patch.object(collector.subprocess,'Popen',return_value=child) as start:
                first=collector.capture_process(['synthetic-child'],budget=collector.ByteBudget())
                second=collector.capture_process(['synthetic-child'],budget=collector.ByteBudget())
        self.assertFalse(first.cleanup_complete)
        self.assertTrue(second.stdout.channel_missing and second.stdout.stream_error)
        start.assert_called_once()

class ChunkScanner(unittest.TestCase):
    def scanner(self):
        scanner=Scanner(); scanner.register(b'0123456789abcdef'*4); return scanner
    def test_boundary_marker_and_non_utf8(self):
        result=self.scanner().inspect_chunks('pg_stderr',[b'\xff01234567',b'89abcdef\x00'],complete=True)
        self.assertTrue(result['leak_detected'])
    def test_uninspected_remainder_is_truncated(self):
        result=self.scanner().inspect_chunks('pg_stderr',[b'x'*32],complete=True,max_bytes=8)
        self.assertTrue(result['truncated'] and result['status']=='INCONCLUSIVE')
    def test_error_keeps_positive_detection(self):
        def chunks():
            yield b'0123456789abcdef'
            raise OSError('synthetic private error')
        result=self.scanner().inspect_chunks('pg_stderr',chunks(),complete=True)
        self.assertTrue(result['leak_detected'] and result['stream_error'] and result['status']=='FAIL')
    def test_empty_infinite_iterator_is_bounded(self):
        import itertools
        result=self.scanner().inspect_chunks('pg_stderr',itertools.repeat(b''),complete=True)
        self.assertTrue(result['truncated'])

if __name__=='__main__': unittest.main()
