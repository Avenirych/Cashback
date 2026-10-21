"""Host-side Docker read-only gate. No create/run/exec/remove implementation.

Future transport must be independently approved. A connection alone is never
sufficient: every guarded operation first calls this real Docker inspection.
"""
import hashlib
import json
import subprocess
from contextlib import contextmanager
from pathlib import Path
from contract import Blocked, FORBIDDEN, SOURCE_FILES, utc, validate_manifest

class DockerReadOnly:
    def __init__(self, executable):
        self.executable = executable

    def _call(self, args, *, pin=True):
        try:
            prefix=[self.executable]+(['--context','desktop-linux'] if pin else [])
            result = subprocess.run([*prefix, *args], capture_output=True,
                                    text=True, timeout=15, check=False)
            if result.returncode != 0:
                raise Blocked('Docker read failed')
            return result.stdout
        except Exception:
            raise Blocked('Docker metadata unavailable') from None

    def context(self):
        return self._call(['context', 'show'],pin=False).strip()

    def inspect(self, kind, identifier):
        try:
            if kind not in ('container','volume','network','image'):
                raise Blocked('Unsupported read-only Docker object kind')
            rows = json.loads(self._call([kind, 'inspect', identifier]))
            if not isinstance(rows, list) or len(rows) != 1:
                raise Blocked('Docker metadata ambiguous')
            return rows[0]
        except Exception:
            raise Blocked('Docker metadata invalid') from None

    def volume_users(self, name):
        return self._call(['container', 'ls', '--all', '--quiet', '--no-trunc',
                           '--filter', 'volume=' + name]).splitlines()

def check_docker(m, docker):
    try:
        validate_manifest(m)
        if docker.context() != m['docker_context']:
            raise Blocked('Docker context mismatch')
        p = docker.inspect('container', m['container_id'])
        v = docker.inspect('volume', m['volume'])
        n = docker.inspect('network', m['network_id'])
        labels = p['Config']['Labels']
        if (p['Id'] != m['container_id'] or p['Name'] != '/' + m['container_name']
                or labels['com.docker.compose.project'] != m['project']
                or labels['com.docker.compose.service'] != m['service']
                or labels['com.cashback.synthetic.run'] != m['run_id']
                or labels['com.cashback.synthetic.scope'] != 'disposable-security-v1'
                or p['Config']['Image'] != m['image_reference'] or p['Image'] != m['image_id']
                or p['State']['Running'] is not True
                or p['State']['Health']['Status'] != 'healthy'):
            raise Blocked('Container boundary mismatch')
        host = p['HostConfig']
        if (host['PortBindings'] != {} or host['PublishAllPorts'] is not False
                or host['Privileged'] is not False or host['NetworkMode'] != m['network']
                or host['PidMode'] not in ('', 'private')
                or host['IpcMode'] not in ('private', 'shareable')
                or host['VolumesFrom'] not in (None, [])
                or host['Devices'] not in (None, [])
                or host['DeviceRequests'] not in (None, [])
                or host['CapAdd'] not in (None, [])
                or any(value for value in p['NetworkSettings']['Ports'].values())):
            raise Blocked('Host access or published ports')
        networks = p['NetworkSettings']['Networks']
        if set(networks) != {m['network']} or networks[m['network']]['NetworkID'] != m['network_id']:
            raise Blocked('Unexpected attached network')
        for obj in (v, n):
            if (obj['Labels']['com.docker.compose.project'] != m['project']
                    or obj['Labels']['com.cashback.synthetic.run'] != m['run_id']
                    or obj['Labels']['com.cashback.synthetic.scope'] != 'disposable-security-v1'):
                raise Blocked('Resource ownership mismatch')
        if (v['Name'] != m['volume'] or v['Driver'] != m['volume_driver']
                or utc(v['CreatedAt']) != utc(m['volume_created_at'])
                or v['Options'] not in (None, {})):
            raise Blocked('Volume mismatch or external driver options')
        if docker.volume_users(m['volume']) != [m['container_id']]:
            raise Blocked('Volume not exclusive to approved container')
        endpoints = {m['container_id']}
        if 'runner' in m:
            r = check_runner(m,docker)
            if r['State']['Running'] is True:
                endpoints.add(m['runner']['container_id'])
        if (n['Id'] != m['network_id'] or n['Name'] != m['network']
                or n['Internal'] is not True or n['Driver'] != 'bridge'
                or set(n['Containers']) != endpoints):
            raise Blocked('Network boundary mismatch')
        mounts = p['Mounts']
        if len(mounts) != 2:
            raise Blocked('Unexpected mount count')
        by_target = {item['Destination']: item for item in mounts}
        if set(by_target) != {m['volume_destination'], m['bootstrap_destination']}:
            raise Blocked('Unexpected mount destination')
        data, secret = by_target[m['volume_destination']], by_target[m['bootstrap_destination']]
        if (data['Type'] != 'volume' or data['Name'] != m['volume'] or data['RW'] is not True
                or data['Driver'] != m['volume_driver'] or data['Source'] != v['Mountpoint']
                or secret['Type'] != 'bind' or secret['RW'] is not False
                or secret['Source'].replace('\\', '/') != m['bootstrap_source'].replace('\\', '/')):
            raise Blocked('Mount source mismatch')
    except Exception:
        raise Blocked('Isolation gate refused') from None

def check_runner(m,docker,*,phase=None):
    """Exact pre-created runner only; no host mounts, extra networks or auto-rm."""
    try:
        validate_manifest(m)
        r = m['runner']
        p = docker.inspect('container',r['container_id'])
        image = docker.inspect('image',r['image_id'])
        h, cfg, state = p['HostConfig'],p['Config'],p['State']
        labels = cfg['Labels']
        if (image['Id'] != r['image_id'] or image['Os'] != 'linux' or image['Architecture'] != 'amd64'
                or cfg['Env'] != image['Config']['Env'] or cfg['WorkingDir'] != '/harness'
                or p['Id'] != r['container_id'] or p['Name'] != '/'+r['container_name']
                or p['Image'] != r['image_id'] or cfg['Image'] != r['image_reference']
                or labels['com.docker.compose.project'] != m['project']
                or labels['com.docker.compose.service'] != 'runner'
                or labels['com.cashback.synthetic.run'] != m['run_id']
                or labels['com.cashback.synthetic.scope'] != 'disposable-security-v1'
                or cfg['User'] != '65534:65534' or cfg['Tty'] is not False
                or cfg['OpenStdin'] is not True
                or cfg['Healthcheck']['Test'] != ['NONE']
                or cfg['Entrypoint'] != ['python','-B','/harness/synthetic-harness/worker.py']
                or cfg['Cmd'] not in (None,[])
                or p['Mounts'] != []
                or h['ReadonlyRootfs'] is not True or h['Privileged'] is not False
                or h['AutoRemove'] is not False or h['RestartPolicy']['Name'] != 'no'
                or h['NetworkMode'] != m['network'] or h['PortBindings'] != {}
                or h['PublishAllPorts'] is not False or h['CapDrop'] != ['ALL']
                or h['CapAdd'] not in (None,[]) or h['Devices'] not in (None,[])
                or h['DeviceRequests'] not in (None,[]) or h['VolumesFrom'] not in (None,[])
                or h['PidMode'] not in ('','private') or h['IpcMode'] not in ('private','shareable')
                or h['SecurityOpt'] not in (['no-new-privileges'],['no-new-privileges:true'])
                or state['Status'] not in ('created','running','exited')
                or state['Running'] is not (state['Status']=='running')
                or (phase is not None and state['Status'] != phase)):
            raise Blocked('Runner boundary mismatch')
        networks = p['NetworkSettings']['Networks']
        if set(networks) != {m['network']}:
            raise Blocked('Runner attached to unexpected network')
        if state['Running'] is True and networks[m['network']]['NetworkID'] != m['network_id']:
            raise Blocked('Runner network identity mismatch')
        if any(p['NetworkSettings']['Ports'].values()):
            raise Blocked('Runner published ports')
        return p
    except Exception:
        raise Blocked('Runner admission refused') from None

def check_identity(c, m):
    """First application SELECT. Never accept the two existing cluster IDs."""
    row = c.execute(
        "SELECT current_database(), session_user, current_user, "
        "current_setting('server_version_num')::int, "
        "(SELECT system_identifier::text FROM pg_catalog.pg_control_system())"
    ).fetchone()
    if (not isinstance(row, tuple) or len(row) != 5
            or row[:3] != (m['database'], m['bootstrap_user'], m['bootstrap_user'])
            or type(row[3]) is not int or not 170000 <= row[3] < 180000
            or row[4] in FORBIDDEN or row[4] != m['expected_cluster_id']):
        raise Blocked('SQL identity refused')
    c.rollback()  # Diagnostic transaction only; no mutation has been admitted.

def check_sources(m, root):
    for name in SOURCE_FILES:
        path = root / name
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != m['reviewed_source_sha256'][name]:
            raise Blocked('Reviewed source changed')

class Admission:
    def __init__(self, manifest, docker_executable, source_root):
        # Freeze a copy: caller changes cannot silently retarget a running gate.
        self._manifest_json = json.dumps(validate_manifest(manifest), sort_keys=True)
        self.docker = DockerReadOnly(docker_executable)
        self.source_root = Path(source_root).resolve(strict=True)
        if self.source_root != Path(__file__).resolve().parent.parent:
            raise Blocked('Unexpected reviewed source root')

    @property
    def manifest(self):
        return json.loads(self._manifest_json)

    @contextmanager
    def connection(self, approved_transport):
        """Legacy signature retained, activation CLOSED; callbacks never invoked.

        V1 had no approved host-to-network transport. Only protocol-bound
        RunnerAdmission is now permitted to open test database connections.
        """
        yield from ()
        raise Blocked('Legacy host SQL callback disabled; protocol runner required')
