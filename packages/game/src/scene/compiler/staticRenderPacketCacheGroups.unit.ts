import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import { meshGeometryLayoutSignature } from './meshBuffers';
import { groupStaticRenderPacketsForCache } from './staticRenderPacketCacheGroups';
import {
    planStaticRenderPackets,
    type StaticRenderPacketContribution,
} from './staticRenderPackets';

function packet(
    id: string,
    material = new MeshStandardMaterial(),
    cacheGroup: StaticRenderPacketContribution['cacheGroup'] = 'static-props',
) {
    const geometry = new BoxGeometry();
    const [packet] = planStaticRenderPackets([
        {
            id,
            material,
            geometry,
            cacheGroup,
            chunkKey: '0:0',
            castShadow: true,
            receiveShadow: true,
            instances: [{ position: [0, 0, 0], rotation: 0 }],
            localTransform: { position: [0, 0, 0], rotation: [0, 0, 0] },
            scale: 1,
            renderOrder: 0,
            triangleCount: 12,
            family: 'opaque',
            layoutSignature: meshGeometryLayoutSignature(geometry),
        },
    ]);
    assert.ok(packet);
    return packet;
}

test('cutout and unknown shaders cannot take compatible packets out of their cached layer', () => {
    const opaque = packet('opaque');
    const cutout = packet(
        'cutout',
        new MeshStandardMaterial({ alphaTest: 0.5 }),
    );
    const custom = new MeshStandardMaterial();
    custom.onBeforeCompile = () => {};
    const unknown = packet('unknown', custom);
    const ground = packet('ground', new MeshStandardMaterial(), 'base-terrain');
    const groups = groupStaticRenderPacketsForCache([
        opaque,
        cutout,
        unknown,
        ground,
    ]);
    assert.deepEqual(groups.get('static-props:replay'), [opaque]);
    assert.deepEqual(groups.get('static-props:live'), [cutout, unknown]);
    assert.deepEqual(groups.get('base-terrain:replay'), [ground]);
    const next = groupStaticRenderPacketsForCache(
        [opaque, cutout, ground],
        groups,
    );
    assert.equal(
        next.get('static-props:replay'),
        groups.get('static-props:replay'),
    );
    assert.equal(
        next.get('base-terrain:replay'),
        groups.get('base-terrain:replay'),
    );
    assert.notEqual(
        next.get('static-props:live'),
        groups.get('static-props:live'),
    );
});

test('material eligibility changes move only the affected packet partition', () => {
    const a = packet('a'),
        b = packet('b');
    const groups = groupStaticRenderPacketsForCache([a, b]);
    b.material.transparent = true;
    const changed = groupStaticRenderPacketsForCache([a, b], groups);
    assert.deepEqual(changed.get('static-props:replay'), [a]);
    assert.deepEqual(changed.get('static-props:live'), [b]);
});
