import assert from 'node:assert/strict';
import https from 'node:https';
import test from 'node:test';

test('API exports console and request errors in lifecycle-bound batches and reports persistent failures', async (t) => {
    const originalEnvironment = { ...process.env };
    const originalConsole = { ...console };
    const contextKey = Symbol.for('@vercel/request-context');
    const forwardingKey = Symbol.for('gredice-api.console-forwarding');
    const contextDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        contextKey,
    );
    const backgroundTasks: Promise<void>[] = [];
    const firstRequest = Promise.withResolvers<void>();
    const releaseFirstRequest = Promise.withResolvers<void>();
    const requests: Array<{ url: string; body: string; headers: Headers }> = [];
    let currentTime = Date.now();
    let abortExports = false;
    t.after(() => releaseFirstRequest.resolve());
    t.mock.method(Date, 'now', () => currentTime);
    t.mock.method(https, 'request', () => {
        assert.fail('OTLP must use the mocked fetch transport');
    });

    Object.assign(process.env, {
        NODE_ENV: 'production',
        NEXT_RUNTIME: 'nodejs',
        NEXT_PUBLIC_POSTHOG_KEY: 'test-project-key',
        NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.posthog.com',
    });
    delete process.env.POSTHOG_SERVER_HOST;
    delete process.env.NEXT_PUBLIC_POSTHOG_UI_HOST;
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
            if (abortExports) {
                throw new DOMException(
                    'This operation was aborted',
                    'AbortError',
                );
            }
            return new Response(null, { status: 200 });
        },
    );

    const { loggerProvider } = await import('./posthog-server');
    const { onRequestError, register } = await import('../instrumentation');
    t.after(() => loggerProvider.shutdown());
    await register();
    console.info('routine cron completion stays in Vercel');
    console.warn('batched warning', { count: 1 });
    console.error('batched error');
    assert.equal(info.mock.callCount(), 2); // Includes the runtime version.
    assert.equal(warn.mock.callCount(), 1);
    assert.equal(error.mock.callCount(), 1);
    assert.equal(requests.length, 0);
    assert.equal(backgroundTasks.length, 2);
    assert.equal(backgroundTasks[0], backgroundTasks[1]);

    const errorHookResult = onRequestError(
        new Error('unhandled request failure'),
        { path: '/api/example', method: 'GET', headers: {} },
        {
            routerKind: 'App Router',
            routePath: '/api/example',
            routeType: 'route',
            renderSource: undefined,
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
    assert.notEqual(backgroundTasks.at(-1), backgroundTasks[0]);
    releaseFirstRequest.resolve();
    await Promise.all(backgroundTasks);

    assert.equal(requests.length, 2);
    assert.match(requests[0]?.body ?? '', /batched warning/);
    assert.match(requests[0]?.body ?? '', /batched error/);
    assert.match(requests[0]?.body ?? '', /unhandled request failure/);
    assert.match(requests[1]?.body ?? '', /warning during export/);

    const persistentWarnings = () =>
        warn.mock.calls.filter(
            (call) =>
                call.arguments[0] === 'PostHog log flush repeatedly failed',
        );
    abortExports = true;
    console.warn('first failed batch');
    await backgroundTasks.at(-1);
    assert.equal(requests.length, 4, 'one bounded retry per aborted batch');
    assert.equal(persistentWarnings().length, 0);

    console.warn('record during backoff');
    await Promise.all(backgroundTasks);
    assert.equal(requests.length, 4);

    currentTime += 30_000;
    console.warn('second failed batch');
    await backgroundTasks.at(-1);
    assert.equal(requests.length, 6);
    const warnings = persistentWarnings();
    assert.equal(warnings.length, 1);
    const warningContext: unknown = warnings[0]?.arguments[1];
    assert.partialDeepStrictEqual(warningContext, {
        consecutiveFailures: 2,
        retryInMs: 60_000,
    });
    assert.ok(
        typeof warningContext === 'object' &&
            warningContext !== null &&
            'error' in warningContext,
    );
    assert.ok(warningContext.error instanceof Error);
    assert.ok(warningContext.error.cause instanceof DOMException);
    assert.equal(warningContext.error.cause.name, 'AbortError');

    currentTime += 60_000;
    abortExports = false;
    console.warn('recovered export');
    await backgroundTasks.at(-1);
    assert.equal(requests.length, 7);
    assert.equal(persistentWarnings().length, 1);

    abortExports = true;
    console.warn('first failed batch after recovery');
    await backgroundTasks.at(-1);
    assert.equal(requests.length, 9, 'success must reset backoff');
    assert.equal(persistentWarnings().length, 1);
    currentTime += 30_000;
    console.warn('second failed batch after recovery');
    await backgroundTasks.at(-1);
    assert.equal(requests.length, 11);
    assert.equal(
        persistentWarnings().length,
        2,
        'a new outage must be reported',
    );

    for (const request of requests) {
        assert.equal(request.url, 'https://eu.i.posthog.com/i/v1/logs');
        assert.equal(
            request.headers.get('Authorization'),
            'Bearer test-project-key',
        );
        assert.match(request.body, /gredice-api/);
        assert.doesNotMatch(
            request.body,
            /routine cron completion stays in Vercel/,
        );
        assert.doesNotMatch(
            request.body,
            /PostHog log flush repeatedly failed/,
        );
    }
});
