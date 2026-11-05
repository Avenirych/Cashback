'use strict';
const fs=require('node:fs'),path=require('node:path');
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,e.name);if(e.isDirectory())scan(file);
 else if(e.name.endsWith('.map'))throw Error('STAGING_SOURCEMAP_REFUSED');
 else if(/\.(js|html|json)$/.test(e.name)&&/https?:\/\/(?:localhost|127\.0\.0\.1)(?=[:/"'])/i.test(fs.readFileSync(file,'utf8')))throw Error('STAGING_LOOPBACK_URL_IN_BUNDLE');
}}
scan(process.argv[2]);
