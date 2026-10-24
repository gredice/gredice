import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';

assert.equal(process.env.GREDICE_CI_NETWORK_ISOLATION, '1');
const interfaces = networkInterfaces();
assert.deepEqual(Object.keys(interfaces).sort(), ['ci-online', 'lo']);
assert.ok(interfaces.lo.every((address) => address.internal));
assert.deepEqual(
    interfaces['ci-online'].map(({ address, cidr }) => ({ address, cidr })),
    [{ address: '192.0.2.2', cidr: '192.0.2.2/32' }],
);
for (const family of ['-4', '-6']) {
    assert.equal(
        execFileSync('ip', [family, 'route', 'show', 'default'], {
            encoding: 'utf8',
        }).trim(),
        '',
    );
}

// Verify the kernel boundary independently of the Node preload. Documentation
// IPs have no production service; an absent namespace fails this check quickly.
execFileSync(
    process.execPath,
    [
        '--input-type=module',
        '-e',
        `
    import assert from 'node:assert/strict';
    import net from 'node:net';
    import { createServer } from 'node:http';
    await assert.rejects(new Promise((resolve, reject) => {
        const socket = net.connect({ host: '192.0.2.1', port: 80 });
        socket.setTimeout(1000, () => socket.destroy(new Error('Missing kernel egress isolation')));
        socket.on('connect', resolve).on('error', reject);
    }), error => error.code === 'ENETUNREACH');
    const server = createServer((_request, response) => response.end('local fixture'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        assert.equal(await (await fetch('http://127.0.0.1:' + server.address().port)).text(), 'local fixture');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
`,
    ],
    { env: { ...process.env, NODE_OPTIONS: '' }, stdio: 'inherit' },
);
console.info(
    'Kernel CI isolation verified: loopback works; external TCP is unreachable.',
);
