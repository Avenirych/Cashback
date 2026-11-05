'use strict';
// No shell expansion, no credential arguments/logging. B01 validates the resulting configuration.
const fs=require('node:fs');
for(const key of ['DB_PASSWORD','JWT_SECRET','SMTP_PASSWORD']) {
 if(process.env[key]) throw Error('STAGING_INLINE_SECRET_REFUSED');
 const value=fs.readFileSync('/run/secrets/'+key.toLowerCase(),'utf8').replace(/\r?\n$/,'');
 if(!value||/[\r\n\0]/.test(value)) throw Error('STAGING_SECRET_FILE_INVALID');
 process.env[key]=value;
}
require('./dist/backend-configuration').backendConfiguration();
require('./dist/main');
