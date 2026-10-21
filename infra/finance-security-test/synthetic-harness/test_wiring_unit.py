"""V1.1 UNIT/MOCK ONLY: no real Docker, SQL, files/secrets or processes."""
import copy
import unittest
from types import SimpleNamespace
from unittest.mock import Mock,patch
from admission import Admission,check_docker,check_runner
from contract import Blocked,ScenarioFailure,FORBIDDEN,validate_manifest
from collector import Capture,Stream,ProcessCapture,scan_bundle,collect_docker
from controller import Attached,execute
from integration import FaultConnection
from oracles import acceptance,REQUIRED,scenario_exception_status
from protocol import authorize,manifest_digest,check_binding,safe_report
from runner_gate import RunnerAdmission
from scanner import Scanner,CHANNELS
from test_admission_unit import manifest,DockerFixture
from test_unit import Result

def wired_manifest():
    m=manifest()
    m['runner']={'container_id':'7'*64,'container_name':m['project']+'-runner',
                 'image_id':'sha256:'+'8'*64,'image_reference':'sha256:'+'8'*64}
    return m

def approval(m,case,scope):
    return {'scope':scope,'manifest_sha256':manifest_digest(m),
            'runner_id':m['runner']['container_id'],'case':case,'approved':True}

class WiredDocker(DockerFixture):
    executable='NEVER_EXECUTE_THIS_UNIT_FIXTURE'
    def __init__(self,m):
        super().__init__(m)
        self.p['Config']['Tty']=False
        self.p['HostConfig']['LogConfig']={'Type':'json-file'}
        self.r=copy.deepcopy(self.p)
        self.r['Id']=m['runner']['container_id']; self.r['Name']='/'+m['runner']['container_name']
        self.r['Image']=m['runner']['image_id']; self.r['Mounts']=[]
        self.r['Config'].update(Image=m['runner']['image_reference'],User='65534:65534',
            Tty=False,OpenStdin=True,Env=[],WorkingDir='/harness',Healthcheck={'Test':['NONE']},
            Entrypoint=['python','-B','/harness/synthetic-harness/worker.py'],Cmd=None)
        self.r['Config']['Labels']['com.docker.compose.service']='runner'
        self.r['State']={'Status':'running','Running':True}
        self.r['HostConfig'].update(ReadonlyRootfs=True,AutoRemove=False,
            RestartPolicy={'Name':'no'},CapDrop=['ALL'],SecurityOpt=['no-new-privileges'])
        self.n['Containers'][m['runner']['container_id']]={}
    def inspect(self,kind,identifier):
        if kind=='image': return {'Id':self.r['Image'],'Os':'linux','Architecture':'amd64','Config':{'Env':[]}}
        if kind=='container' and identifier==self.r['Id']: return self.r
        return super().inspect(kind,identifier)

class WiringAdmission(unittest.TestCase):
    def test_good_pair(self):
        m=wired_manifest(); check_docker(m,WiredDocker(m))
    def test_runner_boundaries(self):
        for case in ('image','network','ports','socket','user','privileged','unknown'):
            m=wired_manifest(); d=WiredDocker(m)
            if case=='image': d.r['Image']='sha256:'+'9'*64
            if case=='network': d.r['HostConfig']['NetworkMode']='foreign'
            if case=='ports': d.r['HostConfig']['PortBindings']={'5432/tcp':[{}]}
            if case=='socket': d.r['Mounts']=[{'Destination':'/var/run/docker.sock'}]
            if case=='user': d.r['Config']['User']='0'
            if case=='privileged': d.r['HostConfig']['Privileged']=True
            if case=='unknown': del d.r['Config']['Env']
            with self.subTest(case=case):
                with self.assertRaises(Blocked): check_runner(m,d)
    def test_manifest_missing_or_forbidden_cluster(self):
        for value in (None,*FORBIDDEN):
            m=wired_manifest(); m['expected_cluster_id']=value
            with self.assertRaises(Blocked): validate_manifest(m)
    def test_private_grant_binding(self):
        m=wired_manifest(); case='success'; nonce='a'*32
        packet={'type':'GO','manifest_sha256':manifest_digest(m),'nonce':nonce,'case':case,
                'approval':approval(m,case,'run_scenario')}
        gate=RunnerAdmission(m)
        gate.accept_host_go(packet,nonce,case)
        gate.require_case(case)
        with self.assertRaises(Blocked): gate.require_case('permission_denied')
        with self.assertRaises(Blocked): gate.accept_host_go(packet,nonce,case)
        for field in ('nonce','manifest_sha256','case'):
            wrong=dict(packet); wrong[field]='wrong'
            with self.assertRaises(Blocked): check_binding(wrong,m,nonce,case,'GO')
    def test_in_runner_identity_error(self):
        m=wired_manifest(); gate=RunnerAdmission(m)
        c=Mock(); c.execute.return_value=Result([('finance_security_test','fs_bootstrap','fs_bootstrap',170011,next(iter(FORBIDDEN)))])
        with patch('runner_gate.check_sources'),patch.object(gate,'_open',return_value=c):
            with self.assertRaises(Blocked): gate.read_identity()
        c.close.assert_called_once()
    def test_no_host_grant_no_connection(self):
        gate=RunnerAdmission(wired_manifest())
        with patch.object(gate,'_open') as connect:
            with self.assertRaises(Blocked):
                with gate.connection(None): self.fail('Gate bypass')
        self.assertFalse(connect.called)
    def test_legacy_callback_never_invoked(self):
        gate=Admission.__new__(Admission); callback=Mock()
        with self.assertRaises(Blocked):
            with gate.connection(callback): self.fail('Legacy bypass')
        self.assertFalse(callback.called)
    def test_transport_failure_no_retry(self):
        m=wired_manifest(); case='success'
        kwargs={'start_approval':approval(m,case,'start_runner'),
                'test_approval':approval(m,case,'run_scenario'),
                'diagnostic_approval':approval(m,case,'collect_diagnostics')}
        with patch('controller.check_docker'),patch('controller.check_runner'),patch('controller.check_sources'):
            with patch('controller.Attached',side_effect=RuntimeError('private transport diagnostic')) as start:
                result=execute(m,'never',case,**kwargs)
        self.assertTrue(result['status']=='BLOCKED'); start.assert_called_once()
    def test_bad_target_never_starts(self):
        m=wired_manifest(); case='success'
        with patch('controller.check_docker',side_effect=Blocked('refused')):
            with patch('controller.Attached') as start:
                result=execute(m,'never',case,start_approval=approval(m,case,'start_runner'),
                    test_approval=approval(m,case,'run_scenario'),diagnostic_approval=approval(m,case,'collect_diagnostics'))
        self.assertTrue(result['status']=='BLOCKED'); self.assertFalse(start.called)
    def test_attachment_constructor_cannot_skip_gate(self):
        m=wired_manifest(); case='success'
        with patch('controller.check_docker',side_effect=Blocked('refused')):
            with patch('controller.subprocess.Popen') as process:
                with self.assertRaises(Blocked):
                    Attached('never',m,case,approval(m,case,'start_runner'))
        self.assertFalse(process.called)
    def test_commit_exception_has_no_retry(self):
        c=Mock(); c.commit.side_effect=RuntimeError('uncertain')
        proxy=FaultConnection(c,'success',{})
        with self.assertRaises(RuntimeError): proxy.commit()
        c.commit.assert_called_once(); self.assertTrue(proxy.commits==1)
    def test_mock_protocol_wiring_remains_inconclusive(self):
        m=wired_manifest(); case='success'; nonce='a'*32
        binding={'manifest_sha256':manifest_digest(m),'nonce':nonce,'case':case}
        facts={name:'PASS' for name in REQUIRED}
        facts['no_verifier_in_inspected_logs']=facts['no_sensitive_client_diagnostics']='INCONCLUSIVE'
        from test_oracles_unit import complete_mock_diagnostics
        channels=complete_mock_diagnostics()['channels']
        report=dict(binding,type='REPORT',status='INCONCLUSIVE',facts=facts,
                    reconciliation='FULLY_APPLIED',diagnostics={'status':'INCONCLUSIVE',
                    'channels':channels,'verifier_scope':'created'})
        attached=Mock(stderr=bytearray(),stderr_truncated=False)
        attached.receive.side_effect=[dict(binding,type='READY',identity='PASS',server_route='stderr_only'),
                                      dict(binding,type='DONE'),report]
        attached.finish.return_value=2
        with patch('controller.check_docker'),patch('controller.check_runner'),patch('controller.check_sources'),patch('controller.secrets.token_hex',return_value=nonce):
            with patch('controller.Attached',return_value=attached),patch('controller.collect_docker',return_value=[]):
                result=execute(m,'never',case,start_approval=approval(m,case,'start_runner'),
                    test_approval=approval(m,case,'run_scenario'),diagnostic_approval=approval(m,case,'collect_diagnostics'))
        self.assertTrue(result['status']=='INCONCLUSIVE')
        self.assertTrue([call.args[0]['type'] for call in attached.send.call_args_list]==['HELLO','GO','DIAGNOSTICS'])
        attached.disconnect.assert_called_once()

class CollectionTests(unittest.TestCase):
    start='2026-01-01T00:00:00Z'; end='2026-01-01T00:00:01Z'
    def captures(self,m,*,proven=False):
        return [Capture(ch,m['container_id'] if ch.startswith('pg_') else m['runner']['container_id'],
                self.start,self.end,b'bounded synthetic output',
                evidence='APPROVED_BOUNDED_STREAM' if proven else 'UNPROVEN',gap=not proven,
                collection_gap=not proven,completeness_unproven=not proven,
                subprocess_complete=True if proven and ch!='client_diagnostics' else None,
                docker_history_complete=True if proven and ch!='client_diagnostics' else None,
                postgres_diagnostics_complete=True if proven and ch.startswith('pg_') else None,
                client_diagnostics_complete=True if proven and ch=='client_diagnostics' else None)
                for ch in sorted(CHANNELS)]
    def scanner(self):
        scanner=Scanner(); scanner.register(b'p'*64); return scanner
    def test_complete_mock_only_and_incomplete(self):
        m=wired_manifest()
        self.assertTrue(scan_bundle(self.scanner(),m,self.captures(m,proven=True),self.start,self.end)['status']=='INCONCLUSIVE')
        for kind in ('missing','gap','truncated','unknown_source','unproven'):
            rows=self.captures(m,proven=True)
            if kind=='missing': rows.pop()
            if kind=='gap': rows[0].gap=True
            if kind=='truncated': rows[0].truncated=True
            if kind=='unknown_source': rows[0].container_id='9'*64
            if kind=='unproven': rows[0].evidence='UNPROVEN'
            self.assertTrue(scan_bundle(self.scanner(),m,rows,self.start,self.end)['status']!='PASS')
    def test_scanner_exception(self):
        m=wired_manifest(); scanner=Mock()
        scanner.inspect.side_effect=RuntimeError('private scanner diagnostic')
        result=scan_bundle(scanner,m,self.captures(m),self.start,self.end)
        self.assertTrue(result['status']=='INCONCLUSIVE')
    def test_leak_control(self):
        m=wired_manifest(); rows=self.captures(m)
        rows[0].payload=b'p'*64
        self.assertTrue(scan_bundle(self.scanner(),m,rows,self.start,self.end)['status']=='FAIL')
    def test_cli_collection_never_claims_complete(self):
        m=wired_manifest(); d=WiredDocker(m)
        completed=ProcessCapture(Stream(payload=b'candidate stdout',eof=True),
                                 Stream(payload=b'candidate stderr',eof=True),
                                 cleanup_complete=True,exit_code=0)
        with patch('collector.capture_process',return_value=completed) as command:
            rows=collect_docker(m,d,self.start,self.end)
        self.assertTrue(command.call_count==2)
        self.assertTrue(all(r.evidence=='UNPROVEN' for r in rows))
        for call in command.call_args_list:
            self.assertTrue(call.args[0][-1] in {m['container_id'],m['runner']['container_id']})
    def test_not_executed_cannot_pass(self):
        facts={name:'PASS' for name in REQUIRED}; facts['transaction_atomicity']='NOT EXECUTED'
        self.assertTrue(acceptance(facts)=='NOT EXECUTED')
    def test_unexpected_scenario_is_failure(self):
        self.assertTrue(scenario_exception_status(ScenarioFailure('synthetic oracle'))=='FAIL')
        self.assertTrue(scenario_exception_status(Blocked('synthetic gate'))=='BLOCKED')
    def test_safe_report_rejects_raw_field(self):
        m=wired_manifest()
        report={'type':'REPORT','manifest_sha256':manifest_digest(m),'nonce':'a'*32,'case':'success',
                'status':'PASS','facts':{name:'PASS' for name in REQUIRED},
                'diagnostics':{'status':'PASS','channels':[],'verifier_scope':'created'},
                'reconciliation':'FULLY_APPLIED','raw_private_diagnostics':'synthetic marker'}
        with self.assertRaises(Blocked): safe_report(report)
        del report['raw_private_diagnostics']
        with self.assertRaises(Blocked): safe_report(report)

if __name__=='__main__': unittest.main()
