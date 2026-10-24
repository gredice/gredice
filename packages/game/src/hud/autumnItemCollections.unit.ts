import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import { chestnutRoastingCart } from '@gredice/js/chestnutRoastingCart';
import { harvestPumpkinNames } from '@gredice/js/harvestPumpkins';
import { pumpkinLanternNames } from '@gredice/js/pumpkinLanterns';
import { gameAssetModels } from '../data/gameAssetModels.generated';
import { getInternalSceneBlockData } from '../internalSceneBlockData';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import {
    autumnItemCollections,
    getAutumnItemCollections,
} from './autumnItemCollections';
import { getHudEntityPlacementAvailability } from './itemPlacementAvailability';

const blocks = getLocalSandboxBlockData();
function block(name: string, sunflowers = 40): BlockData {
    const source =
        blocks.find((block) => block.information.name === name) ??
        blocks.find((block) => block.information.name === 'WoodenSign');
    assert.ok(source, `Missing supported model ${name}`);
    return {
        ...source,
        information: { ...source.information, name },
        prices: { sunflowers },
    };
}

describe('autumn item collections', () => {
    it('has no offers while the published catalogue is loading, empty or failed', () => {
        for (const blockData of [undefined, null, []]) {
            assert.deepEqual(
                getAutumnItemCollections({ blockData, isSandbox: false }),
                [],
            );
        }
    });

    it('curates distinct supported identities without duplicate entries', () => {
        const supportedNames = new Set([
            ...blocks.map((block) => block.information.name),
            ...Object.keys(gameAssetModels),
        ]);
        assert.equal(
            new Set(autumnItemCollections.map((item) => item.id)).size,
            6,
        );
        for (const collection of autumnItemCollections) {
            assert.equal(
                new Set(collection.entityNames).size,
                collection.entityNames.length,
            );
            for (const name of collection.entityNames) {
                assert.ok(
                    supportedNames.has(name),
                    `${collection.id}: ${name}`,
                );
            }
            for (const name of collection.activationEntityNames ?? []) {
                assert.ok(
                    collection.entityNames.some(
                        (entityName) => entityName === name,
                    ),
                );
            }
        }
    });

    it('offers existing props before new catalogue publication without premature event groups', () => {
        const visible = getAutumnItemCollections({
            blockData: [
                block('BaleHey'),
                block('Tree'),
                block('WoodenBench'),
                block('PotLowBowl'),
                block('WickerGardenLantern'),
            ],
            isSandbox: false,
        });
        assert.deepEqual(
            visible.map((item) => item.label),
            ['Jesenska berba', 'Šumski kutak', 'Topla večer', 'Jesenski vrt'],
        );
        assert.deepEqual(visible[0].entityNames, [
            'BaleHey',
            'WickerGardenLantern',
        ]);
        assert.equal(
            visible.some((item) =>
                item.entityNames.includes(harvestPumpkinNames[0]),
            ),
            false,
        );
    });

    it('excludes rendering fallbacks and non-sale prices without mutating catalogue data', () => {
        const blockData = [
            ...getInternalSceneBlockData(),
            block('BaleHey', 0),
            block('Tree', -1),
            block('WoodenBench', Number.NaN),
            block('PotLowBowl', Number.POSITIVE_INFINITY),
            block(harvestPumpkinNames[0], 35),
        ];
        const snapshot = structuredClone(blockData);
        const visible = getAutumnItemCollections({
            blockData,
            isSandbox: false,
        });
        assert.deepEqual(
            visible.map((item) => item.entityNames),
            [[harvestPumpkinNames[0]]],
        );
        assert.deepEqual(blockData, snapshot);
        assert.deepEqual(
            getAutumnItemCollections({
                blockData: blockData.slice(0, -1),
                isSandbox: false,
            }),
            [],
        );
    });

    it('introduces events only with their available defining decorations, preserving exact variants', () => {
        const blockData = [
            block(chestnutRoastingCart.name),
            block(pumpkinLanternNames[1]),
            block('WoodenSign'),
        ];
        const visible = getAutumnItemCollections({
            blockData,
            isSandbox: false,
        });
        assert.deepEqual(
            visible.find((item) => item.id === 'chestnuts')?.entityNames,
            [chestnutRoastingCart.name, 'WoodenSign'],
        );
        assert.deepEqual(
            visible.find((item) => item.id === 'pumpkin-night')?.entityNames,
            [pumpkinLanternNames[1], 'WoodenSign'],
        );
        const later = getAutumnItemCollections({
            blockData: [block('WoodenSign')],
            isSandbox: false,
        });
        assert.equal(
            later.some(
                (item) =>
                    item.id === 'chestnuts' || item.id === 'pumpkin-night',
            ),
            false,
        );
    });

    it('preserves normal night-only and insufficient-balance availability on individual offers', () => {
        const firefly = {
            ...block('FireflyJar', 100),
            attributes: {
                ...block('FireflyJar').attributes,
                nightOnlyPurchase: true,
            },
        };
        const visible = getAutumnItemCollections({
            blockData: [firefly],
            isSandbox: false,
        });
        assert.deepEqual(
            visible.map((item) => item.entityNames),
            [['FireflyJar']],
        );
        const availability = getHudEntityPlacementAvailability({
            block: firefly,
            isSandbox: false,
            isAccountLoading: false,
            accountSunflowers: 20,
            timeOfDay: 0.5,
        });
        assert.equal(availability.canPlace, false);
        assert.equal(availability.sunflowerPrice, 100);
        assert.equal(availability.availabilityMessage, 'Dostupno samo noću.');
        assert.equal(
            availability.insufficientSunflowersMessage,
            'Nedovoljno suncokreta.',
        );
    });

    it('allows sandbox previews without opening fallback rows to sale', () => {
        const blockData = [
            ...getInternalSceneBlockData(),
            block('WoodenBench', 0),
        ];
        assert.deepEqual(
            getAutumnItemCollections({ blockData, isSandbox: false }),
            [],
        );
        assert.deepEqual(
            getAutumnItemCollections({ blockData, isSandbox: true }).map(
                (item) => item.entityNames,
            ),
            [['WoodenBench']],
        );
    });
});
