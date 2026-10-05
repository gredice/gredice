import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fallenLog } from '@gredice/js/fallenLog';
import {
    canStackBlockOnBlock,
    getGardenBlockSpan,
} from '@gredice/js/gardenBlocks';

import { Box3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import releaseManifest from '../../../../docs/fallen-log-2026/release-manifest.json';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { getBlockHitboxSize } from '../utils/blockHitbox';
import { getStackHeight } from '../utils/stackHeightCore';
import {
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

const logs = [fallenLog];

describe('FallenLog release', () => {
    it('records the exact unpublished catalogue, model bytes and every cover/top-down rotation', () => {
        assert.equal(releaseManifest.state, 'unpublished');
        assert.equal(releaseManifest.publicationIssue, 5000);
        assert.deepEqual(
            releaseManifest.items.map(
                ({ catalogueId, cover, topDown, images, ...item }) => item,
            ),
            logs,
        );
        for (const item of releaseManifest.items) {
            assert.equal(item.catalogueId, null);
            assert.equal(item.images.length, 10);
        }
        for (const file of [
            releaseManifest.source,
            ...releaseManifest.models,
            ...releaseManifest.items.flatMap((item) => item.images),
        ]) {
            const bytes = readFileSync(
                new URL(`../../../../${file.path}`, import.meta.url),
            );
            assert.equal(
                createHash('sha256').update(bytes).digest('hex'),
                file.sha256,
                file.path,
            );
        }
    });
    it('keeps the log placeable on supports, but never supports another block', () => {
        assert.equal(new Set(logs.map((item) => item.name)).size, 1);
        const blocks = getLocalSandboxBlockData();
        for (const item of logs) {
            const block = blocks.find(
                (entry) => entry.information.name === item.name,
            );
            assert.ok(block);
            assert.deepEqual(block.attributes, item.attributes);
            assert.equal(block.functions.raisedBed, false);
            assert.equal(block.functions.recycler, false);
            assert.equal(block.information.label, 'Palo deblo s mahovinom');
            for (let rotation = 0; rotation < 4; rotation++) {
                assert.deepEqual(getGardenBlockSpan(block, rotation), {
                    width: rotation % 2 ? 1 : 2,
                    depth: rotation % 2 ? 2 : 1,
                });
            }
            for (const belowBlockName of [
                'Block_Grass',
                'Block_Stone',
                'OutletDisplayTable',
                'WoodenWalkway',
            ]) {
                const belowBlockData = blocks.find(
                    (entry) => entry.information.name === belowBlockName,
                );
                assert.ok(belowBlockData);
                assert.equal(
                    canStackBlockOnBlock({
                        aboveBlockName: item.name,
                        aboveBlockData: block,
                        belowBlockName,
                        belowBlockData,
                    }),
                    true,
                );
                const placed = { name: item.name, id: item.name, rotation: 0 };
                const stack = {
                    position: new Vector3(),
                    blocks: [
                        { name: belowBlockName, id: 'support', rotation: 0 },
                        placed,
                    ],
                };
                assert.equal(
                    getStackHeight(blocks, stack, placed),
                    belowBlockData.attributes.height,
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

    for (const asset of [
        'FallenLog',
    ] satisfies (keyof typeof gameAssetModels)[]) {
        it(`${asset} has versioned lazy geometry inside every rotation's declared hitbox`, async () => {
            const bytes = readFileSync(
                new URL(
                    `../../../../apps/garden/public/assets/models/${asset}.glb`,
                    import.meta.url,
                ),
            );
            const document = JSON.parse(
                bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
            );
            assert.equal(document.meshes.length, 1);
            assert.equal(document.materials.length, 1);
            assert.equal(document.textures, undefined);
            assert.equal(document.animations, undefined);
            assert.ok(lazyGameAssetNames.includes(asset));
            assert.equal(document.meshes[0].primitives.length, 1);
            assert.equal(
                typeof document.meshes[0].primitives[0].attributes.COLOR_0,
                'number',
            );
            assert.equal(
                gameAssetModels[asset].url,
                `/assets/models/${asset}.glb?v=${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`,
            );
            const gltf = await new GLTFLoader().parseAsync(
                bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                ),
                '',
            );
            let triangles = 0;
            gltf.scene.traverse((object) => {
                if (object instanceof Mesh) {
                    triangles +=
                        (object.geometry.index?.count ??
                            object.geometry.getAttribute('position').count) / 3;
                }
            });
            assert.equal(triangles, 389);
            assert.ok(bytes.length < 300_000);
            for (const item of logs) {
                const hitbox = getBlockHitboxSize(
                    getLocalSandboxBlockData().find(
                        (entry) => entry.information.name === item.name,
                    ),
                );
                for (let rotation = 0; rotation < 4; rotation++) {
                    gltf.scene.rotation.y = (rotation * Math.PI) / 2;
                    gltf.scene.updateMatrixWorld(true);
                    const bounds = new Box3().setFromObject(gltf.scene);
                    const width = rotation % 2 ? hitbox.depth : hitbox.width;
                    const depth = rotation % 2 ? hitbox.width : hitbox.depth;
                    assert.ok(
                        bounds.min.x >= -width / 2 && bounds.max.x <= width / 2,
                    );
                    assert.ok(
                        bounds.min.z >= -depth / 2 && bounds.max.z <= depth / 2,
                    );
                    assert.ok(
                        Math.abs(bounds.min.y) < 0.0001 &&
                            bounds.max.y <= hitbox.height,
                    );
                    const span = getGardenBlockSpan(item, rotation);
                    gltf.scene.position.set(
                        (span.width - 1) / 2,
                        0,
                        (span.depth - 1) / 2,
                    );
                    gltf.scene.updateMatrixWorld(true);
                    const placed = new Box3().setFromObject(gltf.scene);
                    assert.ok(
                        placed.min.x >= -0.45 &&
                            placed.max.x <= span.width - 0.55,
                    );
                    assert.ok(
                        placed.min.z >= -0.45 &&
                            placed.max.z <= span.depth - 0.55,
                    );
                    gltf.scene.position.set(0, 0, 0);
                }
            }
        });
    }
});
