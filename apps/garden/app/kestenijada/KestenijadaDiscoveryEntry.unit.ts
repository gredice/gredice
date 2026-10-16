import assert from 'node:assert/strict';
import test from 'node:test';
import { kestenijadaItems } from '@gredice/js/kestenijada';

const config = {
    enabled: true,
    assetsVerified: true,
    startsAt: '2026-10-15T08:00:00Z',
    endsAt: '2026-10-15T20:00:00Z',
};
const offers = kestenijadaItems.map((item, i) => ({
    id: i + 1,
    entityType: { name: 'block' },
    information: { name: item.name, label: item.label },
    attributes: {
        type: 'decoration',
        stackable: false,
        spanWidth: item.width,
        spanDepth: item.depth,
        nightOnlyPurchase: false,
    },
    functions: { raisedBed: false, recycler: false },
    prices: { sunflowers: 10 },
}));

test('discovery keeps disabled config static and reads event time only after the request boundary', async (t) => {
    const originalConfig = process.env.GREDICE_KESTENIJADA_EVENT_CONFIG;
    t.after(() => {
        if (originalConfig === undefined)
            delete process.env.GREDICE_KESTENIJADA_EVENT_CONFIG;
        else process.env.GREDICE_KESTENIJADA_EVENT_CONFIG = originalConfig;
    });

    let connected = false;
    let instant = Date.parse(config.startsAt);
    let connectionCalls = 0;
    let directoryCalls = 0;
    let releaseConnection = async () => {};
    let availableOffers = offers;
    let failDirectory = false;
    // Node 24 uses `exports`; older @types/node still calls it namedExports.
    Reflect.apply(t.mock.module, t.mock, [
        'next/server',
        {
            exports: {
                connection: async () => {
                    connectionCalls++;
                    await releaseConnection();
                    connected = true;
                },
            },
        },
    ]);
    Reflect.apply(t.mock.module, t.mock, [
        '@gredice/client',
        {
            exports: {
                directoriesClient: () => ({
                    GET: async (path: string) => {
                        assert.ok(connected);
                        assert.equal(path, '/entities/block');
                        directoryCalls++;
                        if (failDirectory) throw new Error('offline fixture');
                        return { data: availableOffers };
                    },
                }),
            },
        },
    ]);
    const { KestenijadaDiscoveryEntry } = await import(
        './KestenijadaDiscoveryEntry'
    );
    const clock = t.mock.method(Date, 'now', () => {
        assert.ok(connected, 'clock read during prerender');
        return instant;
    });

    for (const raw of [
        undefined,
        'invalid',
        '{}',
        JSON.stringify({ ...config, enabled: false }),
        JSON.stringify({ ...config, assetsVerified: false }),
        JSON.stringify({ ...config, endsAt: config.startsAt }),
    ]) {
        if (raw === undefined)
            delete process.env.GREDICE_KESTENIJADA_EVENT_CONFIG;
        else process.env.GREDICE_KESTENIJADA_EVENT_CONFIG = raw;
        assert.equal(await KestenijadaDiscoveryEntry(), null);
    }
    assert.equal(clock.mock.callCount(), 0);
    assert.equal(connectionCalls, 0);
    assert.equal(directoryCalls, 0);

    process.env.GREDICE_KESTENIJADA_EVENT_CONFIG = JSON.stringify(config);
    const request = Promise.withResolvers<void>();
    releaseConnection = () => request.promise;
    const pending = KestenijadaDiscoveryEntry();
    assert.equal(connectionCalls, 1);
    assert.equal(clock.mock.callCount(), 0);
    assert.equal(directoryCalls, 0);
    request.resolve();
    assert.ok(await pending);

    releaseConnection = async () => {};
    for (const [time, visible] of [
        [Date.parse(config.startsAt) - 1, false],
        [Date.parse(config.startsAt), true],
        [Date.parse(config.endsAt) - 1, true],
        [Date.parse(config.endsAt), false],
    ] satisfies [number, boolean][]) {
        instant = time;
        connected = false;
        directoryCalls = 0;
        assert.equal(Boolean(await KestenijadaDiscoveryEntry()), visible);
        assert.equal(directoryCalls, visible ? 1 : 0);
    }

    instant = Date.parse(config.startsAt);
    availableOffers = offers.slice(1);
    assert.equal(await KestenijadaDiscoveryEntry(), null);
    availableOffers = offers.map((row) => ({
        ...row,
        attributes: { ...row.attributes, nightOnlyPurchase: true },
    }));
    assert.equal(await KestenijadaDiscoveryEntry(), null);
    failDirectory = true;
    assert.equal(await KestenijadaDiscoveryEntry(), null);

    // Next's suspension/control flow must escape the catalogue failure guard.
    releaseConnection = async () => {
        throw new Error('prerender suspension');
    };
    await assert.rejects(KestenijadaDiscoveryEntry, /prerender suspension/);
});
