import assert from 'node:assert/strict';
import test from 'node:test';
import { collectStripeCheckoutSessionDiscoveryPage } from '@gredice/stripe/server';

const rangeGte = new Date('2026-08-01T00:00:00.000Z');
const rangeLte = new Date('2026-08-03T09:15:00.000Z');

test('Stripe checkout discovery freezes both range bounds and uses bounded provider options', async () => {
    const result = await collectStripeCheckoutSessionDiscoveryPage(
        { rangeGte, rangeLte, startingAfter: 'cs_previous' },
        async (params, requestOptions) => {
            assert.deepStrictEqual(params, {
                created: {
                    gte: Math.floor(rangeGte.getTime() / 1_000),
                    lte: Math.floor(rangeLte.getTime() / 1_000),
                },
                limit: 100,
                starting_after: 'cs_previous',
                status: 'complete',
            });
            assert.deepStrictEqual(requestOptions, {
                maxNetworkRetries: 0,
                timeout: 5_000,
            });
            return {
                data: [{ id: 'cs_next_1' }, { id: 'cs_next_2' }],
                has_more: true,
            };
        },
    );

    assert.deepStrictEqual(result, {
        hasMore: true,
        nextStartingAfter: 'cs_next_2',
        sessions: [{ id: 'cs_next_1' }, { id: 'cs_next_2' }],
    });
});

test('Stripe checkout discovery can resume beyond 500 sessions without head starvation', async () => {
    const requestedCursors: Array<string | undefined> = [];
    let startingAfter: string | null = null;
    const discovered: string[] = [];

    for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
        const result = await collectStripeCheckoutSessionDiscoveryPage(
            { rangeGte, rangeLte, startingAfter },
            async (params) => {
                requestedCursors.push(params.starting_after);
                const offset = pageIndex * 100;
                const size = pageIndex === 5 ? 1 : 100;
                return {
                    data: Array.from({ length: size }, (_, index) => ({
                        id: `cs_${(offset + index).toString().padStart(3, '0')}`,
                    })),
                    has_more: pageIndex < 5,
                };
            },
        );
        discovered.push(...result.sessions.map((session) => session.id));
        startingAfter = result.nextStartingAfter;
    }

    assert.strictEqual(discovered.length, 501);
    assert.deepStrictEqual(requestedCursors, [
        undefined,
        'cs_099',
        'cs_199',
        'cs_299',
        'cs_399',
        'cs_499',
    ]);
});

test('Stripe checkout discovery excludes sessions newer than its frozen upper bound', async () => {
    const providerSessions = [
        { created: rangeLte.getTime() - 1_000, id: 'cs_in_range' },
        { created: rangeLte.getTime() + 1_000, id: 'cs_newer' },
    ];
    const result = await collectStripeCheckoutSessionDiscoveryPage(
        { rangeGte, rangeLte, startingAfter: null },
        async (params) => ({
            data: providerSessions
                .filter(
                    (session) =>
                        session.created >= params.created.gte * 1_000 &&
                        session.created <= params.created.lte * 1_000,
                )
                .map(({ id }) => ({ id })),
            has_more: false,
        }),
    );

    assert.deepStrictEqual(result.sessions, [{ id: 'cs_in_range' }]);
    assert.strictEqual(result.nextStartingAfter, null);
});

test('Stripe checkout discovery rejects a non-advancing page', async () => {
    await assert.rejects(
        collectStripeCheckoutSessionDiscoveryPage(
            { rangeGte, rangeLte, startingAfter: 'cs_same' },
            async () => ({
                data: [{ id: 'cs_same' }],
                has_more: true,
            }),
        ),
        /pagination did not advance/u,
    );
});
