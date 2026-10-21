import type {EntityManager} from 'typeorm';
import {randomUUID} from 'node:crypto';
import {PolicyContext} from './policy-context';
import {POLICY_21} from './policy-2026-10-21';
import {policyPence} from './owner-policy';
export class PolicyCoverage {
 constructor(private readonly c:PolicyContext){}
 async release(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{allocation:string;amount:string;releaseVerified:boolean}>(m,principal,'release_coverage',reference);
  if(this.c.policy!==POLICY_21)throw Error('Coverage coordination policy required');
  return this.c.command(m,actor,key,{action:'release_coverage',facts:f,proof},async()=>{
   if(!f.releaseVerified)return {status:'pending_review',reason:'AUTHORIZED_COVERAGE_RELEASE_REQUIRED'};
   const amount=policyPence(f.amount);if(!amount)throw Error('Positive release required');
   const [a]=await m.query('SELECT a.id,r."targetId" FROM finance_coverage_allocations a JOIN finance_coverage_reservations r ON r.id=a."reservationId" JOIN finance_coverage_targets t ON t.id=r."targetId" WHERE a.id=$1 AND t."creatorId"::text=$2',[f.allocation,actor]);if(!a)throw Error('Owned coverage allocation required');
   await m.query('INSERT INTO finance_coverage_releases(id,allocation,command,actor,amount,proof) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),a.id,actor+':'+key,actor,amount.toString(),proof]);return {status:'released',allocation:a.id,amount:amount.toString(),policy:this.c.policy};
  });
 }
}
