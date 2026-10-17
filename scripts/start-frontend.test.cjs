'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { selectedPort, checkPort, main } = require('./start-frontend.cjs');

// All probes, filesystem dependency checks and child processes are replaced.
// Importing the launcher must not launch it. No sockets or applications are opened.
function harness(env = {}) {
  const probes = [], spawns = [], logs = [], exits = [], errors = [];
  const child = new EventEmitter();
  const options = {env, exists: () => true, probe: async (...args) => { probes.push(args); },
    spawnProcess: (...args) => { spawns.push(args); return child; },
    log: value => logs.push(value), report: value => errors.push(value), setExitCode: code => exits.push(code)};
  return {options, probes, spawns, logs, exits, errors, child};
}

for (const [env, port] of [[{}, 3000], [{PORT: '3000'}, 3000], [{PORT: '3003'}, 3003]]) {
  test(`checks and launches only selected port ${port} (${JSON.stringify(env)})`, async () => {
    const h = harness(env); await main(h.options);
    assert.deepEqual(h.probes, [['127.0.0.1', port], ['::1', port]]);
    assert.equal(h.spawns.length, 1);
    const [executable, args, options] = h.spawns[0];
    assert.equal(executable, process.execPath);
    assert.equal(args[1], 'start');
    assert.match(args[0], /react-scripts[\\/]bin[\\/]react-scripts\.js$/);
    assert.match(options.cwd, /cashback-frontend$/);
    assert.equal(options.env.PORT, String(port));
    assert.equal(options.env.HOST, 'localhost');
    assert.equal(options.env.CI, 'true'); // CRA must refuse a port race, never prompt/fallback.
    assert.equal(options.env.REACT_APP_REGISTRATION_ISOLATED, 'true');
    assert.ok(h.logs.includes(`Cashback frontend: http://localhost:${port}/register`));
  });
}

for (const port of ['3000', '3003']) {
  for (const blockedHost of ['127.0.0.1', '::1']) {
    test(`busy ${blockedHost}:${port} refuses without spawning or fallback`, async () => {
      const h = harness({PORT: port});
      h.options.probe = async (host, chosen) => {
        h.probes.push([host, chosen]);
        if (host === blockedHost) throw Object.assign(new Error('busy'), {code: 'EADDRINUSE'});
      };
      await assert.rejects(main(h.options), new RegExp(`Port ${port} is occupied`));
      assert.equal(h.spawns.length, 0);
      assert.ok(h.probes.every(([,chosen]) => chosen === Number(port)));
    });
  }
}
for (const port of ['3002', '3001', '3004', '', '03003', '3003 ', 'abc']) {
  test(`rejects disallowed PORT=${JSON.stringify(port)} before probing`, async () => {
    const h = harness({PORT: port});
    await assert.rejects(main(h.options), /reserved for bonus-api|Unsupported frontend PORT/);
    assert.equal(h.probes.length, 0); assert.equal(h.spawns.length, 0);
  });
}
test('isolation cannot be disabled by inherited environment', async () => {
  const h = harness({PORT: '3003', REACT_APP_REGISTRATION_ISOLATED: 'false', REACT_APP_API_BASE: 'http://localhost:3001'});
  await main(h.options);
  assert.equal(h.spawns[0][2].env.REACT_APP_REGISTRATION_ISOLATED, 'true');
  assert.equal(h.spawns[0][2].env.REACT_APP_API_BASE, 'http://localhost:3001');
});
test('missing dependencies and unknown probe failures refuse without a child', async () => {
  const h = harness(); h.options.exists = () => false;
  await assert.rejects(main(h.options), /dependencies are missing/);
  assert.equal(h.probes.length, 0);
  h.options.exists = () => true;
  h.options.probe = async () => {throw Object.assign(new Error('cannot check'), {code: 'EACCES'});};
  await assert.rejects(main(h.options), /cannot check/);
  assert.equal(h.spawns.length, 0);
});
test('child startup failure and termination propagate failure status', async () => {
  const h = harness(); await main(h.options);
  h.child.emit('error', new Error('synthetic failure'));
  assert.deepEqual(h.exits, [1]);
  assert.deepEqual(h.errors, ['Could not start the local frontend.']);
  h.child.emit('exit', null);
  assert.deepEqual(h.exits, [1, 1]);
});
test('port probe uses the requested port and closes its temporary server', async () => {
  const server = new EventEmitter(); let listened, closed = false;
  server.listen = (options, callback) => {listened = options; callback();};
  server.close = callback => {closed = true; callback();};
  await checkPort('127.0.0.1', selectedPort({PORT: '3003'}), () => server);
  assert.deepEqual(listened, {host: '127.0.0.1', port: 3003, exclusive: true});
  assert.equal(closed, true);
});
