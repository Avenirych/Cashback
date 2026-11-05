import {ContentModerationService} from '../forum/content-moderation.service';
import {ActivityService} from '../activity/activity.service';

/** Real service methods with an entirely mocked manager: no SQL or service startup. */
describe('revoked actor cannot reach privileged writes',()=>{
  const keys=['CASHBACK_CONTENT_MODERATION','CASHBACK_FORUM_READ_ONLY','CASHBACK_ACTIVITY_LIMITS'] as const;
  let saved:Record<string,string|undefined>;
  beforeEach(()=>{
    saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
    process.env.CASHBACK_CONTENT_MODERATION='true';process.env.CASHBACK_FORUM_READ_ONLY='false';process.env.CASHBACK_ACTIVITY_LIMITS='true';
  });
  afterEach(()=>{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
  function fixture(){
    const query=jest.fn(async(sql:string)=>{
      if(sql.includes('FROM forum_moderation_schema'))return[{version:3}];
      if(sql.includes('SELECT session_version'))return[{session_version:1}];
      if(sql.startsWith('SET LOCAL')||sql.includes('pg_advisory_xact_lock_shared'))return[];
      throw Error('Unexpected downstream query after revoked-session fence');
    });
    const m:any={query};const db:any={transaction:async(work:any)=>work(m)};return{db,query};
  }
  function noWrites(query:jest.Mock){
    for(const [sql]of query.mock.calls)expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|DELETE)\b/i);
    expect(query.mock.calls.some(([sql])=>String(sql).includes('FOR SHARE'))).toBe(true);
    expect(query.mock.calls.some(([sql])=>String(sql).includes('forum_moderators'))).toBe(false);
  }
  it('moderation publish with a stale actor version fails before case/audit/notification writes',async()=>{
    const f=fixture();await expect(new ContentModerationService(f.db).decide(2,9,'publish','Synthetic decision',0))
      .rejects.toMatchObject({status:401});noWrites(f.query);
  });
  it('appeal resolution with a stale actor version fails before decision writes',async()=>{
    const f=fixture();await expect(new ContentModerationService(f.db).resolveAppeal(2,9,true,'Synthetic appeal',false,0))
      .rejects.toMatchObject({status:401});noWrites(f.query);
  });
  it('admin resolution with a stale actor version fails before resolving the appeal',async()=>{
    const f=fixture();await expect(new ActivityService(f.db).resolve(2,9,'Synthetic resolution',0))
      .rejects.toMatchObject({status:401});noWrites(f.query);
  });
});
