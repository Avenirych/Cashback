import {DataSource} from 'typeorm';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {User} from './users/user.entity';
import {ForumUser} from './forum/forum-user.entity';
import {ForumTopic} from './forum/forum-topic.entity';
import {ForumPost} from './forum/forum-post.entity';
import {Topic} from './topics.entity';
import {Post} from './posts.entity';
import {AnalyticsEvent} from './analytics/analytics.entity';
class MetadataOnly extends DataSource { async inspectOnly(){await this.buildMetadatas();return this.entityMetadatas;} }
test('reviewed baseline has every historical loaded entity column without a database connection',async()=>{
 const ds=new MetadataOnly({type:'postgres',entities:[User,ForumUser,ForumTopic,ForumPost,Topic,Post,AnalyticsEvent],synchronize:false,migrationsRun:false,installExtensions:false});
 const connect=jest.spyOn(ds.driver,'connect').mockRejectedValue(new Error('NO_DATABASE_CONNECTION_ALLOWED'));
 const metadata=await ds.inspectOnly();const sql=readFileSync(join(__dirname,'../docker/historical/schema.sql'),'utf8');
 expect(metadata).toHaveLength(7);
 for(const entity of metadata){
   const declaration=sql.split('CREATE TABLE public.'+entity.tableName+' (')[1]?.split('\n);')[0];
   expect(declaration).toBeDefined();
   const additive=readFileSync(join(__dirname,'../docker/historical/migrations/20261020-extended-registration.sql'),'utf8');
   const reviewedDeclaration=declaration+(entity.tableName==='users'?' '+Array.from(additive.matchAll(/ADD COLUMN ([a-z0-9_]+) (varchar\(\d+\))/g),m=>m[1]+' '+m[2]).join(' '):'');
   for(const column of entity.columns)expect(reviewedDeclaration).toMatch(new RegExp('(?:^|[\\s,])"?'+column.databaseName+'"?\\s','m'));
 }
 expect(connect).not.toHaveBeenCalled();
 expect(sql).toContain("current_database() <> 'cashback_historical_03573b7'");
 expect(sql).toContain("table_schema='public'");expect(sql).not.toMatch(/DROP TABLE|ALTER TABLE/i);
});
test('Compose publishes only loopback endpoints and keeps PostgreSQL private with a new volume',()=>{
 const c=JSON.parse(readFileSync(join(__dirname,'../docker/historical/compose.json'),'utf8'));
 expect(c.services['historical-postgres'].ports).toBeUndefined();
 expect(c.services['historical-postgres'].networks).toEqual(['database']);
 expect(c.networks.database.internal).toBe(true);
 expect(c.volumes.database.name).toBe('cashback-historical-03573b7-local-pgdata');
 expect(c.services.backend.ports).toEqual(['127.0.0.1:3006:3006']);
 expect(c.services.frontend.ports).toEqual(['127.0.0.1:3004:3000']);
 expect(c.services['historical-mailpit'].ports).toEqual(['127.0.0.1:8036:8025']);
 for(const service of Object.values(c.services) as any[])expect(service.volumes||[]).not.toContain('/var/run/docker.sock:/var/run/docker.sock');
});
