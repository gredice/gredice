import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BoxGeometry, type Material, MeshStandardMaterial } from 'three';
import { meshGeometryLayoutSignature } from './meshBuffers';
import {
    planStaticRenderPackets,
    readStaticRenderPacketMetrics,
    type StaticRenderPacket,
    type StaticRenderPacketContribution,
    StaticRenderPacketRegistry,
} from './staticRenderPackets';

const box = new BoxGeometry();
const wide = new BoxGeometry(2, 1, 1);
const sharedMaterial = new MeshStandardMaterial();
const otherMaterial = new MeshStandardMaterial();
const localTransform = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
} satisfies StaticRenderPacketContribution['localTransform'];

function contribution(
    id: string,
    overrides: Partial<StaticRenderPacketContribution> & {
        material?: Material;
    } = {},
): StaticRenderPacketContribution {
    const geometry = overrides.geometry ?? box;
    return {
        cacheGroup: 'base-terrain',
        castShadow: true,
        chunkKey: '0:0',
        family: 'opaque',
        geometry,
        id,
        instances: [{ position: [1, 0, 1], rotation: 0 }],
        layoutSignature: meshGeometryLayoutSignature(geometry),
        localTransform,
        material: sharedMaterial,
        receiveShadow: true,
        renderOrder: undefined,
        scale: 1,
        triangleCount: 12,
        ...overrides,
    };
}

describe('static render packet planning', () => {
    it('joins heterogeneous geometry that shares a material in one chunk', () => {
        const packets = planStaticRenderPackets([
            contribution('b', { geometry: wide }),
            contribution('a'),
        ]);
        assert.equal(packets.length, 1);
        assert.deepEqual(
            packets[0]?.contributions.map(({ id }) => id),
            ['a', 'b'],
        );
        assert.equal(packets[0]?.instanceCount, 2);
        assert.equal(packets[0]?.triangleCount, 24);
    });

    it('keeps every render-affecting difference in separate packets', () => {
        const packets = planStaticRenderPackets([
            contribution('base'),
            contribution('material', { material: otherMaterial }),
            contribution('chunk', { chunkKey: '1:0' }),
            contribution('shadow', { castShadow: false }),
            contribution('receive', { receiveShadow: false }),
            contribution('order', { renderOrder: 2 }),
            contribution('cache', { cacheGroup: 'static-props' }),
            contribution('layout', { layoutSignature: 'other' }),
        ]);
        assert.equal(packets.length, 8);
    });

    it('keeps authored pending inputs separate from the compiled palette sources', () => {
        const source = contribution('source', {
            geometry: wide,
            fallbackGeometry: box,
            fallbackMaterial: otherMaterial,
        });
        const [packet] = planStaticRenderPackets([
            source,
            contribution('other'),
        ]);
        assert.equal(
            packet?.sources.find(({ geometry }) => geometry === wide)?.geometry,
            wide,
        );
        assert.equal(
            packet?.contributions.find(({ id }) => id === 'source')
                ?.fallbackGeometry,
            box,
        );
        assert.equal(
            packet?.contributions.find(({ id }) => id === 'source')
                ?.fallbackMaterial,
            otherMaterial,
        );
        assert.equal(packet?.material, sharedMaterial);
        assert.equal(packet?.contributions.length, 2);
    });

    it('drops empty contributions', () => {
        assert.equal(
            planStaticRenderPackets([contribution('a', { instances: [] })])
                .length,
            0,
        );
    });

    it('retains an empty placement member as telemetry without adding rendered sources or savings', () => {
        const a = contribution('a', { placementSignature: '' });
        const b = contribution('b', { placementSignature: '' });
        const before = planStaticRenderPackets([a, b]);
        const dropping = contribution('a', {
            instances: [],
            placementSignature: '["a"]',
        });
        const during = planStaticRenderPackets([dropping, b], before);
        assert.equal(during.length, 1);
        assert.deepEqual(during[0]?.contributions, [b]);
        assert.equal(during[0]?.sources.length, 1);
        assert.equal(during[0]?.triangleCount, 12);
        assert.equal(during[0]?.instanceCount, 1);
        assert.deepEqual(during[0]?.placementContributions, [dropping, b]);
        assert.equal(planStaticRenderPackets([dropping, b], during), during);
        const after = planStaticRenderPackets([a, b], during);
        assert.equal(after[0]?.sources.length, 2);
        assert.deepEqual(after[0]?.placementContributions, [a, b]);
        assert.equal(planStaticRenderPackets([dropping]).length, 0);
        const registry = new StaticRenderPacketRegistry();
        registry.set('members', [dropping, b]);
        registry.getSnapshot();
        const metrics = readStaticRenderPacketMetrics();
        assert.equal(metrics.contributions, 1);
        assert.equal(metrics.savedSubmissions, 0);
        registry.delete('members');
        registry.getSnapshot();
    });

    it('retains untouched packets and source lists across a patch', () => {
        const a = contribution('a');
        const b = contribution('b', { chunkKey: '1:0' });
        const first = planStaticRenderPackets([a, b]);
        assert.equal(planStaticRenderPackets([a, b], first), first);
        const patched = contribution('b', {
            chunkKey: '1:0',
            instances: [{ position: [9, 0, 1], rotation: 1 }],
        });
        const second = planStaticRenderPackets([a, patched], first);
        assert.notEqual(second, first);
        const untouched = first.find((packet) => packet.chunkKey === '0:0');
        const retained = second.find((packet) => packet.chunkKey === '0:0');
        assert.equal(retained, untouched);
        assert.equal(retained?.sources, untouched?.sources);
        assert.notEqual(
            second.find((packet) => packet.chunkKey === '1:0'),
            first.find((packet) => packet.chunkKey === '1:0'),
        );
    });

    it('preserves compiler inputs through signed-empty insertion, replacement and removal', () => {
        const a = contribution('a');
        const b = contribution('b');
        const original = planStaticRenderPackets([a, b]);
        const packet = original[0];
        assert.ok(packet);
        const empty = contribution('telemetry', {
            instances: [],
            placementSignature: '["first"]',
        });
        const inserted = planStaticRenderPackets([a, b, empty], original);
        const insertedPacket = inserted[0];
        assert.ok(insertedPacket);
        assert.notEqual(insertedPacket, packet);
        assert.equal(insertedPacket.sources, packet.sources);
        assert.equal(insertedPacket.contributions, packet.contributions);
        assert.equal(insertedPacket.instanceCount, 2);
        assert.equal(insertedPacket.triangleCount, 24);
        assert.equal(
            planStaticRenderPackets([a, b, empty], inserted),
            inserted,
        );

        const replacement = { ...empty, placementSignature: '["second"]' };
        const replaced = planStaticRenderPackets([replacement, b, a], inserted);
        assert.notEqual(replaced[0], insertedPacket);
        assert.equal(replaced[0]?.sources, packet.sources);
        assert.equal(replaced[0]?.contributions, packet.contributions);
        assert.equal(replaced[0]?.placementContributions?.at(-1), replacement);
        assert.equal(
            planStaticRenderPackets([a, b, replacement], replaced),
            replaced,
        );

        const removed = planStaticRenderPackets([a, b], replaced);
        assert.notEqual(removed[0], replaced[0]);
        assert.equal(removed[0]?.sources, packet.sources);
        assert.equal(removed[0]?.contributions, packet.contributions);
        assert.deepEqual(removed[0]?.placementContributions, [a, b]);
        assert.equal(planStaticRenderPackets([a, b], removed), removed);
    });

    it('still invalidates compiler inputs when a signed member becomes drawable or transforms change', () => {
        const a = contribution('a');
        const b = contribution('b');
        const empty = contribution('telemetry', {
            instances: [],
            placementSignature: '["telemetry"]',
        });
        const original = planStaticRenderPackets([a, b, empty]);
        const drawable = contribution('telemetry', {
            placementSignature: '["telemetry"]',
        });
        const joined = planStaticRenderPackets([a, b, drawable], original);
        assert.notEqual(joined[0]?.sources, original[0]?.sources);
        assert.equal(joined[0]?.sources.length, 3);
        assert.equal(joined[0]?.instanceCount, 3);
        const moved = contribution('a', {
            instances: [{ position: [4, 0, 1], rotation: 1 }],
            placementSignature: '["a"]',
        });
        const changed = planStaticRenderPackets([moved, b, drawable], joined);
        assert.notEqual(changed[0]?.sources, joined[0]?.sources);
        assert.notEqual(changed[0]?.contributions, joined[0]?.contributions);
        assert.equal(changed[0]?.sources[0]?.instances, moved.instances);
    });
});

describe('static render packet registry', () => {
    it('plans once per change and reports saved submissions', () => {
        const registry = new StaticRenderPacketRegistry();
        let notifications = 0;
        const unsubscribe = registry.subscribe(() => {
            notifications++;
        });
        const ground = [contribution('ground')];
        registry.set('ground', ground);
        registry.set('corner', [contribution('corner', { geometry: wide })]);
        registry.set('ground', ground);
        assert.equal(notifications, 2);
        const packets = registry.getSnapshot();
        assert.equal(registry.getSnapshot(), packets);
        assert.equal(packets.length, 1);
        const metrics = readStaticRenderPacketMetrics();
        assert.equal(metrics.contributions, 2);
        assert.equal(metrics.packets, 1);
        assert.equal(metrics.savedSubmissions, 1);
        registry.delete('corner');
        registry.set('ground', []);
        assert.equal(registry.getSnapshot().length, 0);
        unsubscribe();
    });

    it('publishes a current snapshot synchronously and preserves no-op notifications', () => {
        const registry = new StaticRenderPacketRegistry();
        const snapshots: (readonly StaticRenderPacket[])[] = [];
        registry.subscribe(() => snapshots.push(registry.getSnapshot()));
        const a = contribution('a');
        registry.set('a', [a]);
        assert.equal(snapshots.length, 1);
        assert.equal(snapshots[0], registry.getSnapshot());
        assert.deepEqual(snapshots[0]?.[0]?.contributions, [a]);
        registry.set('a', [a]);
        registry.delete('missing');
        registry.set('missing', []);
        assert.equal(snapshots.length, 1);
        const b = contribution('b', { chunkKey: '1:0' });
        registry.set('a', [b]);
        assert.equal(snapshots.length, 2);
        assert.deepEqual(snapshots[1]?.[0]?.contributions, [b]);
        registry.set('a', []);
        assert.equal(snapshots.length, 3);
        assert.equal(snapshots[2]?.length, 0);
    });

    it('preserves occurrence multiplicity and stable tied-id owner ordering', () => {
        const registry = new StaticRenderPacketRegistry();
        const repeated = contribution('same');
        const second = contribution('same', { geometry: wide });
        registry.set('first', [repeated, repeated]);
        registry.set('second', [second, repeated]);
        assert.deepEqual(registry.getSnapshot()[0]?.contributions, [
            repeated,
            repeated,
            second,
            repeated,
        ]);
        const replacement = contribution('same', {
            instances: [{ position: [7, 0, 1], rotation: 0 }],
        });
        registry.set('first', [replacement]);
        assert.deepEqual(registry.getSnapshot()[0]?.contributions, [
            replacement,
            second,
            repeated,
        ]);
        registry.delete('first');
        registry.set('first', [replacement]);
        assert.deepEqual(registry.getSnapshot()[0]?.contributions, [
            second,
            repeated,
            replacement,
        ]);
        registry.delete('second');
        const packet = registry.getSnapshot()[0];
        assert.deepEqual(packet?.contributions, [replacement]);
        assert.equal(packet?.sources.length, 1);
        assert.equal(packet?.instanceCount, 1);
    });

    it('updates both sides of every packet-key migration and retains unrelated sources', () => {
        const migrations: Partial<StaticRenderPacketContribution>[] = [
            { chunkKey: '1:0' },
            { material: otherMaterial },
            { castShadow: false },
            { receiveShadow: false },
            { renderOrder: 2 },
            { cacheGroup: 'static-props' },
            { layoutSignature: 'other' },
        ];
        for (const migration of migrations) {
            const registry = new StaticRenderPacketRegistry();
            const a = contribution('a');
            const peer = contribution('peer');
            const unrelated = contribution('unrelated', {
                chunkKey: 'unrelated',
            });
            registry.set('a', [a]);
            registry.set('peer', [peer]);
            registry.set('unrelated', [unrelated]);
            const before = registry.getSnapshot();
            const retained = before.find(
                ({ chunkKey }) => chunkKey === 'unrelated',
            );
            const moved = contribution('a', migration);
            registry.set('a', [moved]);
            const after = registry.getSnapshot();
            assert.deepEqual(
                after,
                planStaticRenderPackets([moved, peer, unrelated], before),
            );
            assert.equal(after.length, 3);
            assert.equal(
                after.find(({ chunkKey }) => chunkKey === 'unrelated'),
                retained,
            );
            assert.equal(
                after.find(({ chunkKey }) => chunkKey === 'unrelated')?.sources,
                retained?.sources,
            );
            registry.set('a', [a]);
            const joined = registry.getSnapshot();
            assert.deepEqual(
                joined,
                planStaticRenderPackets([a, peer, unrelated], after),
            );
            assert.equal(joined.length, 2);
            assert.equal(
                joined.find(({ chunkKey }) => chunkKey === 'unrelated'),
                retained,
            );
        }
    });

    it('keeps signed-empty buckets and telemetry without rebuilding compiler inputs', () => {
        const registry = new StaticRenderPacketRegistry();
        let notifications = 0;
        registry.subscribe(() => notifications++);
        const empty = contribution('a', {
            instances: [],
            placementSignature: 'first',
        });
        registry.set('empty', [empty]);
        const initial = registry.getSnapshot();
        assert.equal(initial.length, 0);
        const drawable = contribution('b');
        registry.set('drawable', [drawable]);
        const packet = registry.getSnapshot()[0];
        assert.ok(packet);
        assert.deepEqual(packet.placementContributions, [empty, drawable]);
        const changed = { ...empty, placementSignature: 'second' };
        registry.set('empty', [changed]);
        const telemetry = registry.getSnapshot()[0];
        assert.notEqual(telemetry, packet);
        assert.equal(telemetry?.sources, packet.sources);
        assert.equal(telemetry?.contributions, packet.contributions);
        const unsigned = { ...changed, placementSignature: undefined };
        registry.set('empty', [unsigned]);
        const withoutTelemetry = registry.getSnapshot()[0];
        assert.equal(withoutTelemetry?.sources, packet.sources);
        assert.deepEqual(withoutTelemetry?.placementContributions, [drawable]);
        const snapshot = registry.getSnapshot();
        registry.set('empty', [contribution('ignored', { instances: [] })]);
        assert.equal(registry.getSnapshot(), snapshot);
        assert.equal(notifications, 5);
        registry.delete('drawable');
        assert.equal(registry.getSnapshot().length, 0);
        registry.set('empty', [changed]);
        assert.equal(registry.getSnapshot().length, 0);
        registry.set('drawable', [drawable]);
        assert.deepEqual(registry.getSnapshot()[0]?.placementContributions, [
            changed,
            drawable,
        ]);
        const becameDrawable = {
            ...changed,
            instances: drawable.instances,
        };
        registry.set('empty', [becameDrawable]);
        const withBothSources = registry.getSnapshot()[0];
        assert.deepEqual(withBothSources?.contributions, [
            becameDrawable,
            drawable,
        ]);
        assert.equal(withBothSources?.sources.length, 2);
        registry.set('empty', [changed]);
        const backToTelemetry = registry.getSnapshot()[0];
        assert.deepEqual(backToTelemetry?.contributions, [drawable]);
        assert.equal(backToTelemetry?.sources.length, 1);
        assert.notEqual(backToTelemetry?.sources, withBothSources?.sources);
    });

    it('coalesces unread replacements and committed setup-cleanup-setup without stale members', () => {
        const registry = new StaticRenderPacketRegistry();
        const a = contribution('a');
        registry.set('owner', [a]);
        const original = registry.getSnapshot();
        registry.set('owner', [
            contribution('transient', { chunkKey: 'other' }),
        ]);
        registry.set('owner', [a]);
        assert.equal(registry.getSnapshot(), original);
        registry.delete('owner');
        registry.set('owner', [a]);
        assert.equal(registry.getSnapshot(), original);
        registry.delete('owner');
        assert.equal(registry.getSnapshot().length, 0);
        // An aborted render never calls the layout-effect registration writer.
        const otherRoot = new StaticRenderPacketRegistry();
        assert.equal(otherRoot.getSnapshot().length, 0);
        registry.set('owner', [a]);
        assert.equal(otherRoot.getSnapshot().length, 0);
        assert.deepEqual(registry.getSnapshot()[0]?.contributions, [a]);
    });

    it('allows reentrant updates before later synchronous subscribers read the snapshot', () => {
        const registry = new StaticRenderPacketRegistry();
        const a = contribution('a');
        const b = contribution('b');
        const seen: string[][] = [];
        let nested = false;
        registry.subscribe(() => {
            seen.push(
                registry
                    .getSnapshot()
                    .flatMap(({ contributions }) =>
                        contributions.map(({ id }) => id),
                    ),
            );
            if (!nested) {
                nested = true;
                registry.set('nested', [b]);
            }
        });
        registry.subscribe(() => {
            seen.push(
                registry
                    .getSnapshot()
                    .flatMap(({ contributions }) =>
                        contributions.map(({ id }) => id),
                    ),
            );
        });
        registry.set('outer', [a]);
        assert.deepEqual(seen, [['a'], ['a', 'b'], ['a', 'b'], ['a', 'b']]);
        assert.deepEqual(registry.getSnapshot()[0]?.contributions, [a, b]);
    });

    it('preserves live subscription changes while notifying', () => {
        const registry = new StaticRenderPacketRegistry();
        const called: string[] = [];
        let removeSecond = () => {};
        let changed = false;
        registry.subscribe(() => {
            called.push('first');
            if (!changed) {
                changed = true;
                removeSecond();
                registry.subscribe(() => called.push('third'));
            }
        });
        removeSecond = registry.subscribe(() => called.push('second'));
        registry.set('owner', [contribution('a')]);
        assert.deepEqual(called, ['first', 'third']);
    });

    it('never revisits unrelated contribution keys on synchronous registration, replacement or deletion', () => {
        const registry = new StaticRenderPacketRegistry();
        registry.subscribe(() => registry.getSnapshot());
        const reads = new Map<string, number>();
        for (let index = 0; index < 64; index++) {
            const id = `owner-${index}`;
            const previous = new Map(reads);
            const base = contribution(id, { chunkKey: `chunk-${index}` });
            const tracked = {
                ...base,
                get layoutSignature() {
                    reads.set(id, (reads.get(id) ?? 0) + 1);
                    return base.layoutSignature;
                },
            };
            registry.set(id, [tracked]);
            for (const [owner, count] of previous)
                assert.equal(reads.get(owner), count);
        }
        const before = registry.getSnapshot();
        const previous = new Map(reads);
        registry.delete('owner-0');
        for (const [owner, count] of previous)
            assert.equal(reads.get(owner), count);
        const afterDelete = registry.getSnapshot();
        for (const packet of afterDelete) {
            const old = before.find(({ key }) => key === packet.key);
            assert.equal(packet, old);
            assert.equal(packet.sources, old?.sources);
        }
        registry.set('owner-1', [
            contribution('replacement', { chunkKey: 'replacement' }),
        ]);
        for (const [owner, count] of previous)
            assert.equal(reads.get(owner), count);
        assert.equal(
            registry.getSnapshot().flatMap(({ contributions }) => contributions)
                .length,
            63,
        );
    });

    it('matches the full planner oracle through ordered owner mutations and delayed snapshots', () => {
        const registry = new StaticRenderPacketRegistry();
        const owners = new Map<
            string,
            readonly StaticRenderPacketContribution[]
        >();
        const inputs = Array.from({ length: 12 }, (_, index) =>
            contribution(`id-${index % 3}`, {
                chunkKey: `chunk-${index % 4}`,
                instances:
                    index % 5 === 0
                        ? []
                        : [{ position: [index, 0, 1], rotation: 0 }],
                placementSignature:
                    index % 5 === 0 && index % 2 === 0
                        ? `placement-${index}`
                        : undefined,
                material: index % 2 === 0 ? sharedMaterial : otherMaterial,
            }),
        );
        let expected: readonly StaticRenderPacket[] = [];
        let previousActual = registry.getSnapshot();
        let random = 12345;
        const next = () => {
            random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
            return random >>> 8;
        };
        const check = () => {
            const previousExpected = expected;
            expected = planStaticRenderPackets(
                [...owners.values()].flat(),
                expected,
            );
            const actual = registry.getSnapshot();
            assert.deepEqual(actual, expected);
            if (expected === previousExpected)
                assert.equal(actual, previousActual);
            const unchanged = new Set(
                expected
                    .filter((packet) => previousExpected.includes(packet))
                    .map(({ key }) => key),
            );
            for (const packet of actual) {
                if (!unchanged.has(packet.key)) continue;
                const old = previousActual.find(
                    ({ key }) => key === packet.key,
                );
                assert.equal(packet, old);
                assert.equal(packet.sources, old?.sources);
            }
            previousActual = actual;
        };
        for (let index = 0; index < 180; index++) {
            const owner = `owner-${next() % 9}`;
            if (next() % 4 === 0) {
                owners.delete(owner);
                registry.delete(owner);
            } else {
                const first = inputs[next() % inputs.length];
                const second = inputs[next() % inputs.length];
                assert.ok(first);
                assert.ok(second);
                const members =
                    index % 7 === 0
                        ? []
                        : index % 3 === 0
                          ? [first, first, second]
                          : [first, second];
                if (members.length) owners.set(owner, members);
                else owners.delete(owner);
                registry.set(owner, members);
            }
            if (index % 3 === 0) check();
        }
        check();
    });
});
