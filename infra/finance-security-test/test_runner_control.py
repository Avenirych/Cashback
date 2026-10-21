"""Stdlib offline tests. No psycopg, SQL, sockets or Docker."""
import unittest
from runner_control import run_checked

class ExitPolicy(unittest.TestCase):
    def test_success(self):
        self.assertEqual(run_checked(lambda: 3, lambda: None, lambda *a: None), 0)

    def test_suite_failure(self):
        calls = []
        def fail(): raise ValueError('private diagnostic')
        self.assertEqual(run_checked(fail, lambda: calls.append('cleanup'), lambda *a: None), 1)
        self.assertEqual(calls, ['cleanup'])

    def test_cleanup_failure(self):
        def fail(): raise RuntimeError('private diagnostic')
        self.assertEqual(run_checked(lambda: 3, fail, lambda *a: None), 1)

    def test_both_preserved(self):
        logs = []
        def first(): raise ValueError('secret message')
        def second(): raise RuntimeError('secret message')
        self.assertEqual(run_checked(first, second, lambda *a: logs.append(a)), 1)
        self.assertEqual([a[1] for a in logs], ['suite', 'cleanup'])
        self.assertNotIn('secret message', str(logs))

    def test_interrupt(self):
        def fail(): raise KeyboardInterrupt()
        self.assertEqual(run_checked(fail, lambda: None, lambda *a: None), 1)

if __name__ == '__main__': unittest.main()
