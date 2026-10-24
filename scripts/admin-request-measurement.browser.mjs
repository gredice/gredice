import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import test from 'node:test';
import { measureAdminRequests } from './admin-request-measurement.mjs';

test('real browser fixture attributes prefetch and idle reads while blocking writes', {
    timeout: 15000,
}, async () => {
    let writes = 0;
    let authorizedNavigations = 0;
    const server = createServer((request, response) => {
        if (request.method !== 'GET') {
            writes += 1;
            response.writeHead(204).end();
            return;
        }
        if (request.url?.startsWith('/api/')) {
            response
                .writeHead(200, { 'Content-Type': 'application/json' })
                .end('{}');
            return;
        }
        const authenticated = request.headers.cookie?.includes(
            'gredice_session=fixture-private-cookie',
        );
        if (!authenticated) {
            response.writeHead(401).end('Login');
            return;
        }
        if (!request.headers.rsc) authorizedNavigations += 1;
        response.writeHead(200, { 'Content-Type': 'text/html' }).end(`
            <main data-gredice-admin-shell>Local authenticated fixture</main>
            <script>
            fetch('/admin/approvals?_rsc=fixture-private-query', {
                headers: { rsc: '1', 'next-router-prefetch': '1', 'next-router-segment-prefetch': '/admin/accounts/fixture-private-id' }
            }).catch(() => {});
            fetch('/api/write?private=fixture-private-query', {
                method: 'POST', body: 'fixture-private-body'
            }).catch(() => {});
            setInterval(() => fetch('/api/users/current?private=fixture-private-query').catch(() => {}), 40);
            </script>
        `);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.equal(typeof address, 'object');
    const fixtureOrigin = `http://127.0.0.1:${address.port}`;
    const require = createRequire(
        new URL('../apps/app/package.json', import.meta.url),
    );
    const { chromium } = require('@playwright/test');
    try {
        const report = await measureAdminRequests(
            chromium,
            {
                origin: fixtureOrigin,
                settleMs: 100,
                idleMs: 150,
                timeoutMs: 10000,
            },
            {
                cookies: [
                    {
                        name: 'gredice_session',
                        value: 'fixture-private-cookie',
                        domain: '127.0.0.1',
                        path: '/',
                        expires: -1,
                        httpOnly: true,
                        secure: false,
                        sameSite: 'Lax',
                    },
                ],
                origins: [],
            },
        );
        assert.equal(report.outcome, 'complete');
        assert.equal(report.actualDocumentNavigations, 4);
        assert.equal(authorizedNavigations, 4);
        assert.equal(
            report.navigations.every((navigation) => navigation.accepted),
            true,
        );
        assert.equal(writes, 0);
        assert.equal(
            report.groups.some(
                (group) => group.category === 'indicated-prefetch',
            ),
            true,
        );
        assert.equal(
            report.groups.some(
                (group) =>
                    group.phase === 'idle' && group.route === '/api/other',
            ),
            true,
        );
        assert.equal(
            report.groups.some((group) => group.blocked > 0),
            true,
        );
        assert.doesNotMatch(
            JSON.stringify(report),
            /fixture-private|127\.0\.0\.1|cookies|headers|_rsc/,
        );
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
