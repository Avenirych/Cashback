'use strict';
module.exports=async function(h){
 const {assert,id,query,tx,approved,debts,invoke,terms,funded,testNew,balance}=h;
 const transfer=(l,recipient,amount,key='transfer:'+id())=>tx(m=>approved.transfer(m,l.owner,key,{action:'transfer',lot:l.id,recipient,amount}));
 async function bank(){const a=id();await h.owner.transaction(async m=>{await h.account(m,a,'platform','company_bank_cash','debit');await h.fixtureLedger.postWithManager(m,'fixture:'+id(),[{accountId:a,side:'debit',amount:10000n},{accountId:h.clearing,side:'credit',amount:10000n}]);});return a;}
 await testNew('partial forum transfer starts new child period and preserves sender remainder and ancestry',async()=>{
  const l=await funded(undefined,'2025-01-31T10:00:00.123Z'),old=(await terms(l.id))[0],recipient='recipient:'+id(),before=(await query('SELECT clock_timestamp() t'))[0].t;
  const r=await transfer(l,recipient,300n),child=(await query('SELECT * FROM finance_bonus_lots WHERE id=$1',[r.lotId]))[0],t=(await terms(r.lotId))[0],after=(await query('SELECT clock_timestamp() t'))[0].t;
  assert.equal(await balance(l.available),500n);assert.equal(await balance(child.available),300n);assert.equal(child.owner,recipient);assert.equal(child.parent,l.id);assert.equal(child.origin,l.origin);assert.equal(child.responsible,l.responsible);assert.equal(child.confirmedAt.toISOString(),l.confirmedAt.toISOString());
  assert(new Date(t.startedAt)>=before&&new Date(t.startedAt)<=after);assert.deepEqual((await terms(l.id))[0],old);
  assert.equal((await query("SELECT until=((started AT TIME ZONE 'UTC')+interval '6 months') AT TIME ZONE 'UTC' valid FROM finance_bonus_use_terms WHERE lot=$1",[r.lotId]))[0].valid,true);
 });
 await testNew('concurrent forum transfers cannot duplicate free funds; failed transfer leaves no child terms',async()=>{
  const l=await funded(),recipient='recipient:'+id();
  const r=await Promise.allSettled([transfer(l,recipient,600n),transfer(l,recipient,600n)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(await balance(l.available),200n);
  assert.equal((await query('SELECT count(*)::int n FROM finance_bonus_lots WHERE parent=$1',[l.id]))[0].n,1);
 });
 await testNew('same transfer replay creates one child and one immutable period',async()=>{
  const l=await funded(),recipient='recipient:'+id(),key='transfer:'+id();
  const [a,b]=await Promise.all([transfer(l,recipient,300n,key),transfer(l,recipient,300n,key)]);assert.deepEqual(a,b);assert.equal(await balance(l.available),500n);
  assert.equal((await query('SELECT count(*)::int n FROM finance_bonus_lots WHERE parent=$1',[l.id]))[0].n,1);assert.equal((await terms(a.lotId)).length,1);
 });
 await testNew('variant A linked sender debt is paid once; unused recipient remainder is retained',async()=>{
  const l=await funded(),recipient='recipient:'+id(),r=await transfer(l,recipient,600n),child=(await query('SELECT * FROM finance_bonus_lots WHERE id=$1',[r.lotId]))[0],d=await h.debt(l.owner,400n,l.origin),key='recovery:'+id(),f={recipient,lot:child.id,debt:d.id,amount:'400',lineageVerified:true};
  const before=(await terms(child.id))[0];const [a,b]=await Promise.all([invoke(debts,'linkedRecovery',l.owner,'linked_recovery',f,key),invoke(debts,'linkedRecovery',l.owner,'linked_recovery',f,key)]);
  assert.deepEqual(a,b);assert.equal(a.status,'completed');assert.equal(await balance(d.account),0n);assert.equal(await balance(child.available),200n);assert.deepEqual((await terms(child.id))[0],before);
  assert.equal((await query("SELECT count(*)::int n FROM finance_policy_recovery_slices WHERE debt=$1 AND kind='collection'",[d.id]))[0].n,1);
 });
 await testNew('absent linked debt creates no right to recall recipient funds',async()=>{
  const l=await funded(),recipient='recipient:'+id(),r=await transfer(l,recipient,600n),child=(await query('SELECT * FROM finance_bonus_lots WHERE id=$1',[r.lotId]))[0];
  const result=await invoke(debts,'linkedRecovery',l.owner,'linked_recovery',{recipient,lot:child.id,debt:id(),amount:'600',lineageVerified:true});
  assert.equal(result.status,'pending_review');assert.equal(await balance(child.available),600n);assert.equal(await balance(l.available),200n);
 });
 await testNew('recipient debt gate remains closed; transfer rollback restores sender and removes child',async()=>{
  const l=await funded(),recipient='recipient:'+id();await h.debt(recipient,10n,'synthetic:'+id());
  assert.equal((await transfer(l,recipient,300n)).reason,'RECIPIENT_DEBT_SETTLEMENT_REQUIRED');assert.equal(await balance(l.available),800n);
  await assert.rejects(tx(async m=>{await approved.transfer(m,l.owner,'rollback:'+id(),{action:'transfer',lot:l.id,recipient:'other:'+id(),amount:300n});throw Error('injected transfer failure')}),/injected/);
  assert.equal(await balance(l.available),800n);assert.equal((await query('SELECT count(*)::int n FROM finance_bonus_lots WHERE parent=$1',[l.id]))[0].n,0);
 });
 await testNew('expired application rights remain funded for combined GBP10 payout; concurrent claims and outcomes cannot double pay',async()=>{
  const l=await funded(undefined,'2025-01-31T10:00:00.123Z'),money=await h.lot(l.owner,200n,'withdrawal_gbp'),feeBank=await bank(),principalBank=await bank(),key='payout:'+id();
  const f={lots:[l.id,money.id],currency:'GBP',expectedPrincipal:'1000',fee:'10',quote:'synthetic:quote',quoteExpires:'2030-01-01T00:00:00Z',feeBank,principalBank,providerVerified:true,recipientVerified:true,coverageVerified:true,budgetApproved:true,restrictionsClear:true};
  const [a,b]=await Promise.all([invoke(approved.payout,'claim',l.owner,'payout_claim',f,key),invoke(approved.payout,'claim',l.owner,'payout_claim',f,key)]);assert.deepEqual(a,b);assert.equal(a.status,'held');assert.equal(a.principal,'1000');assert.equal(await balance(a.hold),1000n);
  assert.equal((await invoke(approved.payout,'claim',l.owner,'payout_claim',f)).reason,'EXISTING_PAYOUT_HOLD_RECONCILE_FIRST');
  const outcome={attempt:key,providerMessage:'synthetic:'+id(),state:'success',reconciled:true,currency:'GBP',quote:f.quote,principalPaid:'1000',bankFee:'0',transferFee:'0'};
  const [one,two]=await Promise.all([invoke(approved.payout,'outcome',l.owner,'payout_outcome',outcome),invoke(approved.payout,'outcome',l.owner,'payout_outcome',{...outcome,providerMessage:'synthetic:'+id()})]);
  assert.deepEqual(one,two);assert.equal(one.status,'paid');assert.equal(await balance(a.hold),0n);
  assert.equal((await query("SELECT count(*)::int n FROM finance_policy_records WHERE kind='payout_terminal' AND scope=$1",[l.owner]))[0].n,1);
 });
};
