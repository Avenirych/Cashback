'use strict';

// One frontend, one canonical origin. Never silently select another port.
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const frontend = path.resolve(__dirname, '../cashback-frontend');
const entry = path.join(frontend, 'node_modules/react-scripts/bin/react-scripts.js');

async function checkPort(host) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', error => {
      if (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL') resolve();
      else reject(error);
    });
    server.listen({ host, port: 3000, exclusive: true }, () => server.close(resolve));
  });
}

async function main() {
  if (!fs.existsSync(entry)) throw new Error('Frontend dependencies are missing. No packages were installed.');
  await checkPort('127.0.0.1');
  await checkPort('::1');
  console.log('Cashback frontend: http://localhost:3000/register');
  console.log('Backend must be separately approved and ready at http://localhost:3001. No services or migrations are started here.');
  const child = spawn(process.execPath, [entry, 'start'], {
    cwd: frontend, stdio: 'inherit',
    env: { ...process.env, HOST: 'localhost', PORT: '3000', CI: 'true', HTTPS: 'false', PUBLIC_URL: '' },
  });
  child.once('error', () => { console.error('Could not start the local frontend.'); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}

main().catch(error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Port 3000 is occupied. Inspect the existing process; Cashback will not select port 3002 or stop it.'
    : error.message);
  process.exitCode = 1;
});
