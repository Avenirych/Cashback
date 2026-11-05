'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),yaml=require('js-yaml');
const {validate,images}=require('./validate.cjs');
const source=yaml.load(fs.readFileSync(path.join(__dirname,'../compose.staging.yaml'),'utf8'));
const clone=()=>structuredClone(source);
test('standalone closed config passes',()=>assert.equal(validate(clone()),true));
for(const [name,mutate] of Object.entries({
 'public postgres':c=>c.services.postgres.ports=['5432:5432'],
 'host network':c=>c.services.backend.network_mode='host',
 'fixed container':c=>c.services.frontend.container_name='cashback-frontend',
 'live volume mount':c=>c.services.postgres.volumes=['/var/live:/var/lib/postgresql/data'],
 'financial enable':c=>c.services.backend.environment.CASHBACK_FINANCIAL_WRITES='true',
 'plaintext DB':c=>c.services.backend.environment.DB_SSL='false',
 'SMTP accept any':c=>c.services.mail.environment.MP_SMTP_AUTH_ACCEPT_ANY='true',
 'public sink':c=>c.services.mail.ports=['8025:8025'],
 'inline JWT':c=>c.services.backend.environment.JWT_SECRET='not-a-credential',
 'external network':c=>c.networks.database={external:true},
 'missing health':c=>delete c.services.backend.healthcheck
}))test('refuses '+name,()=>{const c=clone();mutate(c);assert.throws(()=>validate(c));});
test('immutable references required, floating/latest rejected',()=>{
 const env={STAGING_NODE_IMAGE:'node:24-bookworm-slim',STAGING_NGINX_IMAGE:'nginx:latest',STAGING_POSTGRES_IMAGE:'postgres:17',STAGING_MAILPIT_IMAGE:'axllent/mailpit:latest'};
 assert.throws(()=>images(env));
 for(const k of Object.keys(env))env[k]+='@sha256:'+'a'.repeat(64);assert.throws(()=>images(env));
 const pins=require('./image-pins.json').images;images({STAGING_NODE_IMAGE:pins.node,STAGING_POSTGRES_IMAGE:pins.postgres,STAGING_NGINX_IMAGE:pins.nginx,STAGING_MAILPIT_IMAGE:pins.mailpit});
});
test('SPA fallback, prefix strip, noindex and static runtime are prepared',()=>{
 const nginx=fs.readFileSync(path.join(__dirname,'nginx.conf'),'utf8');
 assert.match(nginx,/try_files \$uri \$uri\/ \/index.html/);assert.match(nginx,/proxy_pass http:\/\/backend:3001\//);assert.match(nginx,/noindex, nofollow, noarchive/);
 const file=fs.readFileSync(path.join(__dirname,'frontend.Dockerfile'),'utf8');assert.match(file,/RUN npm run build/);assert.doesNotMatch(file,/react-scripts start/);assert.match(file,/GENERATE_SOURCEMAP=false/);
});
test('bundle gate refuses operational loopback URL and accepts same-origin',()=>{
 assert.ok(process.env.B02_TEST_TEMP,'explicit D: temporary root required');assert.match(process.env.B02_TEST_TEMP,/^D:[\\/]/i);
 const dir=fs.mkdtempSync(path.join(process.env.B02_TEST_TEMP,'bundle-'));
 try{const file=path.join(dir,'main.js'),run=()=>cp.spawnSync(process.execPath,[path.join(__dirname,'check-bundle.cjs'),dir],{stdio:'pipe'}).status;
 fs.writeFileSync(file,'fetch("/api/auth/profile")');assert.equal(run(),0);
 fs.writeFileSync(file,'fetch("http://localhost:3001/auth/profile")');assert.notEqual(run(),0);
 }finally{fs.rmSync(dir,{recursive:true});}
});

test('TLS directory and key remain traversable only by PostgreSQL after privilege drop',()=>{
 const entry=fs.readFileSync(path.join(__dirname,'postgres-entry.sh'),'utf8');
 assert.match(entry,/chown postgres:postgres \/run\/staging-tls \/run\/staging-tls\/server/);
 assert.match(entry,/chmod 700 \/run\/staging-tls/);assert.match(entry,/chmod 600 \/run\/staging-tls\/server.key/);
});

