import assert from 'node:assert/strict';
import https from 'node:https';
import test from 'node:test';

test('Garden batches console and request errors in lifecycle-bound, serialized exports', async (t) => {
    const originalEnvironment = { ...process.env };
    const originalConsole = { ...console };
    const contextKey = Symbol.for('@vercel/request-context');
    const forwardingKey = Symbol.for('gredice-garden.console-forwarding');
    const contextDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        contextKey,
    );
    const backgroundTasks: Promise<void>[] = [];
    const firstRequest = Promise.withResolvers<void>();
    const releaseFirstRequest = Promise.withResolvers<void>();
    const requests: Array<{ url: string; body: string; headers: Headers }> = [];
    t.after(() => releaseFirstRequest.resolve());
    t.mock.method(https, 'request', () => {
        assert.fail('OTLP must use the mocked fetch transport');
    });

    Object.assign(process.env, {
        NODE_ENV: 'production',
        NEXT_RUNTIME: 'nodejs',
        NEXT_PUBLIC_POSTHOG_KEY: 'test-project-key',
        POSTHOG_SERVER_HOST: 'https://eu.posthog.com/',
    });
    Object.defineProperty(globalThis, contextKey, {
        configurable: true,
        value: {
            get: () => ({
                waitUntil: (task: Promise<void>) => backgroundTasks.push(task),
            }),
        },
    });
    t.after(() => {
        Object.assign(console, originalConsole);
        process.env = originalEnvironment;
        Reflect.deleteProperty(globalThis, forwardingKey);
        if (contextDescriptor) {
            Object.defineProperty(globalThis, contextKey, contextDescriptor);
        } else {
            Reflect.deleteProperty(globalThis, contextKey);
        }
    });
    const warn = t.mock.method(console, 'warn', () => {});
    const error = t.mock.method(console, 'error', () => {});
    const info = t.mock.method(console, 'info', () => {});
    t.mock.method(
        globalThis,
        'fetch',
        async (input: string, init: RequestInit) => {
            assert.ok(init.body instanceof Uint8Array);
            requests.push({
                url: input,
                body: new TextDecoder().decode(init.body),
                headers: new Headers(init.headers),
            });
            if (requests.length === 1) {
                firstRequest.resolve();
                await releaseFirstRequest.promise;
            }
            return new Response(null, { status: 200 });
        },
    );

    const { loggerProvider } = await import('./posthog-server');
    const { onRequestError, register } = await import('../instrumentation');
    t.after(() => loggerProvider.shutdown());
    await register();
    console.info('routine info stays in Vercel');
    console.warn('batched warning', { count: 1 });
    console.error('batched error');
    assert.equal(info.mock.callCount(), 1);
    assert.equal(warn.mock.callCount(), 1);
    assert.equal(error.mock.callCount(), 1);
    assert.equal(requests.length, 0);
    assert.equal(backgroundTasks.length, 2);
    assert.equal(backgroundTasks[0], backgroundTasks[1]);

    const errorHookResult = onRequestError(
        new Error('unhandled request failure'),
        { path: '/', method: 'GET', headers: {} },
        {
            routerKind: 'App Router',
            routePath: '/',
            routeType: 'render',
            renderSource: 'react-server-components',
            revalidateReason: undefined,
        },
    );
    assert.equal(
        errorHookResult,
        undefined,
        'telemetry must not delay the error response',
    );

    await firstRequest.promise;
    console.warn('warning during export');
    releaseFirstRequest.resolve();
    await Promise.all(backgroundTasks);

    assert.equal(requests.length, 2);
    for (const request of requests) {
        assert.equal(request.url, 'https://eu.i.posthog.com/i/v1/logs');
        assert.equal(
            request.headers.get('Authorization'),
            'Bearer test-project-key',
        );
        assert.match(request.body, /gredice-garden/);
        assert.doesNotMatch(request.body, /routine info stays in Vercel/);
    }
    assert.match(requests[0].body, /batched warning/);
    assert.match(requests[0].body, /batched error/);
    assert.match(requests[0].body, /unhandled request failure/);
    assert.match(requests[1].body, /warning during export/);
});
