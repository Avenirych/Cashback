'use strict';
// Read-only analysis: no pg clients, sockets, SQL execution or secret loading.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const files=['apply.sql','00-preflight.sql','10-schema.sql','20-runtime.sql','30-verify.sql','40-runtime-negative.sql'];
function preprocess(sql){return sql.replace(/\\gset/g,';').split('\n').filter(l=>!l.trimStart().startsWith('\\')).join('\n').replace(/:'[a-z_]+'/g,"'PARSER_FIXTURE_ONLY'");}
function contract(source){
 source=Object.fromEntries(Object.entries(source).map(([k,v])=>[k,v.split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n")]));
 assert.match(source['apply.sql'],/BEGIN;[\s\S]*00-preflight.sql[\s\S]*10-schema.sql[\s\S]*20-runtime.sql[\s\S]*30-verify.sql[\s\S]*COMMIT;/);
 for(const x of ['expected_system_identifier','expected_database_oid','expected_data_directory','approval'])assert.ok(source['00-preflight.sql'].includes(':{?'+x+'}'));
 for(const x of ['STAGING_NEW_EMPTY_IDENTITY_REQUIRED','pg_try_advisory_xact_lock','7698666936429441062',"current_database()<>'cashback_staging_app'","inet_server_addr() IS NOT NULL"])assert.ok(source['00-preflight.sql'].includes(x));
 assert.doesNotMatch(source['10-schema.sql'],/\\ir|account_uuid|CREATE (?:SCHEMA|TABLE) (?:public\.)?finance[.\s]/i);
 assert.match(source['10-schema.sql'],/CHECK\(balance=0\)/);assert.match(source['10-schema.sql'],/example\[.\]invalid/);
 assert.doesNotMatch(source['20-runtime.sql'],/GRANT[^;]*(?:bonus_items|bonus_transfers|TO PUBLIC|WITH GRANT OPTION)/i);
 assert.match(source['20-runtime.sql'],/NOINHERIT NOREPLICATION NOBYPASSRLS/);
 assert.doesNotMatch(source['20-runtime.sql'],/GRANT (?:CREATE|ALL|TEMP)|GRANT [^;]* TO cashback_staging_runtime WITH ADMIN|GRANT UPDATE ON public.users/i);
 return true;
}
async function validate(parserPath){
 const parser=require(parserPath),sources=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(__dirname,f),'utf8')]));contract(sources);
 const parsed={};for(const f of files){parsed[f]=await parser.parse(preprocess(sources[f]));assert.ok(parsed[f].version>=170000&&parsed[f].version<180000);}
 const tables=parsed['10-schema.sql'].stmts.map(x=>x.stmt.CreateStmt).filter(Boolean),columns={};
 for(const t of tables)columns[(t.relation.schemaname||'public')+'.'+t.relation.relname]=t.tableElts.filter(x=>x.ColumnDef).map(x=>x.ColumnDef.colname);
 assert.equal(Object.keys(columns).filter(x=>x.startsWith('public.')).length,18);
 require(path.join(root,'node_modules/reflect-metadata'));
 require(path.join(root,'node_modules/ts-node')).register({transpileOnly:true,project:path.join(root,'tsconfig.json')});
 const imports=[['users/user.entity','User'],['forum/forum-user.entity','ForumUser'],['forum/forum-topic.entity','ForumTopic'],['forum/forum-post.entity','ForumPost'],['topics.entity','Topic'],['posts.entity','Post'],['analytics/analytics.entity','AnalyticsEvent'],['marketing-preferences/marketing-preferences.entity','MarketingPreferences'],['bonus/bonus-item.entity','BonusItem'],['bonus/bonus-transfer.entity','BonusTransfer']];
 const entities=imports.map(([file,key])=>require(path.join(root,'src',file))[key]);const {DataSource}=require(path.join(root,'node_modules/typeorm'));
 const ds=new DataSource({type:'postgres',entities,synchronize:false,migrationsRun:false,installExtensions:false});ds.initialize=async()=>{throw Error('NO_DATABASE_ALLOWED');};ds.query=async()=>{throw Error('NO_DATABASE_ALLOWED');};await ds.buildMetadatas();
 const sqlTables=new Map(tables.map(t=>[t.relation.relname,t]));
 const typeAliases={varchar:'character varying',text:'text',int4:'integer',serial:'integer',int8:'bigint',bool:'boolean',timestamp:'timestamp without time zone',timestamptz:'timestamp with time zone',numeric:'numeric',uuid:'uuid',jsonb:'jsonb'};
 const entityProof=[];for(const m of ds.entityMetadatas){const actual=columns['public.'+m.tableName];assert.ok(actual,m.tableName);for(const c of m.columns){
 assert.ok(actual.includes(c.databaseName),m.tableName+'.'+c.databaseName);
 const col=sqlTables.get(m.tableName).tableElts.map(x=>x.ColumnDef).find(x=>x?.colname===c.databaseName),rawType=col.typeName.names.at(-1).String.sval;
 const expected=c.type==='enum'?c.enumName:ds.driver.normalizeType(c);assert.equal(typeAliases[rawType]||rawType,expected,m.tableName+'.'+c.databaseName+' type');
 const required=(col.constraints||[]).some(x=>['CONSTR_NOTNULL','CONSTR_PRIMARY'].includes(x.Constraint?.contype));assert.equal(required,!c.isNullable,m.tableName+'.'+c.databaseName+' nullable');
 if(c.type==='decimal'||c.type==='numeric'){const mods=col.typeName.typmods.map(x=>x.A_Const.ival.ival);assert.deepEqual(mods,[c.precision,c.scale]);}
 }
 for(const fk of m.foreignKeys){const all=[];for(const x of sqlTables.get(m.tableName).tableElts){if(x.Constraint?.contype==='CONSTR_FOREIGN')all.push(x.Constraint);for(const v of x.ColumnDef?.constraints||[])if(v.Constraint?.contype==='CONSTR_FOREIGN')all.push({...v.Constraint,localColumns:[x.ColumnDef.colname]});}
 assert.ok(all.some(x=>x.pktable.relname===fk.referencedTablePath&&JSON.stringify(x.localColumns||x.fk_attrs?.map(v=>v.String.sval))===JSON.stringify(fk.columnNames)&&JSON.stringify(x.pk_attrs?.map(v=>v.String.sval))===JSON.stringify(fk.referencedColumnNames)),m.tableName+' FK');
 }
 for(const idx of m.indices){const found=parsed['10-schema.sql'].stmts.map(x=>x.stmt.IndexStmt).find(x=>x?.idxname===idx.name);assert.ok(found,m.tableName+' index '+idx.name);assert.deepEqual(found.indexParams.map(x=>x.IndexElem.name),idx.columns.map(c=>c.databaseName));}
 for(const unique of m.uniques){const all=[];for(const x of sqlTables.get(m.tableName).tableElts){if(x.Constraint?.contype==='CONSTR_UNIQUE')all.push(x.Constraint.keys.map(v=>v.String.sval));for(const v of x.ColumnDef?.constraints||[])if(v.Constraint?.contype==='CONSTR_UNIQUE')all.push([x.ColumnDef.colname]);}assert.ok(all.some(cols=>JSON.stringify(cols)===JSON.stringify(unique.columns.map(c=>c.databaseName))),m.tableName+' unique');}
 entityProof.push({table:m.tableName,columns:m.columns.map(c=>c.databaseName),indexes:m.indices.map(x=>x.name),uniqueColumns:m.uniques.map(u=>u.columns.map(c=>c.databaseName))});}
 const grants=parsed['20-runtime.sql'].stmts.map(x=>x.stmt.GrantStmt).filter(x=>x?.is_grant);
 const matrix=[];for(const g of grants){assert.equal(g.grant_option,undefined);assert.ok(g.privileges);for(const to of g.grantees)assert.equal(to.RoleSpec.rolename,'cashback_staging_runtime');for(const obj of g.objects){const name=obj.RangeVar?.relname||obj.String?.sval||obj.ObjectWithArgs?.objname?.map(x=>x.String.sval).join('.')||JSON.stringify(obj);if(g.objtype==='OBJECT_TABLE'){assert.ok(columns['public.'+name]);assert.ok(!['bonus_items','bonus_transfers'].includes(name));for(const p of g.privileges)for(const c of p.AccessPriv.cols||[])assert.ok(columns['public.'+name].includes(c.String.sval));}matrix.push({kind:g.objtype,object:name,privileges:g.privileges.map(x=>({privilege:x.AccessPriv.priv_name,columns:x.AccessPriv.cols?.map(c=>c.String.sval)}))});}}
 const users=matrix.filter(x=>x.object==='users'),updates=users.flatMap(x=>x.privileges).filter(x=>x.privilege==='update');assert.equal(updates.length,1);assert.ok(updates[0].columns&&!updates[0].columns.includes('balance'));
 for(const t of ['forum_users','forum_topics','forum_posts','topic','post'])assert.deepEqual(matrix.find(x=>x.object===t).privileges.map(x=>x.privilege),['select']);
 for(const t of ['activity_limit_usage','activity_limit_operations','activity_security_events','activity_limit_appeals'])assert.deepEqual(matrix.find(x=>x.object===t).privileges.map(x=>x.privilege),['select','insert','update','delete']);
 const flat=matrix.flatMap(x=>x.privileges.map(p=>({kind:x.kind,object:x.object,privilege:p.privilege,...(p.columns?{columns:p.columns}:{})})));
 const key=x=>JSON.stringify({...x,...(x.columns?{columns:[...x.columns].sort()}:{} )});
 assert.deepEqual(flat.map(key).sort(),JSON.parse(fs.readFileSync(path.join(__dirname,'grant-policy.json'),'utf8')).map(key).sort(),'exact ACL policy');
 const negative=[];for(const [name,change]of Object.entries({financialGrant:s=>{s['20-runtime.sql']+='GRANT INSERT ON bonus_items TO cashback_staging_runtime;';},broadUsersUpdate:s=>{s['20-runtime.sql']+='GRANT UPDATE ON public.users TO cashback_staging_runtime;';},missingIdentity:s=>{s['00-preflight.sql']=s['00-preflight.sql'].replace(':{?expected_system_identifier}','');},missingZeroBalance:s=>{s['10-schema.sql']=s['10-schema.sql'].replace('CHECK(balance=0)','');},wrongTarget:s=>{s['00-preflight.sql']=s['00-preflight.sql'].replace("current_database()<>'cashback_staging_app'","current_database()<>'other'");},skipPreflight:s=>{s['apply.sql']=s['apply.sql'].replace('00-preflight.sql','NO.sql');}})){const clone={...sources};change(clone);assert.throws(()=>contract(clone));negative.push({name,rejected:true});}
 await assert.rejects(()=>parser.parse('CREATE TABLE broken (id integer,,)'));negative.push({name:'invalidSQL',rejected:true});
 return {parserVersion:parsed['10-schema.sql'].version,sqlFiles:files,statements:Object.fromEntries(files.map(f=>[f,parsed[f].stmts.length])),publicTables:18,entities:entityProof,grants:matrix,negative,postgresExecuted:false,plpgsqlBodies:'DO bodies reviewed, not server-compiled; future PG17 rehearsal mandatory',metadataCheck:'names, types, nullability, decimal precision/scale and FK metadata matched offline; not physical catalog/ACL runtime proof'};
}
module.exports={preprocess,contract,validate};
if(require.main===module)validate(process.env.STAGING_SQL_PARSER).then(r=>{if(!process.env.STAGING_SQL_REPORT)throw Error('D_REPORT_REQUIRED');assert.match(process.env.STAGING_SQL_REPORT,/^D:[\\/]/i);fs.writeFileSync(process.env.STAGING_SQL_REPORT,JSON.stringify(r,null,2));console.log(JSON.stringify({parser:r.parserVersion,files:r.sqlFiles.length,entities:r.entities.length,negative:r.negative.length,postgresExecuted:false}));}).catch(e=>{console.error(e.message);process.exitCode=1;});
