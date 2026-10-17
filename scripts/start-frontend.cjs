'use strict';

// Explicit ports only. Never silently select another port or stop an existing process.
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const frontend = path.resolve(__dirname, '../cashback-frontend');
const entry = path.join(frontend, 'node_modules/react-scripts/bin/react-scripts.js');

function selectedPort(env) {
  const value = env.PORT === undefined ? '3000' : env.PORT;
  if (value === '3002') throw new Error('Port 3002 is reserved for bonus-api. Use PORT=3003 for the isolated frontend.');
  if (value !== '3000' && value !== '3003') throw new Error('Unsupported frontend PORT. Use 3000 (default) or explicitly set PORT=3003.');
  return Number(value);
}

async function checkPort(host, port, createServer = net.createServer) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => {
      if (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL') resolve();
      else reject(error);
    });
    server.listen({ host, port, exclusive: true }, () => server.close(resolve));
  });
}

async function main({
  env = process.env, probe = checkPort, spawnProcess = spawn, exists = fs.existsSync,
  log = console.log, report = console.error, setExitCode = code => { process.exitCode = code; },
} = {}) {
  const port = selectedPort(env);
  if (!exists(entry)) throw new Error('Frontend dependencies are missing. No packages were installed.');
  try {
    await probe('127.0.0.1', port);
    await probe('::1', port);
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      throw new Error(`Port ${port} is occupied. Inspect the existing process; Cashback will not select another port or stop it.`);
    }
    throw error;
  }
  log(`Cashback frontend: http://localhost:${port}/register`);
  log('Backend must be separately approved and ready at http://localhost:3001. No services or migrations are started here.');
  const child = spawnProcess(process.execPath, [entry, 'start'], {
    cwd: frontend, stdio: 'inherit',
    env: { ...env, HOST: 'localhost', PORT: String(port), CI: 'true', HTTPS: 'false', PUBLIC_URL: '', REACT_APP_REGISTRATION_ISOLATED: 'true' },
  });
  child.once('error', () => { report('Could not start the local frontend.'); setExitCode(1); });
  child.once('exit', code => { setExitCode(code ?? 1); });
  return child;
}

module.exports = { selectedPort, checkPort, main };
if (require.main === module) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
