import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { Agent } from 'undici';
import { createSoapRequest } from '../src/clients/shared';

function createTestServer(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Failed to get server address');
            }
            resolve({
                url: `http://127.0.0.1:${addr.port}`,
                close: () =>
                    new Promise<void>((res) => server.close(() => res())),
            });
        });
    });
}

test('createSoapRequest - GET request with string URL', async () => {
    const server = await createTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('hello from test server');
    });

    try {
        const agent = new Agent();
        const request = createSoapRequest(agent);
        const response = await request(server.url);

        assert.equal(response.status, 200);
        assert.equal(response.data, 'hello from test server');
    } finally {
        await server.close();
    }
});

test('createSoapRequest - GET request with config object', async () => {
    const server = await createTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('config response');
    });

    try {
        const agent = new Agent();
        const request = createSoapRequest(agent);
        const response = await request({ url: server.url, method: 'GET' });

        assert.equal(response.status, 200);
        assert.equal(response.data, 'config response');
    } finally {
        await server.close();
    }
});

test('createSoapRequest - POST request with data', async () => {
    const server = await createTestServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`received: ${body}`);
        });
    });

    try {
        const agent = new Agent();
        const request = createSoapRequest(agent);
        const response = await request({
            url: server.url,
            method: 'POST',
            data: '<soap>test</soap>',
            headers: { 'Content-Type': 'application/xml' },
        });

        assert.equal(response.status, 200);
        assert.equal(response.data, 'received: <soap>test</soap>');
    } finally {
        await server.close();
    }
});

test('createSoapRequest - applies transformResponse', async () => {
    const server = await createTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('  needs trimming  ');
    });

    try {
        const agent = new Agent();
        const request = createSoapRequest(agent);
        const response = await request({
            url: server.url,
            transformResponse: [(data: string) => data.trim()],
        });

        assert.equal(response.data, 'needs trimming');
    } finally {
        await server.close();
    }
});

test('createSoapRequest - arraybuffer responseType returns Buffer', async () => {
    const server = await createTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(Buffer.from([0x01, 0x02, 0x03]));
    });

    try {
        const agent = new Agent();
        const request = createSoapRequest(agent);
        const response = await request({
            url: server.url,
            responseType: 'arraybuffer',
        });

        assert.ok(Buffer.isBuffer(response.data));
        assert.deepEqual(response.data, Buffer.from([0x01, 0x02, 0x03]));
    } finally {
        await server.close();
    }
});

test('createSoapRequest - custom headers are sent', async () => {
    let receivedHeaders: http.IncomingHttpHeaders = {};
    const server = await createTestServer((req, res) => {
        receivedHeaders = req.headers;
        res.writeHead(200);
        res.end('ok');
    });

    try {
        const agent = new Agent();
        const request = createSoapRequest(agent);
        await request({
            url: server.url,
            headers: { 'X-Custom-Header': 'test-value' },
        });

        assert.equal(receivedHeaders['x-custom-header'], 'test-value');
    } finally {
        await server.close();
    }
});

test('createSoapRequest - returns response headers', async () => {
    const server = await createTestServer((_req, res) => {
        res.writeHead(200, { 'X-Response-Header': 'response-value' });
        res.end('ok');
    });

    try {
        const agent = new Agent();
        const request = createSoapRequest(agent);
        const response = await request(server.url);

        assert.equal(response.headers['x-response-header'], 'response-value');
    } finally {
        await server.close();
    }
});

test('createSoapRequest - returns non-200 status codes', async () => {
    const server = await createTestServer((_req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('server error');
    });

    try {
        const agent = new Agent();
        const request = createSoapRequest(agent);
        const response = await request(server.url);

        assert.equal(response.status, 500);
        assert.equal(response.data, 'server error');
    } finally {
        await server.close();
    }
});
