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

    it('drops empty contributions', () => {
        assert.equal(
            planStaticRenderPackets([contribution('a', { instances: [] })])
                .length,
            0,
        );
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
