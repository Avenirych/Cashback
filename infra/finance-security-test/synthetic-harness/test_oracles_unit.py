"""UNIT/MOCK only; status handling cannot turn UNKNOWN into success."""
import unittest
from oracles import REQUIRED, DIAGNOSTIC_FLAGS, acceptance, exit_status, diagnostic_status
from scanner import CHANNELS

def complete_mock_diagnostics():
    # Deliberately UNPROVEN: no worker fixture can attest external history.
    from collector import evidence_row
    m={'container_id':'1'*64,'runner':{'container_id':'2'*64}}
    rows=[evidence_row(m,ch,'2026-01-01T00:00:00Z','2026-01-01T00:00:01Z')
          for ch in sorted(CHANNELS)]
    return {'status':'INCONCLUSIVE','channels':rows,'verifier_scope':'not_created'}

class Oracles(unittest.TestCase):
    def test_complete(self):
        facts={name:'PASS' for name in REQUIRED}
        self.assertTrue(acceptance(facts)=='INCONCLUSIVE')
        self.assertTrue(exit_status(facts,cleanup_confirmed=True)!=0)
        proof=complete_mock_diagnostics()
        self.assertTrue(acceptance(facts,diagnostics=proof)=='INCONCLUSIVE')
        self.assertTrue(exit_status(facts,cleanup_confirmed=True,diagnostics=proof)!=0)
        for flag in (False,None,'UNKNOWN'):
            self.assertTrue(exit_status(facts,cleanup_confirmed=flag)!=0)
    def test_unknown_missing_failure(self):
        for value in ('UNKNOWN','INCONCLUSIVE',None,'FAIL'):
            facts={name:'PASS' for name in REQUIRED}; facts['identity']=value
            self.assertTrue(acceptance(facts)!='PASS')
        self.assertTrue(acceptance({})=='BLOCKED')
    def test_each_diagnostic_flag_blocks_pass(self):
        facts={name:'PASS' for name in REQUIRED}
        for name in DIAGNOSTIC_FLAGS:
            flags={key:False for key in DIAGNOSTIC_FLAGS}; flags[name]=True
            self.assertTrue(diagnostic_status(flags,leak_detected=False,scanner_ok=True)=='INCONCLUSIVE')
            self.assertTrue(diagnostic_status(flags,leak_detected=True,scanner_ok=False)=='FAIL')
            proof=complete_mock_diagnostics(); proof['channels'][0][name]=True
            self.assertTrue(acceptance(facts,diagnostics=proof)!='PASS')
    def test_history_and_missing_proof_never_inferred(self):
        facts={name:'PASS' for name in REQUIRED}
        proof=complete_mock_diagnostics()
        row=next(r for r in proof['channels'] if r['channel_id']=='pg_stderr')
        row['capture_layers']['docker_history']=None
        self.assertTrue(acceptance(facts,diagnostics=proof)=='INCONCLUSIVE')
        del row['collection_gap']
        self.assertTrue(acceptance(facts,diagnostics=proof)!='PASS')

if __name__=='__main__': unittest.main()
