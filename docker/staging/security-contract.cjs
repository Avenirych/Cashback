'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const pins=require('./image-pins.json').images;
function serverBlocks(text){const s=text.replace(/\$\{[^}]+\}/g,'APPROVED_ORIGIN').replace(/#[^\n]*/g,'');const blocks=[];const re=/\bserver\s*\{/g;let m;while((m=re.exec(s))){let depth=1,i=re.lastIndex;for(;i<s.length&&depth;i++){if(s[i]==='{')depth++;else if(s[i]==='}')depth--;}assert.equal(depth,0,'NGINX_UNBALANCED');blocks.push(s.slice(m.index,i));re.lastIndex=i;}return blocks;}
function nginx(text,headers){
 const blocks=serverBlocks(text);assert.equal(blocks.length,4);
 const app=blocks.find(b=>b.includes('ssl_verify_client on;')),health=blocks.find(b=>b.includes('listen 127.0.0.1:8081;')),redirect=blocks.find(b=>b.includes('listen 8080 default_server;')),reject=blocks.find(b=>b.includes('ssl_reject_handshake on;'));
 assert.ok(app&&health&&redirect&&reject,'MISSING_GATE');
 assert.match(app,/listen 8443 ssl;/);assert.match(app,/ssl_crl \/run\/secrets\/tester_crl;/);assert.match(app,/ssl_client_certificate \/run\/secrets\/tester_ca;/);assert.match(app,/ssl_certificate_key \/run\/secrets\/web_key;/);assert.match(app,/ssl_session_cache off;/);assert.match(app,/ssl_session_tickets off;/);
 assert.doesNotMatch(text,/ssl_verify_client\s+(off|optional\w*)|error_page|auth_basic|ssl_key_log/);
 assert.match(reject,/listen 8443 ssl default_server;/);assert.doesNotMatch(reject,/root\s|proxy_pass/);
 assert.match(health,/location = \/healthz/);assert.doesNotMatch(health,/root\s|proxy_pass|index\.html/);
 assert.match(redirect,/return 308 APPROVED_ORIGIN\$request_uri;/);assert.doesNotMatch(redirect,/proxy_pass|root\s|\$host|index\.html/);
 assert.match(app,/try_files \$uri \$uri\/ \/index.html/);assert.match(app,/proxy_pass http:\/\/backend:3001\//);assert.match(app,/proxy_set_header Authorization \$http_authorization;/);assert.match(app,/proxy_set_header X-Forwarded-Proto https;/);
 assert.equal((app.match(/include \/etc\/nginx\/staging-security-headers.conf;/g)||[]).length,2,'HEADER_INHERITANCE_REFUSED');
 assert.match(text,/worker_processes 1;/);assert.match(text,/access_log off;/);assert.match(text,/error_log \/dev\/null crit;/);
 for(const name of ['X-Robots-Tag','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Strict-Transport-Security','Content-Security-Policy'])assert.ok(headers.includes('add_header '+name+' '),name);
 assert.match(headers,/noindex, nofollow, noarchive/);assert.doesNotMatch(headers,/includeSubDomains|preload/);return true;
}
function files(){
 nginx(fs.readFileSync(path.join(__dirname,'nginx.conf'),'utf8'),fs.readFileSync(path.join(__dirname,'security-headers.conf'),'utf8'));
 for(const n of ['backend','frontend','postgres']){const s=fs.readFileSync(path.join(__dirname,n+'.Dockerfile'),'utf8');assert.equal(s.split(/\r?\n/)[0],'# syntax='+pins.dockerfile);assert.doesNotMatch(s,/:latest|react-scripts start/);if(n!=='postgres')assert.ok(s.includes('ARG NODE_IMAGE='+pins.node));if(n==='frontend')assert.ok(s.includes('ARG NGINX_IMAGE='+pins.nginx));if(n==='postgres')assert.ok(s.includes('ARG POSTGRES_IMAGE='+pins.postgres));}
 for(const n of ['frontend-entry.sh','read-only-preflight.sh']){const s=fs.readFileSync(path.join(__dirname,n),'utf8');assert.ok(!s.includes('\r'));assert.doesNotMatch(s,/set -[^\n]*x|eval\s|printenv|env\s*$/m);}
 const entry=fs.readFileSync(path.join(__dirname,'frontend-entry.sh'),'utf8');assert.ok(entry.includes("envsubst '${STAGING_FRONTEND_ORIGIN} ${STAGING_FRONTEND_HOST}'"));assert.match(entry,/for name in web_cert web_key tester_ca tester_crl/);assert.match(entry,/exec nginx -c \/tmp\/nginx.conf/);return true;
}
module.exports={nginx,serverBlocks,files};
