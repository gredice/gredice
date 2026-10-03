import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BoxGeometry, type Material, MeshStandardMaterial } from 'three';
import { meshGeometryLayoutSignature } from './meshBuffers';
import {
    planStaticRenderPackets,
    readStaticRenderPacketMetrics,
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
});
