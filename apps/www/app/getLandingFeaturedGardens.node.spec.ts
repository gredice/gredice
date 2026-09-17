import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { getLandingFeaturedGardens } from './getLandingFeaturedGardens';
import type { LandingGardenCandidate } from './landingGardenCarousel';

function garden(id: number): LandingGardenCandidate['garden'] {
    return {
        backgroundPalette: 'current',
        farmId: 1,
        homeCamera: null,
        id,
        isPublic: true,
        isSandbox: false,
        latitude: 45.815,
        longitude: 15.982,
        name: `Vrt ${id}`,
        raisedBeds: [],
        stacks: {},
        structures: [],
        updatedAt: '2026-09-14T12:00:00.000Z',
    };
}

function summary(id: number, likeCount = 0, activePlantCount = 0) {
    return {
        id,
        likeCount,
        activePlantCount,
        owner:
            id === 12 ? null : { avatarUrl: null, displayName: `Vrtlar ${id}` },
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
    const requests: { gardenId: number | null; signal: AbortSignal }[] = [];
    const fetchMock: typeof fetch = async (input, init) => {
        const path = new URL(input instanceof Request ? input.url : input)
            .pathname;
        const gardenId =
            path === '/api/gardens/public'
                ? null
                : Number(path.split('/').at(-2));
        assert.ok(init?.signal);
        requests.push({ gardenId, signal: init.signal });
        return respond(gardenId, init.signal);
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

test('loads only the ten most popular gardens and retains their owners and ranking', async (t) => {
    const items = Array.from({ length: 12 }, (_, index) =>
        summary(index + 1, Math.floor(index / 2), index % 2),
    );
    const { requests, timeout } = mockRequests(t, (id, signal) =>
        id === null
            ? Response.json({ items })
            : delayedResponse(signal, id * 10, garden(id)),
    );
    const result = getLandingFeaturedGardens();
    await advanceTime(t);
    assert.deepEqual(
        requests.map(({ gardenId }) => gardenId),
        [null, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3],
    );
    await advanceTime(t, 120);
    assert.deepEqual(
        await result,
        items
            .slice(2)
            .toReversed()
            .map((item) => ({
                garden: garden(item.id),
                owner: item.owner,
            })),
    );
    assert.equal(timeout.mock.callCount(), 2);
    assert.deepEqual(
        timeout.mock.calls.map(({ arguments: args }) => args),
        [[3_000], [5_000]],
    );
    assert.notEqual(requests[0]?.signal, requests[1]?.signal);
    assert.ok(
        requests.slice(1).every(({ signal }) => signal === requests[1]?.signal),
    );
});

test('a rejected detail does not discard completed gardens or later successes', async (t) => {
    mockRequests(t, (id, signal) => {
        if (id === null)
            return Response.json({
                items: [summary(1), summary(2), summary(3)],
            });
        if (id === 2)
            return new Promise<Response>((_resolve, reject) => {
                setTimeout(() => reject(new TypeError('Connection reset')), 50);
            });
        return delayedResponse(signal, id === 1 ? 10 : 100, garden(id));
    });
    let settled = false;
    const result = getLandingFeaturedGardens().then((gardens) => {
        settled = true;
        return gardens;
    });
    await advanceTime(t);
    await advanceTime(t, 10);
    assert.equal(settled, false);
    await advanceTime(t, 40);
    assert.equal(settled, false);
    await advanceTime(t, 50);
    assert.deepEqual(
        (await result).map(({ garden }) => garden.id),
        [1, 3],
    );
});

test('gives details a fresh bounded budget after a slow list and preserves completed gardens', async (t) => {
    const { requests, timeout, warnings, errors } = mockRequests(
        t,
        (id, signal) => {
            if (id === null)
                return delayedResponse(signal, 2_109, {
                    items: [summary(1), summary(2), summary(3)],
                });
            if (id === 3) return pendingBody(signal);
            return delayedResponse(
                signal,
                id === 1 ? 1_000 : 4_500,
                garden(id),
            );
        },
    );
    let settled = false;
    const result = getLandingFeaturedGardens().then((gardens) => {
        settled = true;
        return gardens;
    });
    await advanceTime(t, 2_109);
    assert.equal(requests.length, 4);
    await advanceTime(t, 2_891);
    assert.equal(settled, false);
    await advanceTime(t, 1_609);
    assert.equal(settled, false);
    await advanceTime(t, 499);
    assert.equal(settled, false);
    await advanceTime(t, 1);
    assert.deepEqual(await result, [
        { garden: garden(1), owner: summary(1).owner },
        { garden: garden(2), owner: summary(2).owner },
    ]);
    assert.equal(Date.now(), 7_109);
    assert.equal(timeout.mock.callCount(), 2);
    assert.deepEqual(
        timeout.mock.calls.map(({ arguments: args }) => args),
        [[3_000], [5_000]],
    );
    assert.equal(requests[0]?.signal.aborted, true);
    assert.ok(
        requests
            .slice(1)
            .every(
                ({ signal }) =>
                    signal === requests[1]?.signal && signal.aborted,
            ),
    );
    assert.equal(errors.mock.callCount(), 0);
    assert.equal(warnings.mock.callCount(), 1);
    assert.partialDeepStrictEqual(warnings.mock.calls[0]?.arguments[1], {
        listDurationMs: 2_109,
        detailDurationMs: 5_000,
        elapsedMs: 7_109,
        timedOut: true,
    });
});

test('skips HTTP errors and invalid detail JSON while retaining a valid garden', async (t) => {
    mockRequests(t, (id) => {
        if (id === null)
            return Response.json({
                items: [1, 2, 3, 4, 5].map((id) => summary(id)),
            });
        if (id === 1) return Response.json(garden(id));
        if (id === 5) return new Response('invalid json');
        return new Response(null, {
            status: id === 2 ? 404 : id === 3 ? 403 : 503,
        });
    });
    assert.deepEqual(
        (await getLandingFeaturedGardens()).map(({ garden }) => garden.id),
        [1],
    );
});

for (const failure of [
    'http',
    'network',
    'json',
    'timeout',
    'body-timeout',
    'empty',
]) {
    test(`returns the empty fallback without detail requests when the list is ${failure}`, async (t) => {
        const { requests } = mockRequests(t, (_id, signal) => {
            if (failure === 'http') return new Response(null, { status: 503 });
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
        assert.deepEqual(
            requests.map(({ gardenId }) => gardenId),
            [null],
        );
    });
}

test('retains the empty fallback when all details time out', async (t) => {
    mockRequests(t, (id, signal) =>
        id === null
            ? Response.json({ items: [summary(1), summary(2)] })
            : delayedResponse(signal, 6_000, garden(id)),
    );
    const result = getLandingFeaturedGardens();
    await advanceTime(t);
    await advanceTime(t, 5_000);
    assert.deepEqual(await result, []);
});

test('the Playwright fixture bypasses network requests and the deadline', async (t) => {
    const { requests, timeout } = mockRequests(t, () => {
        throw new Error('Unexpected request');
    });
    process.env.GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE = 'true';
    const result = await getLandingFeaturedGardens();
    assert.equal(result[0]?.garden.id, 99_999);
    assert.deepEqual(requests, []);
    assert.equal(timeout.mock.callCount(), 0);
});
