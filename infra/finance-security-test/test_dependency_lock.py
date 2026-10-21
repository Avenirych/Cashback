"""Offline provenance/lock checks; no network, DB or package installation."""
import json
import hashlib
import zipfile
import re
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parent

class DependencyLock(unittest.TestCase):
    def test_verified_closure(self):
        records = json.loads((ROOT/'dependency-provenance.json').read_text())['wheels']
        self.assertEqual([r['package'] for r in records], ['psycopg', 'psycopg-binary'])
        text = (ROOT/'requirements.lock').read_text()
        for record in records:
            self.assertRegex(record['sha256'], r'^[0-9a-f]{64}$')
            self.assertGreater(record['verified_download_bytes'], 0)
            self.assertIn('--hash=sha256:'+record['sha256'], text)
            self.assertEqual(record['version'], '3.2.10')
        self.assertEqual(records[1]['requires_dist'], [])
        self.assertIn('cp313-cp313-manylinux', records[1]['filename'])
        self.assertIn('x86_64', records[1]['filename'])
        selected = [r for r in records[0]['requires_dist'] if 'extra == "binary"' in r]
        self.assertEqual(selected, ['psycopg-binary==3.2.10; implementation_name != "pypy" and extra == "binary"'])
        self.assertEqual(len(re.findall(r'^psycopg.*==3.2.10', text, re.M)), 2)

    def test_wheelhouse_bytes(self):
        records = json.loads((ROOT/'dependency-provenance.json').read_text())['wheels']
        directory = ROOT/'wheelhouse'
        self.assertEqual({p.name for p in directory.iterdir()}, {r['filename'] for r in records})
        for record in records:
            artifact = directory/record['filename']
            self.assertEqual(hashlib.sha256(artifact.read_bytes()).hexdigest(), record['sha256'])
            with zipfile.ZipFile(artifact) as wheel:
                self.assertIsNone(wheel.testzip())
            self.assertIn('--hash=sha256:'+record['sha256'], (ROOT/'requirements.lock').read_text())

    def test_offline_install(self):
        docker = (ROOT/'Dockerfile').read_text()
        self.assertIn('RUN --network=none', docker)
        self.assertIn('--no-index --find-links=/wheelhouse', docker)
        self.assertIn('--disable-pip-version-check', docker)
        self.assertNotIn('--trusted-host', docker)
        ignore = (ROOT/'.dockerignore').read_text()
        for record in json.loads((ROOT/'dependency-provenance.json').read_text())['wheels']:
            self.assertIn('!wheelhouse/'+record['filename'], ignore)
            self.assertIn('COPY wheelhouse/'+record['filename']+' /wheelhouse/', docker)

    def test_docker_contract(self):
        text = (ROOT/'Dockerfile').read_text()
        self.assertIn('--require-hashes --only-binary=:all: -r requirements.lock', text)
        self.assertIn("platform.machine()=='x86_64'", text)
        self.assertIn('sha256:a1165e272e578941b84abc79e4ab38a0305cd12803a5c4247979ac7655f4d641', text)

if __name__ == '__main__': unittest.main()
