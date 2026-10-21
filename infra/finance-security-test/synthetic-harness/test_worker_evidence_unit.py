"""V1.3 UNIT/MOCK ONLY. No execution or live resource access authorized."""
import copy
import unittest
from unittest.mock import Mock,patch
from worker import MemoryText,private_error,CLIENT_BYTES,CLIENT_FRAGMENTS,CLIENT_FRAGMENT_BYTES
from collector import Capture,scan_bundle
from scanner import Scanner,CHANNELS
from protocol import validate_diagnostics
from oracles import REQUIRED,acceptance
from contract import Blocked
from test_oracles_unit import complete_mock_diagnostics

class WorkerBuffer(unittest.TestCase):
    def test_below_exact_and_above_bytes(self):
        for length in (CLIENT_BYTES-1,CLIENT_BYTES,CLIENT_BYTES+1):
            sink=MemoryText(); sink.write(b'x'*length)
            self.assertEqual(sink.size,min(length,CLIENT_BYTES))
            self.assertEqual(sink.truncated,length>CLIENT_BYTES)
            self.assertLessEqual(len(sink.parts),CLIENT_FRAGMENTS)
            self.assertTrue(all(0<len(x)<=CLIENT_FRAGMENT_BYTES for x in sink.parts))
    def test_fragment_limit(self):
        sink=MemoryText()
        for _ in range(CLIENT_FRAGMENTS): sink.write(b'x')
        self.assertFalse(sink.truncated)
        sink.write(b'y')
        self.assertTrue(sink.truncated)
        self.assertEqual(len(sink.parts),CLIENT_FRAGMENTS)
    def test_empty_writes_do_not_allocate_entries(self):
        sink=MemoryText()
        for _ in range(10000): sink.write(''); sink.write(b'')
        self.assertEqual(sink.parts,[])
        self.assertEqual(sink.size,0)
        self.assertFalse(sink.truncated)
        sink.write(b'x'*(CLIENT_BYTES+1))
        count=len(sink.parts)
        for _ in range(10000): sink.write(''); sink.write(b''); sink.write(b'discarded')
        self.assertEqual(len(sink.parts),count)
        self.assertLessEqual(sink.size,CLIENT_BYTES)
    def test_single_large_unicode_write(self):
        sink=MemoryText(); value='\U0001f600'*(CLIENT_BYTES+1)
        self.assertEqual(sink.write(value),len(value))
        self.assertLessEqual(sink.size,CLIENT_BYTES)
        self.assertTrue(sink.truncated)
        self.assertTrue(all(len(x)<=CLIENT_FRAGMENT_BYTES for x in sink.parts))
    def test_binary_is_not_decoded(self):
        sink=MemoryText(); sink.write(b'\xff\xfe\x00')
        self.assertEqual(sink.bytes(),b'\xff\xfe\x00')
        self.assertFalse(sink.stream_error)
    def test_invalid_input_and_error_rendering_fail_closed(self):
        class SensitiveError(Exception):
            def __str__(self): raise AssertionError('must not render')
        sink=MemoryText(); private_error(SensitiveError(),sink)
        self.assertTrue(sink.truncated)
        sink=MemoryText(); sink.write(object())
        self.assertTrue(sink.truncated and sink.stream_error)

class Evidence(unittest.TestCase):
    def test_metadata_schema(self):
        self.assertEqual(validate_diagnostics(complete_mock_diagnostics())['status'],'INCONCLUSIVE')
    def test_every_required_field_is_required(self):
        original=complete_mock_diagnostics()
        for key in original['channels'][0]:
            value=copy.deepcopy(original); del value['channels'][0][key]
            with self.subTest(key=key),self.assertRaises(Blocked): validate_diagnostics(value)
    def test_wrong_types_unknown_channel_and_completeness(self):
        cases={'captured_bytes':True,'byte_limit':'2097152','truncated':None,
               'channel_id':'foreign','completeness_status':'UNKNOWN',
               'scanner_status':'UNKNOWN','collection_start':None}
        for key,bad in cases.items():
            value=complete_mock_diagnostics(); value['channels'][0][key]=bad
            with self.subTest(key=key),self.assertRaises(Blocked): validate_diagnostics(value)
    def test_worker_cannot_assert_external_completeness(self):
        for layer in ('subprocess','docker_history','postgresql'):
            value=complete_mock_diagnostics()
            row=next(r for r in value['channels'] if r['channel_id']=='pg_stderr')
            row['capture_layers'][layer]='COMPLETE'
            with self.subTest(layer=layer),self.assertRaises(Blocked): validate_diagnostics(value)
    def test_missing_channel_no_pass(self):
        value=complete_mock_diagnostics(); value['channels'].pop()
        validate_diagnostics(value)
        self.assertNotEqual(acceptance({k:'PASS' for k in REQUIRED},diagnostics=value),'PASS')
    def test_not_executed_and_unproven_no_pass(self):
        facts={k:'PASS' for k in REQUIRED}
        self.assertEqual(acceptance(facts,diagnostics=complete_mock_diagnostics()),'INCONCLUSIVE')
        facts['scram']='NOT EXECUTED'
        self.assertEqual(acceptance(facts,diagnostics=complete_mock_diagnostics()),'NOT EXECUTED')
    def bundle(self,payload=b'ordinary diagnostics'):
        m={'container_id':'1'*64,'runner':{'container_id':'2'*64}}
        start='2026-01-01T00:00:00Z'; end='2026-01-01T00:00:01Z'
        rows=[Capture(ch,m['container_id'] if ch.startswith('pg_') else m['runner']['container_id'],
                      start,end,payload) for ch in CHANNELS]
        return m,start,end,rows
    def test_source_mismatch_and_scanner_exception(self):
        m,start,end,rows=self.bundle(); rows[0].container_id='9'*64
        scanner=Scanner(); scanner.register(b'public-synthetic-marker-123456')
        result=scan_bundle(scanner,m,rows,start,end)
        self.assertTrue(any(r['source_mismatch'] for r in result['channels']))
        self.assertNotEqual(result['status'],'PASS')
        broken=Mock(); broken.inspect.side_effect=RuntimeError('private synthetic error')
        result=scan_bundle(broken,m,rows,start,end)
        self.assertEqual(result['status'],'INCONCLUSIVE')
        validate_diagnostics(result)
    def test_leak_dominates_incomplete_capture(self):
        marker=b'public-synthetic-marker-123456'
        m,start,end,rows=self.bundle(marker); scanner=Scanner(); scanner.register(marker)
        result=scan_bundle(scanner,m,rows,start,end)
        self.assertEqual(result['status'],'FAIL')
        validate_diagnostics(result)
        self.assertEqual(acceptance({k:'NOT EXECUTED' for k in REQUIRED},diagnostics=result),'FAIL')
    def test_scanner_error_after_positive_remains_fail(self):
        marker=b'public-synthetic-marker-123456'
        m,start,end,rows=self.bundle(marker)
        scanner=Scanner(); scanner.register(marker)
        real=scanner.inspect
        calls=0
        def inspect(*args,**kwargs):
            nonlocal calls
            calls+=1
            if calls==2: raise RuntimeError('private synthetic diagnostic')
            return real(*args,**kwargs)
        with patch.object(scanner,'inspect',side_effect=inspect):
            result=scan_bundle(scanner,m,rows,start,end)
        self.assertEqual(result['status'],'FAIL')
        validate_diagnostics(result)
    def test_client_complete_cannot_promote_external_history(self):
        m,start,end,rows=self.bundle()
        client=next(r for r in rows if r.channel_id=='client_diagnostics')
        client.evidence='APPROVED_BOUNDED_STREAM'; client.gap=False
        client.collection_gap=False; client.completeness_unproven=False
        client.client_diagnostics_complete=True
        scanner=Scanner(); scanner.register(b'public-synthetic-marker-123456')
        result=scan_bundle(scanner,m,rows,start,end)
        validate_diagnostics(result)
        local=next(r for r in result['channels'] if r['channel_id']=='client_diagnostics')
        self.assertEqual(local['capture_layers']['client'],'COMPLETE')
        self.assertEqual(local['status'],'PASS')
        self.assertEqual(result['status'],'INCONCLUSIVE')
    def test_serialization_failure_no_sensitive_output(self):
        import worker
        packet={'type':'REPORT','raw':'public-synthetic-secret-marker'}
        output=Mock()
        with patch.object(worker.sys,'stdout',output):
            with self.assertRaises(Blocked) as error: worker.send(packet)
        self.assertNotIn('public-synthetic-secret-marker',str(error.exception))
        output.buffer.write.assert_not_called()
    def test_unknown_commit_stops_without_retry(self):
        import worker
        m,start,end,rows=self.bundle()
        hello={'type':'HELLO','manifest':m,'manifest_sha256':'x','nonce':'a'*32,'case':'success'}
        packet={'type':'DIAGNOSTICS','approval':{},'start':start,'end':end,'captures':[]}
        gate=Mock(); gate.read_identity.return_value='stderr_only'
        outcome=({'outcome':'COMMIT_UNKNOWN','reconciliation':'FULLY_APPLIED'},None)
        with patch.object(worker,'receive',side_effect=[hello,{},packet]),patch.object(worker,'check_binding'),patch.object(worker,'manifest_digest',return_value='x'),patch.object(worker,'authorize'),patch.object(worker,'RunnerAdmission',return_value=gate),patch.object(worker,'synthetic_materials',return_value={'fixture':b'public-synthetic-marker-123456'}),patch.object(worker,'decode_captures',return_value=rows[:-1]),patch.object(worker,'run_case',return_value=outcome) as run,patch.object(worker,'send') as send:
            self.assertEqual(worker.main(),2)
        run.assert_called_once()
        report=send.call_args.args[0]
        self.assertEqual(report['facts']['no_automatic_retry'],'BLOCKED')
        self.assertNotEqual(report['status'],'PASS')

if __name__=='__main__': unittest.main()
