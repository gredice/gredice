import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { getLandingFeaturedGardens } from './getLandingFeaturedGardens';

function summary(id: number) {
    return {
        garden: { id, name: `Vrt ${id}` },
        owner:
            id === 12
                ? null
                : {
                      avatarUrl: null,
                      displayName: `Vrtlar ${id}`,
                      publicId: `u_${id}`,
                      achievementCount: id,
                  },
        dayPreviewImageUrl: `https://cdn.gredice.com/garden-${id}.webp`,
        nightPreviewImageUrl: null,
    };
}

function delayedResponse(signal: AbortSignal, delayMs: number, body: unknown) {
    return new Promise<Response>((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve(Response.json(body));
        }, delayMs);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
    });
}

function pendingBody(signal: AbortSignal) {
    return new Response(
        new ReadableStream<Uint8Array>({
            start(controller) {
                const abort = () => controller.error(signal.reason);
                signal.addEventListener('abort', abort, { once: true });
                if (signal.aborted) abort();
            },
        }),
        { headers: { 'Content-Type': 'application/json' } },
    );
}

function mockRequests(
    t: TestContext,
    respond: (
        gardenId: number | null,
        signal: AbortSignal,
        path: string,
    ) => Response | Promise<Response>,
) {
    // Native AbortSignal.timeout uses internal timers. Substitute controllers
    // driven by the mock clock so both loader phase budgets are tested.
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
    const timeout = t.mock.method(AbortSignal, 'timeout', (delayMs: number) => {
        const controller = new AbortController();
        setTimeout(() => {
            controller.abort(
                new DOMException('Deadline exceeded', 'TimeoutError'),
            );
        }, delayMs);
        return controller.signal;
    });
    const requests: {
        gardenId: number | null;
        signal: AbortSignal;
        path: string;
        traceId: string | null;
    }[] = [];
    const fetchMock: typeof fetch = async (input, init) => {
        const path = new URL(input instanceof Request ? input.url : input)
            .pathname;
        const gardenId =
            path === '/api/gardens/public/featured/summaries' ||
            path === '/api/gardens/public'
                ? null
                : Number(path.split('/').at(-2));
        assert.ok(init?.signal);
        assert.equal(init.cache, 'no-store');
        requests.push({
            gardenId,
            signal: init.signal,
            path,
            traceId: new Headers(init.headers).get('x-gredice-featured-trace'),
        });
        return respond(gardenId, init.signal, path);
    };
    t.mock.method(globalThis, 'fetch', fetchMock);
    const warnings = t.mock.method(console, 'warn', () => {});
    const errors = t.mock.method(console, 'error', () => {});
    const fixture = process.env.GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE;
    delete process.env.GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE;
    t.after(() => {
        if (fixture === undefined) {
            delete process.env.GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE;
        } else {
            process.env.GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE = fixture;
        }
    });
    return { requests, timeout, warnings, errors };
}

async function advanceTime(t: TestContext, milliseconds = 0) {
    t.mock.timers.tick(milliseconds);
    await setImmediate();
}

test('uses one compact summary request, preserves server order and caps the carousel at ten', async (t) => {
    const items = Array.from({ length: 12 }, (_, index) => summary(12 - index));
    const { requests, timeout } = mockRequests(t, () =>
        Response.json({ items }),
    );
    assert.deepEqual(await getLandingFeaturedGardens(), items.slice(0, 10));
    assert.deepEqual(
        requests.map(({ path }) => path),
        ['/api/gardens/public/featured/summaries'],
    );
    assert.match(requests[0]?.traceId ?? '', /^[0-9a-f-]{36}$/u);
    assert.deepEqual(
        timeout.mock.calls.map(({ arguments: args }) => args),
        [[3_000]],
    );
});

for (const failure of [
    'http',
    'older-api',
    'network',
    'json',
    'timeout',
    'body-timeout',
    'empty',
]) {
    test(`retains the empty landing fallback after a ${failure} response without full-scene requests`, async (t) => {
        const { requests } = mockRequests(t, (_id, signal) => {
            if (failure === 'http') return new Response(null, { status: 503 });
            if (failure === 'older-api')
                return new Response(null, { status: 404 });
            if (failure === 'network') throw new TypeError('Connection reset');
            if (failure === 'json') return new Response('invalid json');
            if (failure === 'timeout')
                return delayedResponse(signal, 6_000, { items: [summary(1)] });
            if (failure === 'body-timeout') return pendingBody(signal);
            return Response.json({ items: [] });
        });
        const result = getLandingFeaturedGardens();
        await advanceTime(t);
        await advanceTime(t, 5_000);
        assert.deepEqual(await result, []);
        assert.equal(requests.length, 1);
    });
}

for (const phase of ['headers', 'body']) {
    test(`summary ${phase} timeout is bounded to three seconds with useful diagnostics`, async (t) => {
        const { errors, requests } = mockRequests(t, (_id, signal) => {
            if (phase === 'headers')
                return delayedResponse(signal, 4_000, { items: [] });
            const response = pendingBody(signal);
            response.headers.set(
                'server-timing',
                'featured-summaries;dur=42.0',
            );
            response.headers.set('x-vercel-id', 'test-region::test-request');
            return response;
        });
        let settled = false;
        const result = getLandingFeaturedGardens().then((gardens) => {
            settled = true;
            return gardens;
        });
        await advanceTime(t);
        await advanceTime(t, 2_999);
        assert.equal(settled, false);
        await advanceTime(t, 1);
        assert.deepEqual(await result, []);
        assert.equal(requests.length, 1);
        assert.partialDeepStrictEqual(errors.mock.calls[0]?.arguments[1], {
            elapsedMs: 3_000,
            listPhase: phase,
            traceId: requests[0]?.traceId,
            timedOut: true,
            ...(phase === 'body'
                ? {
                      listHeadersMs: 0,
                      listBodyMs: 3_000,
                      apiTiming: 'featured-summaries;dur=42.0',
                      apiRequestId: 'test-region::test-request',
                  }
                : {}),
        });
    });
}

test('reports slow summary headers and API timing', async (t) => {
    const { requests, warnings } = mockRequests(t, (_id, signal) =>
        delayedResponse(signal, 2_600, { items: [summary(1)] }),
    );
    const result = getLandingFeaturedGardens();
    await advanceTime(t, 2_600);
    assert.equal((await result).length, 1);
    assert.partialDeepStrictEqual(warnings.mock.calls[0]?.arguments[1], {
        listDurationMs: 2_600,
        listHeadersMs: 2_600,
        listBodyMs: 0,
        traceId: requests[0]?.traceId,
    });
});

test('the Playwright fixture bypasses requests and deadlines', async (t) => {
    const { requests, timeout } = mockRequests(t, () => {
        throw new Error('Unexpected request');
    });
    process.env.GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE = 'true';
    assert.equal((await getLandingFeaturedGardens())[0]?.garden.id, 99_999);
    assert.deepEqual(requests, []);
    assert.equal(timeout.mock.callCount(), 0);
});

test('keeps carousel fields and excludes unexpected scene/private payload fields', async (t) => {
    const item = summary(1);
    mockRequests(t, () =>
        Response.json({
            items: [
                {
                    ...item,
                    garden: {
                        ...item.garden,
                        stacks: { large: 'unused'.repeat(100_000) },
                    },
                    owner: {
                        ...item.owner,
                        email: 'private@example.com',
                        accountId: 'private',
                    },
                    extra: 'unused',
                },
            ],
        }),
    );
    assert.deepEqual(await getLandingFeaturedGardens(), [item]);
});
