import { reconcileAccounts } from './reconciliation';
const bank='00000000-0000-0000-0000-000000000001',liability='00000000-0000-0000-0000-000000000002';
const accounts=[{id:bank,normalSide:'debit' as const,nonnegative:true,cachedPence:100n},{id:liability,normalSide:'credit' as const,nonnegative:true,cachedPence:100n}];
const postings=[{id:'p1',journalId:'j1',accountId:bank,side:'debit' as const,amount:100n},{id:'p2',journalId:'j1',accountId:liability,side:'credit' as const,amount:100n}];
test('reconciles complete committed history without mutating a cache',()=>{
  expect(reconcileAccounts(accounts,postings)).toMatchObject({balanced:true,journalCount:1});
  const stale=accounts.map(a=>({...a,cachedPence:0n}));
  expect(reconcileAccounts(stale,postings).differences).toHaveLength(2);
  expect(stale[0].cachedPence).toBe(0n);
});
test('rejects duplicate postings and unbalanced journals instead of repairing them',()=>{
  expect(()=>reconcileAccounts(accounts,[...postings,postings[0]])).toThrow('Duplicate');
  expect(()=>reconcileAccounts(accounts,[postings[0],{...postings[1],amount:99n}])).toThrow('Unbalanced');
});
test('requires known accounts and detects a negative available balance',()=>{
  expect(()=>reconcileAccounts([accounts[0]],postings)).toThrow('Unknown');
  expect(()=>reconcileAccounts(accounts,postings.map(p=>({...p,side:p.side==='debit'?'credit' as const:'debit' as const})))).toThrow('Insufficient');
});
