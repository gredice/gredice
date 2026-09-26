import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
    autumnEntranceSway,
    autumnEntrances,
} from '@gredice/js/autumnEntrances';
import {
    canStackBlockOnBlock,
    getGardenBlockSpan,
} from '@gredice/js/gardenBlocks';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import release from '../../../../docs/autumn-entrances-2026/release-manifest.json';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { getBlockHitboxSize } from '../utils/blockHitbox';
import { getStackHeight } from '../utils/stackHeightCore';
import {
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

async function load(name: string) {
    const bytes = readFileSync(
        new URL(
            `../../../../apps/garden/public/assets/models/${name}.glb`,
            import.meta.url,
        ),
    );
    const gltf = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
        ),
        '',
    );
    gltf.scene.updateMatrixWorld(true);
    return { bytes, ...gltf };
}
describe('Autumn entrance release', () => {
    it('records exact source, model, preview hashes and unpublished catalogue metadata', () => {
        assert.equal(release.state, 'unpublished');
        assert.equal(release.publicationIssue, 5000);
        assert.deepEqual(
            release.items.map(
                ({ catalogueId, cover, topDown, images, ...item }) => item,
            ),
            autumnEntrances,
        );
        for (const item of release.items) {
            assert.equal(item.catalogueId, null);
            assert.equal(item.images.length, 10);
        }
        for (const file of [
            ...release.sources,
            ...release.models,
            ...release.items.flatMap((i) => i.images),
        ])
            assert.equal(
                createHash('sha256')
                    .update(
                        readFileSync(
                            new URL(
                                `../../../../${file.path}`,
                                import.meta.url,
                            ),
                        ),
                    )
                    .digest('hex'),
                file.sha256,
                file.path,
            );
    });
    it('uses one tile with supported ground/path/display placement and no resource functions', () => {
        const blocks = getLocalSandboxBlockData();
        for (const item of autumnEntrances) {
            const block = blocks.find((b) => b.information.name === item.name);
            assert.ok(block);
            assert.deepEqual(block.attributes, item.attributes);
            assert.equal(block.functions.raisedBed, false);
            assert.equal(block.functions.recycler, false);
            assert.equal(block.attributes.placeableOnWater, false);
            assert.match(
                item.information.fullDescription,
                /ne daju resurse ni nagrade/,
            );
            for (const rotation of [0, 1, 2, 3])
                assert.deepEqual(getGardenBlockSpan(block, rotation), {
                    width: 1,
                    depth: 1,
                });
            for (const name of [
                'Block_Grass',
                'Block_Stone',
                'WoodenWalkway',
                'OutletDisplayTable',
            ]) {
                const below = blocks.find((b) => b.information.name === name);
                assert.ok(below);
                assert.equal(
                    canStackBlockOnBlock({
                        aboveBlockName: item.name,
                        aboveBlockData: block,
                        belowBlockName: name,
                        belowBlockData: below,
                    }),
                    true,
                );
                const placed = { name: item.name, id: 'prop', rotation: 0 };
                assert.equal(
                    getStackHeight(
                        blocks,
                        {
                            position: new Vector3(),
                            blocks: [
                                { name, id: 'support', rotation: 0 },
                                placed,
                            ],
                        },
                        placed,
                    ),
                    below.attributes.height,
                );
            }
            assert.equal(
                canStackBlockOnBlock({
                    aboveBlockName: 'Block_Grass',
                    aboveBlockData: { attributes: { stackable: true } },
                    belowBlockName: item.name,
                    belowBlockData: block,
                }),
                false,
            );
        }
    });
    for (const item of autumnEntrances)
        it(`${item.name} keeps its lazy version, static geometry, anchors and closed bounds`, async () => {
            const { scene, bytes, animations } = await load(item.name);
            assert.equal(animations.length, 0);
            assert.ok(lazyGameAssetNames.includes(item.name));
            assert.equal(
                gameAssetModels[item.name].url,
                `/assets/models/${item.name}.glb?v=${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`,
            );
            const meshes: Mesh[] = [];
            scene.traverse((o) => {
                if (o instanceof Mesh) meshes.push(o);
            });
            const triangles = meshes.reduce(
                (n, m) =>
                    n +
                    (m.geometry.index?.count ??
                        m.geometry.getAttribute('position').count) /
                        3,
                0,
            );
            assert.equal(
                triangles,
                item.name === 'AutumnWreathPost'
                    ? 920
                    : item.name === 'AutumnGarland'
                      ? 696
                      : 1972,
            );
            assert.equal(
                meshes.length,
                item.name === 'AutumnFenceGate' ? 4 : 2,
            );
            assert.ok(bytes.length < 250000);
            if (item.name !== 'AutumnFenceGate') {
                const sway = autumnEntranceSway[item.name];
                const names =
                    item.name === 'AutumnWreathPost'
                        ? ['SwayRoot']
                        : ['SwayLeft', 'SwayRight'];
                names.forEach((name, index) => {
                    const a = scene.getObjectByName(`${item.name}_${name}`);
                    assert.ok(a);
                    assert.ok(
                        a
                            .getWorldPosition(new Vector3())
                            .distanceTo(new Vector3(...sway.roots[index])) <
                            0.00001,
                    );
                });
                const foliage = scene.getObjectByName(`${item.name}_Foliage`);
                assert.ok(foliage);
                const box = new Box3().setFromObject(foliage);
                for (const axis of ['x', 'z'] satisfies ('x' | 'z')[]) {
                    assert.ok(box.min[axis] - 0.025 >= -0.45);
                    assert.ok(box.max[axis] + 0.025 <= 0.45);
                }
            } else {
                const leaf = scene.getObjectByName('AutumnFenceGate_Leaf');
                assert.ok(leaf);
                leaf.position.x = -0.43;
                const decor = scene.getObjectByName('AutumnFenceGate_Decor');
                assert.ok(decor);
                const box = new Box3().setFromObject(decor);
                for (let step = 0; step <= 18; step++) {
                    leaf.rotation.y = ((-Math.PI / 2) * step) / 18;
                    scene.updateMatrixWorld(true);
                    assert.ok(
                        !new Box3().setFromObject(leaf).intersectsBox(box),
                        'Fixed pumpkins must clear the entire hinge sweep',
                    );
                }
                leaf.rotation.y = 0;
            }
            const hitbox = getBlockHitboxSize(
                getLocalSandboxBlockData().find(
                    (b) => b.information.name === item.name,
                ),
            );
            for (const rotation of [0, 1, 2, 3]) {
                scene.rotation.y = (rotation * Math.PI) / 2;
                scene.updateMatrixWorld(true);
                const b = new Box3().setFromObject(scene);
                assert.ok(
                    b.min.x >= -hitbox.width / 2 && b.max.x <= hitbox.width / 2,
                );
                assert.ok(
                    b.min.z >= -hitbox.depth / 2 && b.max.z <= hitbox.depth / 2,
                );
                assert.ok(
                    Math.abs(b.min.y) < 0.0001 && b.max.y <= hitbox.height,
                );
            }
        });
    it('preserves the original gate posts and hinge-relative leaf geometry', async () => {
        const original = await load('FenceGate');
        const decorated = await load('AutumnFenceGate');
        for (const part of ['Posts', 'Leaf_Mesh', 'Leaf_Mesh_1']) {
            const before = original.scene.getObjectByName(`FenceGate_${part}`);
            const after = decorated.scene.getObjectByName(
                `AutumnFenceGate_${part}`,
            );
            assert.ok(before instanceof Mesh && after instanceof Mesh, part);
            assert.deepEqual(
                Array.from(after.geometry.getAttribute('position').array),
                Array.from(before.geometry.getAttribute('position').array),
                part,
            );
            assert.deepEqual(
                Array.from(after.geometry.index?.array ?? []),
                Array.from(before.geometry.index?.array ?? []),
                part,
            );
        }
    });
});
