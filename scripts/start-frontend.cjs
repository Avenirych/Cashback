'use strict';
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const frontend = path.resolve(__dirname, '../cashback-frontend');
const entry = path.join(frontend, 'node_modules/react-scripts/bin/react-scripts.js');
const URL = 'http://localhost:3003/';
const IDENTITY = 'cashback-local-demo-v1';
function selectedPort(env) {
  if (env.PORT !== undefined && env.PORT !== '3003') throw new Error('Cashback demo uses only PORT=3003. No other port will be selected.');
  return 3003;
}
async function checkPort(host, port, createServer = net.createServer) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => {
      if (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL') resolve();
      else reject(error);
    });
    server.listen({host, port, exclusive: true}, () => server.close(error => error ? reject(error) : resolve()));
  });
}
// Direct loopback HTTP only; no proxy, redirects or authentication requests.
function readLocal(resource, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3003${resource}`, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {body += chunk; if (body.length > 32 * 1024 * 1024) req.destroy(new Error('Frontend response too large'));});
      res.on('error', reject);
      res.on('end', () => resolve({status: res.statusCode, body}));
    });
    const timer = setTimeout(() => req.destroy(new Error('Frontend identification timed out')), timeout);
    req.once('close', () => clearTimeout(timer));
    req.once('error', reject);
  });
}
async function identify(read = readLocal) {
  try {
    const marker = await read('/cashback-demo.json');
    if (marker.status !== 200 || JSON.parse(marker.body).application !== IDENTITY) return false;
    const html = await read('/');
    if (html.status !== 200 || !html.body.includes('id="root"') || !html.body.includes('/static/js/bundle.js')) return false;
    const bundle = await read('/static/js/bundle.js');
    return bundle.status === 200 && bundle.body.includes('const BACKEND_URL = ("http://127.0.0.1:3005"') && bundle.body.includes('Smart shopping with Cashback+');
  } catch {return false;}
}
function openBrowser(url, spawnProcess = spawn, platform = process.platform) {
  const command = platform === 'win32' ? [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/rundll32.exe'), ['url.dll,FileProtocolHandler', url]] : platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command[0], command[1], {stdio: 'ignore', windowsHide: true, shell: false});
    child.once('error', () => reject(new Error(`Could not open the browser. Open ${url} manually.`)));
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Could not open the browser. Open ${url} manually.`)));
  });
}
async function main({env = process.env, probe = checkPort, spawnProcess = spawn, exists = fs.existsSync,
  identifyFrontend, open = openBrowser, pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
  log = console.log, report = console.error, setExitCode = code => {process.exitCode = code;}, attempts = Number.POSITIVE_INFINITY, now = Date.now, readinessTimeout = 120000} = {}) {
  const port = selectedPort(env);
  const inspectExisting = identifyFrontend || identify;
  try {await probe('127.0.0.1', port); await probe('::1', port);}
  catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    if (!await inspectExisting()) throw new Error('Port 3003 is occupied by an unidentified or incompatible service. Nothing was started or stopped.');
    log(`Cashback+ is already running: ${URL}`); await open(URL); return null;
  }
  if (!exists(entry)) throw new Error('Frontend dependencies are missing. No packages were installed.');
  log(`Starting Cashback+ at ${URL}`);
  const child = spawnProcess(process.execPath, [entry, 'start'], {cwd: frontend, stdio: 'inherit',
    env: {...env, HOST: 'localhost', PORT: '3003', CI: 'true', HTTPS: 'false', PUBLIC_URL: '', BROWSER: 'none', REACT_APP_REGISTRATION_ISOLATED: 'true', REACT_APP_API_BASE: 'http://127.0.0.1:3005'}});
  let failed = false;
  child.once('error', () => {failed = true; report('Could not start the Cashback+ frontend.'); setExitCode(1);});
  child.once('exit', code => {failed = true; setExitCode(code ?? 1);});
  const deadline = now() + readinessTimeout;
  const readyCheck = identifyFrontend || (() => identify(resource => readLocal(resource, Math.max(1, Math.min(3000, deadline - now())))));
  for (let i = 0; i < attempts && now() < deadline; i++) {
    if (failed) throw new Error('Cashback+ frontend exited before becoming ready. No retry was attempted.');
    const ready = await readyCheck();
    if (failed) throw new Error('Cashback+ frontend exited before becoming ready. No retry was attempted.');
    if (ready && now() < deadline) {log(`Cashback+ is ready: ${URL}`); await open(URL); return child;}
    await pause(Math.max(0, Math.min(500, deadline - now())));
  }
  throw new Error(`Cashback+ readiness timed out. Browser not opened. Frontend process preserved; see terminal output. ${URL}`);
}
module.exports = {selectedPort, checkPort, identify, readLocal, openBrowser, main, URL, IDENTITY};
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
