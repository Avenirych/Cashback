'use strict';
// Build only; redirect compiler caches into this historical worktree.
const path=require('node:path'),fs=require('node:fs'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),frontend=path.join(root,'cashback-frontend');
process.chdir(frontend);process.env.NODE_ENV='production';process.env.BABEL_ENV='production';
process.env.REACT_APP_API_BASE='http://127.0.0.1:3006';process.env.GENERATE_SOURCEMAP='false';
const req=createRequire(path.join(frontend,'package.json'));
const paths=req('react-scripts/config/paths');
paths.appTsBuildInfoFile=path.join(frontend,'.historical-build-cache','tsconfig.tsbuildinfo');
const file=req.resolve('react-scripts/config/webpack.config'),factory=req(file);
require.cache[file].exports=env=>{
 const c=factory(env);c.cache=false;
 function rules(items){for(const r of items||[]){if(r.options&&r.loader?.includes('babel-loader'))r.options.cacheDirectory=false;if(r.oneOf)rules(r.oneOf);if(r.rules)rules(r.rules);}}rules(c.module.rules);
 for(const p of c.plugins){if(p.constructor.name==='ESLintWebpackPlugin'){p.options.cache=false;p.options.cacheLocation=path.join(frontend,'.historical-build-cache','eslint');}}
 return c;
};
require(req.resolve('react-scripts/scripts/build'));
