import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { harvestPumpkins } from '@gredice/js/harvestPumpkins';
import { Vector3 } from 'three';
import { gameAssetModels } from '../../data/models';
import type { Stack } from '../../types/Stack';
import {
    blockAssetRequirements,
    collectGardenBlockNames,
    createGardenSceneManifest,
    faunaFamilyRequirements,
    mergeGardenSceneLoadPlan,
    mergeGardenSceneShaderVariants,
} from './gardenSceneManifest';

function stack(x: number, ...names: string[]): Stack {
    return {
        position: new Vector3(x, 0, 0),
        blocks: names.map((name, index) => ({
            id: `${x}:${index}`,
            name,
            rotation: 0,
        })),
    };
}

function assetNames(
    manifest: ReturnType<typeof createGardenSceneManifest>,
): string[] {
    return manifest.assets.map((asset) => asset.name);
}

describe('garden scene manifest', () => {
    it('resolves every fixed harvest pumpkin identity to its authored model', () => {
        assert.equal(harvestPumpkins.length, 9);
        for (const pumpkin of harvestPumpkins) {
            const manifest = createGardenSceneManifest({
                blockNames: [pumpkin.name],
            });

            assert.deepEqual(manifest.unknownBlockNames, [], pumpkin.name);
            assert.deepEqual(
                manifest.assets,
                [{ name: pumpkin.asset, priority: 'current' }],
                pumpkin.name,
            );
            assert.deepEqual(manifest.shaderVariants, [], pumpkin.name);
        }
    });

    it('deduplicates pumpkin colors and repeated blocks to exactly three models', () => {
        const manifest = createGardenSceneManifest({
            blockNames: collectGardenBlockNames(
                harvestPumpkins.flatMap((pumpkin, index) => [
                    stack(index, pumpkin.name, pumpkin.name),
                ]),
            ),
        });

        assert.deepEqual(manifest.unknownBlockNames, []);
        assert.deepEqual(assetNames(manifest), [
            'HarvestPumpkinGourd',
            'HarvestPumpkinGroup',
            'HarvestPumpkinSquat',
        ]);
    });

    it('declares only generated game assets', () => {
        const knownAssets = new Set(Object.keys(gameAssetModels));
        for (const [blockName, requirement] of Object.entries(
            blockAssetRequirements,
        )) {
            for (const asset of [
                ...requirement.assets,
                ...(requirement.optionalAssets ?? []),
            ]) {
                assert.ok(knownAssets.has(asset), `${blockName} -> ${asset}`);
            }
        }
        for (const requirement of faunaFamilyRequirements) {
            assert.ok(knownAssets.has(requirement.asset), requirement.family);
            for (const habitat of requirement.habitats) {
                assert.ok(
                    Object.hasOwn(blockAssetRequirements, habitat),
                    `${requirement.family} habitat ${habitat}`,
                );
            }
        }
    });

    it('loads nothing for an empty garden', () => {
        const manifest = createGardenSceneManifest({
            blockNames: collectGardenBlockNames([]),
        });

        assert.deepEqual(manifest.assets, []);
        assert.deepEqual(manifest.families, []);
        assert.deepEqual(manifest.shaderVariants, []);
    });

    it('requests only the terrain a minimal garden renders', () => {
        const manifest = createGardenSceneManifest({
            blockNames: collectGardenBlockNames([
                stack(0, 'Block_Ground'),
                stack(1, 'Block_Ground'),
            ]),
        });

        assert.deepEqual(manifest.assets, [
            { name: 'BlockGround', priority: 'current' },
        ]);
        assert.deepEqual(manifest.families, []);
    });

    it('does not fetch absent specialized fauna families', () => {
        const manifest = createGardenSceneManifest({
            blockNames: ['Block_Ground', 'Raised_Bed'],
        });
        const names = assetNames(manifest);

        for (const absent of ['Cat', 'Dog', 'Chicken', 'Frog', 'Horse']) {
            assert.equal(names.includes(absent), false, absent);
        }
        assert.ok(manifest.families.includes('fauna:bees'));
        assert.deepEqual(manifest.shaderVariants, ['generated-plants']);
    });

    it('demotes optional states and fauna to idle work', () => {
        const manifest = createGardenSceneManifest({
            blockNames: ['Raised_Bed', 'DogHouse'],
        });

        assert.deepEqual(
            manifest.assets.map((asset) => `${asset.priority}:${asset.name}`),
            [
                'current:DogHouse',
                'current:RaisedBed',
                'current:Seed',
                'idle:Bee',
                'idle:Butterfly',
                'idle:Dog',
                'idle:HarvestBasket',
                'idle:Ladybug',
                'idle:Slug',
            ],
        );
    });

    it('skips fauna when details are not rendered', () => {
        const manifest = createGardenSceneManifest({
            blockNames: ['Tree', 'DogHouse'],
            details: false,
        });

        assert.deepEqual(manifest.families, []);
        assert.deepEqual(assetNames(manifest), ['DogHouse', 'Tree']);
    });

    it('produces stable keys independent of block order', () => {
        const left = createGardenSceneManifest({
            blockNames: ['Tree', 'Block_Grass', 'Fence'],
        });
        const right = createGardenSceneManifest({
            blockNames: ['Fence', 'Tree', 'Block_Grass', 'Tree'],
        });

        assert.equal(left.key, right.key);
        assert.notEqual(
            left.key,
            createGardenSceneManifest({ blockNames: ['Tree'] }).key,
        );
    });

    it('reports blocks without a renderer', () => {
        const manifest = createGardenSceneManifest({
            blockNames: ['Block_Ground', 'RetiredBlock'],
        });

        assert.deepEqual(manifest.unknownBlockNames, ['RetiredBlock']);
    });

    it('orders transition-next after current and pins both sides', () => {
        const current = createGardenSceneManifest({
            blockNames: ['Block_Ground', 'Tree'],
            gardenId: 1,
        });
        const next = createGardenSceneManifest({
            blockNames: ['Block_Ground', 'Block_Sand', 'DogHouse'],
            gardenId: 2,
            priority: 'transition-next',
        });

        assert.deepEqual(
            mergeGardenSceneLoadPlan(current, next).map(
                (entry) =>
                    `${entry.priority}:${entry.name}:${entry.pinned ? 'pin' : 'free'}`,
            ),
            [
                'current:BlockGround:pin',
                'current:Tree:pin',
                'transition-next:BlockSand:pin',
                'transition-next:DogHouse:pin',
                'idle:Bat:free',
                'idle:BirdSmall:free',
                'idle:Dog:free',
                'idle:Slug:free',
                'idle:Squirrel:free',
            ],
        );
    });

    it('merges shader variants from both scenes', () => {
        const variants = mergeGardenSceneShaderVariants(
            createGardenSceneManifest({ blockNames: ['Block_Water'] }),
            null,
            createGardenSceneManifest({ blockNames: ['Raised_Bed'] }),
        );

        assert.deepEqual([...variants].sort(), [
            'generated-plants',
            'water-surface',
        ]);
    });
});
