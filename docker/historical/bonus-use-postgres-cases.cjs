'use strict';
module.exports=async function(h){
 const {assert,id,query,tx,approved,invoke,terms,funded,testNew,balance}=h;
 async function select(g,price='200',cap='250'){
  for(const [orderId,amount] of [[g.one,'100'],[g.two,price]]){
   const f={orderSource:'synthetic:lifecycle',orderId,click:g.click,version:1,messageSource:'synthetic:seller',messageId:'msg:'+id(),eligible:true,placedAt:null,amount,amountReference:'synthetic:verified-price',merchantCap:cap,mandatoryCaps:[],restrictionsComplete:true,terms:'synthetic:terms',finality:true};
   await tx(m=>approved.purchase.ingest(m,g.actor,h.proof(g.actor,'order',f)));
  }
  const key='selection:'+id();await invoke(approved.purchase,'select',g.actor,'select',{click:g.click,complete:true,terminalProof:'synthetic:complete',versions:[g.one,g.two].map(orderId=>({source:'synthetic:lifecycle',id:orderId,version:1}))},key);return key;
 }
 await testNew('actual receipt timestamp determines six calendar months; settlement replay cannot mint again',async()=>{
  const l=await funded(),before=await balance(l.available),t=(await terms(l.id))[0];
  assert.equal(t.startedAt,'2026-10-01T00:00:00.000000Z');assert.equal(t.until,'2027-04-01T00:00:00.000000Z');
  assert.deepEqual(await tx(m=>approved.settle(m,l.owner,l.ref)),l.result);assert.equal(await balance(l.available),before);assert.deepEqual((await terms(l.id))[0],t);
 });
 await testNew('concurrent FIFO reservations cannot double spend',async()=>{
  const g=await h.group(),l=await funded(g.actor),second=await h.click(g.actor);
  const results=await Promise.all([g.click,second].map(click=>invoke(approved.purchase,'reserve',g.actor,'reserve_fifo',{click,amount:'600'})));
  assert.equal(results.filter(r=>r.status==='reserved').length,1);assert.equal(await balance(l.available),200n);assert.equal(await balance(l.reserved),600n);
 });
 await testNew('concurrent identical reservation replay has one ledger effect',async()=>{
  const g=await h.group(),l=await funded(g.actor),key='reserve:'+id(),f={click:g.click,amount:'600'};
  const [a,b]=await Promise.all([invoke(approved.purchase,'reserve',g.actor,'reserve_fifo',f,key),invoke(approved.purchase,'reserve',g.actor,'reserve_fifo',f,key)]);
  assert.deepEqual(a,b);assert.equal(await balance(l.available),200n);assert.equal(await balance(l.reserved),600n);
 });
 await testNew('partial application and excess return conserve pence, provenance and original application dates',async()=>{
  const g=await h.group(),l=await funded(g.actor),before=(await terms(l.id))[0],r=await invoke(approved.purchase,'reserve',g.actor,'reserve_fifo',{click:g.click,amount:'600'}),selection=await select(g);
  const f={click:g.click,selection,reservation:r.parts[0].reservation,currentVersionsVerified:true,possibleCashbackPence:'125'},key='apply:'+id();
  const [a,b]=await Promise.all([invoke(approved.purchase,'apply',g.actor,'apply_bonus',f,key),invoke(approved.purchase,'apply',g.actor,'apply_bonus',f,key)]);
  assert.deepEqual(a,b);assert.equal(a.used,'75');assert.equal(a.excess,'525');assert.equal(await balance(l.available),725n);assert.equal(await balance(l.reserved),0n);assert.deepEqual((await terms(l.id))[0],before);
 });
 await testNew('two different apply commands cannot apply the same purchase twice',async()=>{
  const g=await h.group(),l=await funded(g.actor),r=await invoke(approved.purchase,'reserve',g.actor,'reserve_fifo',{click:g.click,amount:'600'}),selection=await select(g);
  const f={click:g.click,selection,reservation:r.parts[0].reservation,currentVersionsVerified:true,possibleCashbackPence:'125'};
  const results=await Promise.all([invoke(approved.purchase,'apply',g.actor,'apply_bonus',f),invoke(approved.purchase,'apply',g.actor,'apply_bonus',f)]);
  assert.equal(results.filter(r=>r.status==='applied').length,1);assert.equal(await balance(l.available),725n);
 });
 await testNew('expired window prevents new purchase reservation without cancelling balance',async()=>{
  const g=await h.group(),l=await funded(g.actor,'2025-01-31T10:00:00.123Z'),r=await invoke(approved.purchase,'reserve',g.actor,'reserve_fifo',{click:g.click,amount:'1'});
  assert.equal(r.reason,'INSUFFICIENT_ELIGIBLE_BONUS');assert.equal(await balance(l.available),800n);assert.equal(await balance(l.reserved),0n);
  const t=(await terms(l.id))[0];assert.equal(t.until,'2025-07-31T10:00:00.123000Z');
 });
 await testNew('historical missing terms fail closed; no invented expiry or loss of balance',async()=>{
  const g=await h.group(),l=await h.lot(g.actor,800n);
  await assert.rejects(invoke(approved.purchase,'reserve',g.actor,'reserve_fifo',{click:g.click,amount:'1'}),/HISTORICAL_TRANSITION_REQUIRED/);assert.equal(await balance(l.available),800n);assert.equal((await terms(l.id)).length,0);
 });
 await testNew('term mutation, duplicate, missing-source and unauthorized writes are rejected by PostgreSQL',async()=>{
  const l=await funded(),before=(await terms(l.id))[0];
  await assert.rejects(tx(m=>m.query('UPDATE finance_bonus_use_terms SET until=until+interval \'1 day\' WHERE lot=$1',[l.id])),/permission denied/i);
  await assert.rejects(h.owner.transaction(m=>m.query('UPDATE finance_bonus_use_terms SET until=until+interval \'1 day\' WHERE lot=$1',[l.id])),/immutable/i);
  await assert.rejects(tx(m=>m.query('INSERT INTO finance_bonus_use_terms SELECT * FROM finance_bonus_use_terms WHERE lot=$1',[l.id])));
  await assert.rejects(tx(m=>m.query('INSERT INTO finance_bonus_use_terms(lot,version,basis,reference,started,until) VALUES($1,$2,$3,$4,now(),now()+interval \'6 months\')',[id(),'BONUS_APPLICATION_2026_10_28','receipt',id()])));
  assert.deepEqual((await terms(l.id))[0],before);
 });
 await testNew('outer settlement error rolls back money, terms and settlement atomically',async()=>{
  const x=await require('./bonus-use-postgres-fixtures.cjs')(h),ref=id();h.receipts.set(ref,x.v);
  await assert.rejects(tx(async m=>{await approved.settle(m,x.v.actor,ref);throw Error('injected settlement failure')}),/injected/);
  assert.equal(await balance(x.unallocated),1000n);assert.equal((await query('SELECT count(*)::int n FROM finance_receipt_settlements WHERE source=$1',[x.v.source]))[0].n,0);
  assert.equal((await tx(m=>approved.settle(m,x.v.actor,ref))).status,'completed');
 });
 await testNew('read-only snapshot isolates owners, preserves unknown and expired balances, and default-denies unmapped identity',async()=>{
  const {BonusUseSnapshot}=require('../../src/finance/bonus-use-snapshot');
  const actor='snapshot:'+id(),l=await funded(actor,'2025-01-31T10:00:00.123Z'),old=await h.lot(actor,50n),other=await funded();
  const service=new BonusUseSnapshot(h.runtime,{resolveOwner:async(_m,p)=>{assert.equal(p,'authenticated-synthetic-principal');return actor;}});
  const read=fn=>tx(async m=>{await m.query('SET TRANSACTION READ ONLY');return fn(m)});
  const snapshot=await read(m=>service.read(m,'authenticated-synthetic-principal'));assert.equal(snapshot.lots.length,2);assert(!snapshot.lots.some(x=>x.id===other.id));
  assert.equal(snapshot.lots.find(x=>x.id===l.id).application.state,'expired');assert.equal(snapshot.lots.find(x=>x.id===old.id).application.state,'unknown');assert.equal(snapshot.lots.find(x=>x.id===l.id).freePence,'800');
  await assert.rejects(read(m=>new BonusUseSnapshot(h.runtime).read(m,'unmapped')),/AUTHORITY_NOT_CONFIGURED/);
  await assert.rejects(read(m=>service.read(m,'forged-principal')));
 });
 await require('./bonus-use-postgres-transfer.cjs')(h);
};
