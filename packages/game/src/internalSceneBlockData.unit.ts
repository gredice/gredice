import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    doubleGardenLightPoleBlockName,
    doubleGardenLightPoleHeight,
    enamelGardenLampBlockName,
    enamelGardenLampHeight,
    getInternalSceneBlockData,
    isInternalSceneBlockData,
    outletDisplayTableBlockName,
    outletDisplayTableHeight,
    outletDisplayTableSunflowerPrice,
    withInternalSceneBlockData,
} from './internalSceneBlockData';

describe('internal scene block data', () => {
    it('defines the outlet table fallback with its catalog metadata and footprint', () => {
        const table = getInternalSceneBlockData().find(
            (block) => block.information.name === outletDisplayTableBlockName,
        );

        assert.ok(table);
        assert.equal(table.information.name, outletDisplayTableBlockName);
        assert.equal(table.attributes.height, outletDisplayTableHeight);
        assert.equal(table.attributes.hitboxDepth, 0.75);
        assert.equal(table.attributes.hitboxHeight, outletDisplayTableHeight);
        assert.equal(table.attributes.hitboxWidth, 0.9);
        assert.equal(table.attributes.spanDepth, 1);
        assert.equal(table.attributes.spanWidth, 1);
        assert.equal(table.attributes.stackable, true);
        assert.equal(table.information.label, 'Drveni izložbeni stol');
        assert.equal(table.prices.sunflowers, outletDisplayTableSunflowerPrice);
        assert.equal(isInternalSceneBlockData(table), true);
    });

    it('defines a private metadata fallback for the Outlet night lamp', () => {
        const lamp = getInternalSceneBlockData().find(
            (block) => block.information.name === enamelGardenLampBlockName,
        );

        assert.ok(lamp);
        assert.equal(lamp.attributes.height, enamelGardenLampHeight);
        assert.equal(lamp.attributes.hitboxDepth, 0.46);
        assert.equal(lamp.attributes.hitboxHeight, enamelGardenLampHeight);
        assert.equal(lamp.attributes.hitboxWidth, 0.52);
        assert.equal(lamp.attributes.spanDepth, 1);
        assert.equal(lamp.attributes.spanWidth, 1);
        assert.equal(lamp.attributes.stackable, false);
        assert.equal(isInternalSceneBlockData(lamp), true);
    });

    it('defines a private metadata fallback for the double Outlet light pole', () => {
        const pole = getInternalSceneBlockData().find(
            (block) =>
                block.information.name === doubleGardenLightPoleBlockName,
        );

        assert.ok(pole);
        assert.equal(pole.attributes.height, doubleGardenLightPoleHeight);
        assert.equal(pole.attributes.hitboxDepth, 0.38);
        assert.equal(pole.attributes.hitboxHeight, doubleGardenLightPoleHeight);
        assert.equal(pole.attributes.hitboxWidth, 0.94);
        assert.equal(pole.attributes.spanDepth, 1);
        assert.equal(pole.attributes.spanWidth, 1);
        assert.equal(pole.attributes.stackable, false);
        assert.equal(isInternalSceneBlockData(pole), true);
    });

    it('adds the internal fallback without mutating directory data', () => {
        const directoryData = getInternalSceneBlockData().map((block) => ({
            ...block,
            id: 42,
            information: {
                ...block.information,
                name: `ExistingBlock-${block.information.name}`,
            },
        }));
        const merged = withInternalSceneBlockData(directoryData);

        assert.equal(directoryData.length, 3);
        assert.equal(merged.length, 6);
        assert.equal(merged[0], directoryData[0]);
        assert.deepEqual(
            merged
                .slice(directoryData.length)
                .map((block) => block.information.name),
            [
                outletDisplayTableBlockName,
                enamelGardenLampBlockName,
                doubleGardenLightPoleBlockName,
            ],
        );
    });

    it('lets a future live directory row override the fallback', () => {
        const fallback = getInternalSceneBlockData().find(
            (block) => block.information.name === outletDisplayTableBlockName,
        );
        assert.ok(fallback);
        const liveTable = {
            ...fallback,
            id: 73,
            attributes: {
                ...fallback.attributes,
                height: 0.69,
            },
        };
        const merged = withInternalSceneBlockData([liveTable]);

        assert.equal(merged.length, 3);
        assert.equal(merged[0], liveTable);
        assert.equal(merged[0]?.attributes.height, 0.69);
        assert.equal(isInternalSceneBlockData(liveTable), false);
        assert.equal(merged[1]?.information.name, enamelGardenLampBlockName);
    });
});
