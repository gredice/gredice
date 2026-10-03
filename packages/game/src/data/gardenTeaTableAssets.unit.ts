import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
    canStackBlockOnBlock,
    getGardenBlockSpan,
} from '@gredice/js/gardenBlocks';
import {
    gardenTeaTable,
    gardenTeaTableMugAnchors,
} from '@gredice/js/gardenTeaTable';

import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import releaseManifest from '../../../../docs/garden-tea-table-2026/release-manifest.json';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { getBlockHitboxSize } from '../utils/blockHitbox';
import { getStackHeight } from '../utils/stackHeightCore';
import {
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

const tableItems = [gardenTeaTable];

describe('Tea table release', () => {
    it('records the exact unpublished catalogue, model bytes and every cover/top-down rotation', () => {
        assert.equal(releaseManifest.state, 'unpublished');
        assert.equal(releaseManifest.publicationIssue, 5000);
        assert.deepEqual(
            releaseManifest.items.map(
                ({ catalogueId, cover, topDown, images, ...item }) => item,
            ),
            tableItems,
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
    it('keeps the table placeable on supports, but never supports another block', () => {
        assert.equal(new Set(tableItems.map((item) => item.name)).size, 1);
        const blocks = getLocalSandboxBlockData();
        for (const item of tableItems) {
            const block = blocks.find(
                (entry) => entry.information.name === item.name,
            );
            assert.ok(block);
            assert.deepEqual(block.attributes, item.attributes);
            assert.equal(block.functions.raisedBed, false);
            assert.equal(block.functions.recycler, false);
            assert.ok(
                block.information.label.startsWith('Vrtni stolić s čajem'),
            );
            assert.match(
                item.information.fullDescription,
                /Posuđe se ne premješta zasebno/,
            );
            assert.equal(block.attributes.placeableOnWater, false);
            for (let rotation = 0; rotation < 4; rotation++) {
                assert.deepEqual(getGardenBlockSpan(block, rotation), {
                    width: 1,
                    depth: 1,
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
        'GardenTeaTable',
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
            assert.equal(document.meshes.length, 2);
            assert.equal(document.materials.length, 2);
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
            gltf.scene.updateMatrixWorld(true);
            for (const anchor of gardenTeaTableMugAnchors) {
                const sourceName = `GardenTeaTable_MugSteam${anchor.id === 'left' ? 'Left' : 'Right'}`;
                const source = gltf.scene.getObjectByName(sourceName);
                assert.ok(source, 'Authored source anchor survives export');
                assert.ok(
                    source
                        .getWorldPosition(new Vector3())
                        .distanceTo(new Vector3(...anchor.position)) < 0.00001,
                );
                const ray = new Raycaster(
                    new Vector3(...anchor.position),
                    new Vector3(0, -1, 0),
                );
                const tea = ray.intersectObjects(gltf.scene.children, true)[0];
                assert.ok(tea, 'Each emitter sits above real tea geometry');
                assert.equal(tea.object.name, 'GardenTeaTable_TeaSet');
                assert.ok(Math.abs(tea.point.y - 0.7732) < 0.0001);
                assert.ok(tea.distance > 0.03 && tea.distance < 0.04);
            }
            let triangles = 0;
            const palette = new Set<string>();
            gltf.scene.traverse((object) => {
                if (object instanceof Mesh) {
                    const colors = object.geometry.getAttribute('color');
                    assert.ok(
                        colors,
                        'Baked colour variations must survive export',
                    );
                    for (let index = 0; index < colors.count; index++) {
                        palette.add(
                            [
                                colors.getX(index),
                                colors.getY(index),
                                colors.getZ(index),
                            ]
                                .map((value) => value.toFixed(3))
                                .join(','),
                        );
                    }
                    triangles +=
                        (object.geometry.index?.count ??
                            object.geometry.getAttribute('position').count) / 3;
                }
            });
            assert.equal(triangles, 1280);
            assert.ok(
                palette.size >= 8,
                'Timber, enamel and tea colours survive export',
            );
            assert.ok(bytes.length < 250_000);
            for (const material of document.materials) {
                assert.equal(material.pbrMetallicRoughness.metallicFactor, 0);
                assert.ok(
                    material.pbrMetallicRoughness.roughnessFactor >= 0.82,
                );
                assert.equal(material.emissiveFactor, undefined);
            }
            for (const item of tableItems) {
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
                }
            }
        });
    }
});
