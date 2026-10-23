import {BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, ServiceUnavailableException,Optional} from '@nestjs/common';
import {ActivityService} from '../activity/activity.service';
import {DataSource, EntityManager} from 'typeorm';
import {createHash} from 'node:crypto';
import {contentModerationEnabled, moderationSignals, restriction, CURRENT_FORUM_RULES_VERSION} from './moderation-policy';

type Kind = 'topic' | 'post' | 'review';
function id(value: number) { if (!Number.isSafeInteger(value) || value <= 0) throw new BadRequestException('Invalid identifier'); }
function text(value: unknown, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /\u0000/.test(value)) throw new BadRequestException('Invalid text length');
  return value.trim();
}
@Injectable()
export class ContentModerationService {
  constructor(private readonly db: DataSource,@Optional() private readonly activity?:ActivityService) {}
  async installed(): Promise<boolean> {
    try {const [row]=await this.db.query("SELECT to_regclass('public.forum_moderation_schema') IS NOT NULL AS installed");return row?.installed===true;}
    catch {throw new ServiceUnavailableException('Cannot establish moderation readiness');}
  }
  async configuration() {
    if (!contentModerationEnabled() || process.env.CASHBACK_FORUM_READ_ONLY==='true') return {enabled:false};
    try { return await this.tx(async m => {await this.publicationReady(m);return {enabled:true};}); } catch { return {enabled:false}; }
  }
  private async publicationReady(m:EntityManager) {
    if(process.env.CASHBACK_PUBLIC_CONTENT!=='true')throw new ServiceUnavailableException('Public content is not activated');
    // Checked on every submission, not cached in JWTs or inferred from a demo UI.
    const rows=await m.query(`SELECT fm.user_id FROM forum_moderators fm
      JOIN users u ON u.id=fm.user_id JOIN forum_users f ON f.user_id=u.id
      WHERE fm.active=true AND u.email_verified=true AND f.banned=false
      AND f.agreed_to_rules=true AND f.rules_version=$1
      AND EXISTS(SELECT 1 FROM forum_owner_bootstrap WHERE singleton=true AND owner_user_id=fm.user_id AND consumed_at IS NOT NULL AND privacy_acknowledged_at IS NOT NULL)
      LIMIT 1`,[CURRENT_FORUM_RULES_VERSION]);
    if(!rows.length)throw new ServiceUnavailableException('An eligible moderator and privacy appointment are required');
  }
  async acceptance(userId:number) {
    return this.tx(async m=>{await this.verified(m,userId);const [f]=await m.query('SELECT agreed_to_rules,rules_version FROM forum_users WHERE user_id=$1',[userId]);return {accepted:f?.agreed_to_rules===true&&f.rules_version===CURRENT_FORUM_RULES_VERSION,version:CURRENT_FORUM_RULES_VERSION};},true);
  }
  async acceptRules(userId:number, agreed:unknown) {
    if(agreed!==true)throw new BadRequestException('Explicit agreement required');
    return this.tx(async m=>{await this.lock(m,userId);await this.verified(m,userId);
      if(!(await m.query('SELECT id FROM forum_users WHERE user_id=$1 FOR UPDATE',[userId])).length)throw new ForbiddenException('Forum registration required');
      await m.query('UPDATE forum_users SET agreed_to_rules=true,rules_version=$2,agreed_to_rules_at=CASE WHEN rules_version IS DISTINCT FROM $2 THEN clock_timestamp() ELSE agreed_to_rules_at END WHERE user_id=$1',[userId,CURRENT_FORUM_RULES_VERSION]);
      await m.query('INSERT INTO forum_rule_acceptances(user_id,version) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,CURRENT_FORUM_RULES_VERSION]);return {accepted:true,version:CURRENT_FORUM_RULES_VERSION};
    });
  }
  private async tx<T>(work: (m: EntityManager) => Promise<T>, readOnly=false): Promise<T> {
    if (!readOnly && (process.env.CASHBACK_FORUM_READ_ONLY==='true' || !contentModerationEnabled())) throw new ServiceUnavailableException('Content moderation is not activated');
    try {
      return await this.db.transaction(async m => {
        if(readOnly)await m.query('SET TRANSACTION READ ONLY');
        else await m.query('SELECT pg_advisory_xact_lock_shared(62023,1)');
        if (!(await m.query('SELECT version FROM forum_moderation_schema WHERE version=3')).length) throw new ServiceUnavailableException('Moderation schema not ready');
        return work(m);
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Moderation unavailable; no publication was accepted');
    }
  }
  private async lock(m: EntityManager, userId: number) {
    id(userId); await m.query('SELECT pg_advisory_xact_lock(62022,$1::integer)', [userId]);
  }
  private async member(m: EntityManager, userId: number) {
    id(userId);
    const [u] = await m.query('SELECT f.* FROM forum_users f JOIN users u ON u.id=f.user_id WHERE u.id=$1 AND u.email_verified=true', [userId]);
    if (!u || !u.agreed_to_rules || u.rules_version!==CURRENT_FORUM_RULES_VERSION || u.banned) throw new ForbiddenException('Verified forum membership and acceptance of the current rules are required');
    return u;
  }
  private async verified(m: EntityManager, userId: number) {
    id(userId);
    if (!(await m.query('SELECT id FROM users WHERE id=$1 AND email_verified=true', [userId])).length) throw new ForbiddenException('Verified account required');
  }
  private async moderator(m: EntityManager, userId: number) {
    await this.member(m, userId);
    if (!(await m.query('SELECT user_id FROM forum_moderators WHERE user_id=$1 AND active=true', [userId])).length) throw new ForbiddenException('Moderator role required');
  }
  private async limits(m: EntityManager, userId: number) {
    const rows = await m.query('SELECT confirmed_at FROM forum_content_cases WHERE author_id=$1 AND confirmed_at IS NOT NULL AND revoked_at IS NULL ORDER BY confirmed_at,id', [userId]);
    return restriction(rows.map((x: {confirmed_at: string}) => new Date(x.confirmed_at)));
  }
  async assertCanCommunicate(userId: number) {
    return this.tx(async m => { await this.lock(m, userId); await this.member(m, userId);
      if ((await this.limits(m, userId)).blocked) throw new ForbiddenException('Forum publication is restricted'); });
  }
  async withCommunication<T>(userId:number, work:(m:EntityManager)=>Promise<T>):Promise<T> {
    return this.tx(async m=>{await this.lock(m,userId);await this.member(m,userId);
      if((await this.limits(m,userId)).blocked)throw new ForbiddenException('Forum publication is restricted');
      return work(m);
    });
  }
  private async event(m: EntityManager, c: {id: number; author_id: number}, actor: number, action: string, reason: string) {
    const [e]=await m.query('INSERT INTO forum_moderation_events(case_id,action) VALUES($1,$2) RETURNING id',[c.id,action]);
    await m.query('INSERT INTO forum_event_details(event_id,reason) VALUES($1,$2)',[e.id,reason]);
    await m.query('INSERT INTO forum_event_identities(event_id,subject_id,actor_id) VALUES($1,$2,$3)',[e.id,c.author_id,actor]);
  }
  async submit(userId: number, kind: Kind, input: {title?: unknown; body?: unknown; topicId?: number; rating?: unknown; experienceConfirmed?:unknown}, requestKey?: string) {
    if (!['topic','post','review'].includes(kind)) throw new BadRequestException('Invalid content kind');
    const title = kind === 'post' ? '' : text(input.title,3,255);
    const body = kind === 'topic' ? '' : text(input.body,kind === 'review' ? 20 : 1,4000);
    if (kind === 'post') id(input.topicId!);
    if (kind === 'review' && (!Number.isInteger(input.rating) || Number(input.rating)<1 || Number(input.rating)>5)) throw new BadRequestException('Rating must be 1–5');
    if (kind === 'review' && input.experienceConfirmed !== true) throw new BadRequestException('Confirm this is your genuine experience');
    const material = JSON.stringify([kind,title,body,input.topicId ?? null,kind === 'review' ? input.rating : null]);
    const hash = createHash('sha256').update(material).digest('hex');
    const key = requestKey ? text(requestKey,8,100) : hash;
    return this.tx(async m => {
      await this.publicationReady(m);
      await this.lock(m,userId); await this.member(m,userId);
      const [old] = await m.query('SELECT * FROM forum_content_cases WHERE author_id=$1 AND request_key=$2', [userId,key]);
      if (old) { if (old.request_hash !== hash) throw new ConflictException('Request key already used for other content'); return {id:old.target_id,caseId:old.id,status:old.state}; }
      if ((await this.limits(m,userId)).blocked) throw new ForbiddenException('Forum publication is restricted');
      const [rate] = await m.query("SELECT count(*)::integer AS n FROM forum_content_cases WHERE author_id=$1 AND created_at>clock_timestamp()-interval '10 minutes'", [userId]);
      if (rate.n >= 20) throw new ForbiddenException('Publication rate limit');
      if (kind === 'review' && (await m.query("SELECT id FROM forum_content_cases WHERE author_id=$1 AND kind='review'",[userId])).length) throw new ConflictException('One review per account; contact moderation to amend it');
        let activityReservation:any;
        if(process.env.CASHBACK_ACTIVITY_LIMITS==='true'){
          if(!this.activity)throw new ServiceUnavailableException('Activity protection required');
          activityReservation=await this.activity.engine.reserve(m,{subject:this.activity.subject(userId),userId,action:kind,partner:'forum',mode:'real',key,material});
          if(activityReservation.state!=='reserved')throw new ConflictException('Activity/content replay mismatch');
        }
        let target;
      if (kind === 'post') {
        if (!(await m.query("SELECT t.id FROM forum_topics t JOIN forum_content_cases c ON c.target_id=t.id AND c.kind IN ('topic','review') WHERE t.id=$1 AND c.state='published' FOR SHARE OF c",[input.topicId])).length) throw new BadRequestException('Published topic not found');
        [target] = await m.query('INSERT INTO forum_posts(content,"authorId","topicId") VALUES($1,$2,$3) RETURNING id',[body,userId,input.topicId]);
      } else {
        [target] = await m.query('INSERT INTO forum_topics(title,"authorId",category,review_body,review_rating,review_attested_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $3=\'cashback-review\' THEN clock_timestamp() ELSE NULL END) RETURNING id',[title,userId,kind === 'review' ? 'cashback-review':'discussion',kind === 'review' ? body:null,kind === 'review' ? input.rating:null]);
      }
      const [c] = await m.query('INSERT INTO forum_content_cases(kind,target_id,author_id,request_key,request_hash,signals) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING id,author_id',[kind,target.id,userId,key,hash,JSON.stringify(moderationSignals(title+' '+body))]);
      await this.event(m,c,userId,'submitted','Awaiting human moderation');
        if(activityReservation)await this.activity!.engine.settle(m,activityReservation.id,'confirmed');
      return {id:target.id,caseId:c.id,status:'pending'};
    });
  }
  async read(kind: 'topics' | 'posts' | 'reviews', targetId?: number) {
    if (!contentModerationEnabled() && !(await this.installed())) { if (kind === 'reviews') return []; throw new ServiceUnavailableException(); }
    if (targetId !== undefined) id(targetId);
    return this.tx(async m => {
      const posts = kind === 'posts';
      const rows: Record<string, unknown>[] = await m.query(posts
        ? `SELECT p.id,c.id AS case_id,p.content,p.created_at,f.username,f.avatar_url,f.created_at AS joined_at FROM forum_posts p JOIN forum_content_cases c ON c.kind='post' AND c.target_id=p.id JOIN forum_topics t ON t.id=p."topicId" JOIN forum_content_cases parent ON parent.target_id=t.id AND parent.kind IN ('topic','review') JOIN forum_users f ON f.user_id=p."authorId" WHERE c.state='published' AND parent.state='published' AND p."topicId"=$1 ORDER BY p.created_at,p.id LIMIT 100`
        : `SELECT t.id,c.id AS case_id,t.title,t.review_body,t.review_rating,t.category,t.created_at,f.username,f.avatar_url,f.created_at AS joined_at FROM forum_topics t JOIN forum_content_cases c ON c.target_id=t.id AND c.kind IN ('topic','review') JOIN forum_users f ON f.user_id=t."authorId" WHERE c.state='published' AND ($1::integer IS NULL OR t.id=$1) AND ($2::boolean=false OR t.category='cashback-review') ORDER BY t.created_at DESC,t.id DESC LIMIT 100`, posts ? [targetId] : [targetId ?? null,kind === 'reviews']);
      return rows.map((r: Record<string, unknown>) => ({id:r.id,caseId:Number(r.case_id),created_at:r.created_at,...(kind === 'reviews'?{status:'published',demo:false}:{}),...(posts ? {content:r.content}:{title:r.title,category:r.category,body:r.review_body,rating:r.review_rating}),author:{id:null,username:r.username,avatar_url:r.avatar_url,created_at:r.joined_at}}));
    },true);
  }
  async queue(actor: number) {
    return this.tx(async m => {await this.moderator(m,actor);return m.query(`SELECT c.*,t.title,t.review_body,p.content,a.id AS appeal_id,a.reason AS appeal_reason FROM forum_content_cases c LEFT JOIN forum_topics t ON c.target_id=t.id AND c.kind IN ('topic','review') LEFT JOIN forum_posts p ON c.target_id=p.id AND c.kind='post' LEFT JOIN forum_content_appeals a ON a.case_id=c.id AND a.outcome IS NULL WHERE c.needs_review=true OR a.id IS NOT NULL ORDER BY c.created_at,c.id LIMIT 100`);},true);
  }
  private async lockedCase(m: EntityManager, caseId: number) {
    id(caseId);
    const [probe] = await m.query('SELECT author_id FROM forum_content_cases WHERE id=$1',[caseId]);
    if (!probe?.author_id) throw new BadRequestException('Case unavailable');
    await this.lock(m,probe.author_id);
    const [c] = await m.query('SELECT * FROM forum_content_cases WHERE id=$1 FOR UPDATE',[caseId]);
    if(!c || c.author_id!==probe.author_id)throw new ConflictException('Case changed; retry');
    return c;
  }
  async decide(actor: number, caseId: number, decision: 'publish' | 'confirm' | 'hold', reason: unknown) {
    const explanation = text(reason,3,2000);
    if (!['publish','confirm','hold'].includes(decision)) throw new BadRequestException('Invalid decision');
    return this.tx(async m => {
      await this.moderator(m,actor); const c = await this.lockedCase(m,caseId);
      if(c.material_erased_at)throw new ConflictException('Material was erased; cannot republish or adjudicate it');
      if (c.author_id === actor) throw new ForbiddenException('Cannot moderate your own material');
      if ((c.confirmed_at && !c.revoked_at) || (c.revoked_at && decision !== 'publish')) throw new ConflictException('Use the appeal process for a confirmed decision');
      if (decision === 'publish') {
        const table = c.kind === 'post' ? 'forum_posts':'forum_topics';
        if (!(await m.query('SELECT id FROM '+table+' WHERE id=$1',[c.target_id])).length) throw new ConflictException('Content was deleted');
        const previouslyPublished=await m.query("SELECT id FROM forum_moderation_events WHERE case_id=$1 AND action='publish' LIMIT 1",[caseId]);
        if(!previouslyPublished.length){await this.member(m,c.author_id);if((await this.limits(m,c.author_id)).blocked)throw new ForbiddenException('Author publication restriction is active');}
      }
      await m.query("UPDATE forum_content_cases SET state=$2,needs_review=$3,decision_by=$4,confirmed_at=CASE WHEN $5::boolean THEN clock_timestamp() ELSE confirmed_at END WHERE id=$1",[caseId,decision === 'publish' ? 'published':'hidden',false,actor,decision === 'confirm']);
      await this.event(m,c,actor,decision,explanation);
      return {caseId,status:decision,restriction:await this.limits(m,c.author_id)};
    });
  }
  async report(userId: number, caseId: number, reason: unknown) {
    const explanation = text(reason,3,2000);
    return this.tx(async m => {
      await this.lock(m,userId); await this.verified(m,userId); id(caseId);
      const [rate] = await m.query("SELECT count(*)::integer AS n FROM forum_content_reports WHERE reporter_id=$1 AND created_at>clock_timestamp()-interval '1 hour'",[userId]);
      if (rate.n>=10) throw new ForbiddenException('Report rate limit');
      const [c] = await m.query("SELECT * FROM forum_content_cases WHERE id=$1 AND state='published'",[caseId]);
      if (!c) throw new BadRequestException('Published content not found');
      const saved = await m.query('INSERT INTO forum_content_reports(case_id,reporter_id,reason) VALUES($1,$2,$3) ON CONFLICT(case_id,reporter_id) DO NOTHING RETURNING id',[caseId,userId,explanation]);
      if (saved.length) {await m.query('UPDATE forum_content_cases SET needs_review=true WHERE id=$1',[caseId]);await this.event(m,c,userId,'reported','New report for human review');}
      // Reports alone neither hide lawful criticism nor create strikes.
      return {accepted:true};
    });
  }
  async appeal(userId: number, caseId: number, reason: unknown) {
    const explanation = text(reason,3,2000);
    return this.tx(async m => {
      await this.verified(m,userId); const c=await this.lockedCase(m,caseId);
      if (c.author_id!==userId || !c.confirmed_at || c.revoked_at) throw new ForbiddenException('No appealable decision for this account');
      await m.query('INSERT INTO forum_content_appeals(case_id,user_id,reason) VALUES($1,$2,$3) ON CONFLICT(case_id) DO NOTHING',[caseId,userId,explanation]);
      return {accepted:true};
    });
  }
  async resolveAppeal(actor: number, caseId: number, revoke: boolean, reason: unknown, manual = false) {
    const explanation=text(reason,3,2000);
    return this.tx(async m => {
      await this.moderator(m,actor); const c=await this.lockedCase(m,caseId);
      if (actor===c.author_id || actor===c.decision_by) throw new ForbiddenException('An independent moderator must review this appeal');
      const [a]=await m.query('SELECT * FROM forum_content_appeals WHERE case_id=$1 AND outcome IS NULL FOR UPDATE',[caseId]);
      if ((!a && !manual) || !c.confirmed_at || c.revoked_at) throw new ConflictException('No appealable confirmed decision');
      if (a) await m.query('UPDATE forum_content_appeals SET outcome=$2,reviewer_id=$3,resolved_at=clock_timestamp() WHERE id=$1',[a.id,revoke?'revoked':'upheld',actor]);
      if(revoke) await m.query("UPDATE forum_content_cases SET revoked_at=clock_timestamp(),state='pending',needs_review=true WHERE id=$1",[caseId]);
      await this.event(m,c,actor,manual?'manual-revoke':revoke?'revoked':'upheld',explanation);
      return {restriction:await this.limits(m,c.author_id)};
    });
  }
  async mine(userId: number) {
    return this.tx(async m => { await this.verified(m,userId);
      return {restriction:await this.limits(m,userId),cases:await m.query('SELECT id,kind,target_id,state,confirmed_at,revoked_at,created_at FROM forum_content_cases WHERE author_id=$1 ORDER BY id DESC LIMIT 100',[userId]),notifications:await m.query('SELECT e.id,e.case_id,e.action,d.reason,e.created_at FROM forum_moderation_events e JOIN forum_event_identities i ON i.event_id=e.id JOIN forum_event_details d ON d.event_id=e.id WHERE i.subject_id=$1 ORDER BY e.id DESC LIMIT 100',[userId])}; },true);
  }
}
