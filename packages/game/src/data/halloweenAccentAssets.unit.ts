import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
    canStackBlockOnBlock,
    getGardenBlockSpan,
} from '@gredice/js/gardenBlocks';
import { halloweenAccents } from '@gredice/js/halloweenAccents';
import { Box3, Mesh, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import release from '../../../../docs/halloween-accents-2026/release-manifest.json';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import {
    gameAssetModels,
    lazyGameAssetNames,
} from './gameAssetModels.generated';

describe('Friendly Halloween accent release', () => {
    it('preserves unpublished catalogue and exact source/model/preview hashes', () => {
        assert.equal(release.state, 'unpublished');
        assert.equal(release.publicationIssue, 5000);
        assert.deepEqual(
            release.items.map(
                ({ catalogueId, cover, topDown, images, ...item }) => item,
            ),
            halloweenAccents,
        );
        for (const item of release.items) {
            assert.equal(item.catalogueId, null);
            assert.equal(item.images.length, 10);
        }
        for (const file of [
            ...release.sources,
            ...release.models,
            ...release.items.flatMap((item) => item.images),
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
    it('keeps purchased accents usable all year on ordinary supports, never as supports', () => {
        const data = getLocalSandboxBlockData();
        for (const item of halloweenAccents) {
            const block = data.find((b) => b.information.name === item.name);
            assert.ok(block);
            assert.deepEqual(block.attributes, item.attributes);
            assert.equal(
                item.sunflowers,
                item.name === 'FriendlyGhost' ? 45 : 30,
            );
            assert.equal(item.attributes.placeableOnWater, false);
            assert.match(
                item.information.fullDescription,
                /tijekom cijele godine/,
            );
            for (let rotation = 0; rotation < 4; rotation++)
                assert.deepEqual(getGardenBlockSpan(block, rotation), {
                    width: 1,
                    depth: 1,
                });
            for (const name of [
                'Block_Grass',
                'Block_Stone',
                'OutletDisplayTable',
                'WoodenWalkway',
            ]) {
                const support = data.find((b) => b.information.name === name);
                assert.ok(support);
                assert.equal(
                    canStackBlockOnBlock({
                        aboveBlockName: item.name,
                        aboveBlockData: block,
                        belowBlockName: name,
                        belowBlockData: support,
                    }),
                    true,
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
    for (const { name } of halloweenAccents)
        it(`${name} has opaque strands and surfaces and bounded lazy geometry`, async () => {
            const bytes = readFileSync(
                new URL(
                    `../../../../apps/garden/public/assets/models/${name}.glb`,
                    import.meta.url,
                ),
            );
            assert.ok(lazyGameAssetNames.includes(name));
            assert.equal(
                gameAssetModels[name].url,
                `/assets/models/${name}.glb?v=${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`,
            );
            const gltf = await new GLTFLoader().parseAsync(
                bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                ),
                '',
            );
            gltf.scene.updateMatrixWorld(true);
            const document = JSON.parse(
                bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
            );
            assert.equal(document.meshes.length, 1);
            assert.equal(document.materials.length, 1);
            assert.equal(document.textures, undefined);
            assert.equal(document.animations, undefined);
            assert.equal(document.extensions?.KHR_lights_punctual, undefined);
            let triangles = 0;
            gltf.scene.traverse((node) => {
                if (node instanceof Mesh)
                    triangles +=
                        (node.geometry.index?.count ??
                            node.geometry.getAttribute('position').count) / 3;
            });
            assert.equal(triangles, name === 'FriendlyGhost' ? 468 : 596);
            assert.ok(bytes.length < 200000);
            for (const material of document.materials) {
                assert.ok(
                    !material.alphaMode || material.alphaMode === 'OPAQUE',
                );
                assert.equal(material.pbrMetallicRoughness.metallicFactor, 0);
            }
            if (name === 'SupportedCobweb') {
                gltf.scene.updateMatrixWorld(true);
                const origin = new Vector3(
                    -0.25 + Math.cos(Math.PI / 16) * 0.43,
                    0.865 - Math.sin(Math.PI / 16) * 0.43,
                    -0.8,
                ).applyAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
                const direction = new Vector3(0, 0, 1).applyAxisAngle(
                    new Vector3(0, 1, 0),
                    Math.PI / 4,
                );
                assert.equal(
                    new Raycaster(origin, direction).intersectObject(
                        gltf.scene,
                        true,
                    ).length,
                    0,
                    'Empty web cells must pass picking rays through to neighboring geometry',
                );
            }
            for (let rotation = 0; rotation < 4; rotation++) {
                gltf.scene.rotation.y = (rotation * Math.PI) / 2;
                gltf.scene.updateMatrixWorld(true);
                const b = new Box3().setFromObject(gltf.scene);
                assert.ok(
                    b.min.x >= -0.45 &&
                        b.max.x <= 0.45 &&
                        b.min.z >= -0.45 &&
                        b.max.z <= 0.45,
                );
                assert.ok(Math.abs(b.min.y) < 0.00001 && b.max.y <= 1);
            }
        });
});
