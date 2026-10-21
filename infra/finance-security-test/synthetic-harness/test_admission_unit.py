"""UNIT/MOCK: synthetic Docker JSON fixtures, never invoke Docker."""
import copy
import unittest
from contract import Blocked, IMAGE, IMAGE_ID, FORBIDDEN, SOURCE_FILES, validate_manifest
from admission import check_docker, check_identity
from test_unit import Result

def manifest():
    run = '0123456789abcdef'; project = 'cashback-synth-' + run
    return {'schema':1,'run_id':run,'project':project,'docker_context':'desktop-linux',
            'service':'pg','container_name':project+'-pg','container_id':'1'*64,
            'image_reference':IMAGE,'image_id':IMAGE_ID,'volume':project+'-pgdata',
            'volume_driver':'local','volume_created_at':'2026-01-01T00:00:00Z',
            'volume_destination':'/var/lib/postgresql/data','network':project+'-private',
            'network_id':'2'*64,'bootstrap_source':'C:/synthetic/'+project+'/bootstrap',
            'bootstrap_destination':'/run/secrets/bootstrap','database':'finance_security_test',
            'bootstrap_user':'fs_bootstrap','expected_cluster_id':'8888888888888888888',
            'forbidden_cluster_ids':sorted(FORBIDDEN),
            'reviewed_source_sha256':{name:'3'*64 for name in SOURCE_FILES}}

class DockerFixture:
    def __init__(self,m):
        self.users=[m['container_id']]
        labels={'com.docker.compose.project':m['project'],
                'com.cashback.synthetic.run':m['run_id'],
                'com.cashback.synthetic.scope':'disposable-security-v1'}
        self.p={'Id':m['container_id'],'Name':'/'+m['container_name'],
                'Image':IMAGE_ID,'Config':{'Image':IMAGE,'Labels':dict(labels,**{'com.docker.compose.service':'pg'})},
                'State':{'Running':True,'Health':{'Status':'healthy'}},
                'HostConfig':{'PortBindings':{},'PublishAllPorts':False,'Privileged':False,'NetworkMode':m['network'],
                              'PidMode':'','IpcMode':'private','VolumesFrom':None,'Devices':None,'DeviceRequests':None,'CapAdd':None},
                'NetworkSettings':{'Ports':{'5432/tcp':None},'Networks':{m['network']:{'NetworkID':m['network_id']}}},
                'Mounts':[{'Type':'volume','Name':m['volume'],'Destination':m['volume_destination'],
                           'Source':'/synthetic/data','Driver':'local','RW':True},
                          {'Type':'bind','Destination':m['bootstrap_destination'],'Source':m['bootstrap_source'],'RW':False}]}
        self.v={'Name':m['volume'],'Driver':'local','CreatedAt':m['volume_created_at'],'Options':None,
                'Mountpoint':'/synthetic/data','Labels':labels}
        self.n={'Name':m['network'],'Id':m['network_id'],'Internal':True,'Driver':'bridge',
                'Labels':labels,'Containers':{m['container_id']:{}}}
    def context(self): return 'desktop-linux'
    def inspect(self,kind,identifier): return {'container':self.p,'volume':self.v,'network':self.n}[kind]
    def volume_users(self,name): return self.users

class AdmissionTests(unittest.TestCase):
    def test_valid_and_utc(self):
        m=manifest(); d=DockerFixture(m)
        d.v['CreatedAt']='2025-12-31T19:00:00-05:00'
        check_docker(m,d)
    def test_manifest_unknown_and_existing_clusters(self):
        m=manifest()
        for key in m:
            changed=copy.deepcopy(m); changed[key]=None
            with self.subTest(field=key):
                with self.assertRaises(Exception): validate_manifest(changed)
        for cluster in FORBIDDEN:
            changed=copy.deepcopy(m); changed['expected_cluster_id']=cluster
            with self.assertRaises(Blocked): validate_manifest(changed)
    def test_docker_mismatches_and_missing_metadata(self):
        for case in ('id','project','image','mount','network','ports','missing','unhealthy','shared_network','shared_volume','context','docker_error'):
            m=manifest(); d=DockerFixture(m)
            if case=='id': d.p['Id']='4'*64
            if case=='project': d.p['Config']['Labels']['com.docker.compose.project']='other'
            if case=='image': d.p['Image']='sha256:'+'4'*64
            if case=='mount': d.p['Mounts'].append({'Type':'bind','Destination':'/unexpected'})
            if case=='network': d.n['Internal']=False
            if case=='ports': d.p['HostConfig']['PortBindings']={'5432/tcp':[{'HostPort':'5432'}]}
            if case=='missing': del d.v['CreatedAt']
            if case=='unhealthy': d.p['State']['Health']['Status']='starting'
            if case=='shared_network': d.n['Containers']['5'*64]={}
            if case=='shared_volume': d.users.append('6'*64)
            if case=='context': d.context=lambda:'unexpected'
            if case=='docker_error':
                def unavailable(*args): raise RuntimeError('synthetic private diagnostic')
                d.inspect=unavailable
            with self.subTest(case=case):
                with self.assertRaises(Blocked): check_docker(m,d)
    def test_sql_identity(self):
        from unittest.mock import Mock
        m=manifest(); c=Mock()
        good=('finance_security_test','fs_bootstrap','fs_bootstrap',170011,m['expected_cluster_id'])
        c.execute.return_value=Result([good]); check_identity(c,m)
        for bad in FORBIDDEN | {'999'}:
            c.execute.return_value=Result([good[:-1]+(bad,)])
            with self.assertRaises(Blocked): check_identity(c,m)

if __name__=='__main__': unittest.main()
