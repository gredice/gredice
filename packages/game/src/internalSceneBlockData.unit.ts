import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getInternalSceneBlockData,
    isInternalSceneBlockData,
    outletDisplayTableBlockName,
    outletDisplayTableHeight,
    outletDisplayTableSunflowerPrice,
    withInternalSceneBlockData,
} from './internalSceneBlockData';

describe('internal scene block data', () => {
    it('defines the outlet table fallback with its catalog metadata and footprint', () => {
        const [table] = getInternalSceneBlockData();

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

    it('adds the internal fallback without mutating directory data', () => {
        const directoryData = getInternalSceneBlockData().map((table) => ({
            ...table,
            id: 42,
            information: {
                ...table.information,
                name: 'ExistingBlock',
            },
        }));
        const merged = withInternalSceneBlockData(directoryData);

        assert.equal(directoryData.length, 1);
        assert.equal(merged.length, 2);
        assert.equal(merged[0], directoryData[0]);
        assert.equal(merged[1]?.information.name, outletDisplayTableBlockName);
    });

    it('lets a future live directory row override the fallback', () => {
        const [fallback] = getInternalSceneBlockData();
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

        assert.equal(merged.length, 1);
        assert.equal(merged[0], liveTable);
        assert.equal(merged[0]?.attributes.height, 0.69);
        assert.equal(isInternalSceneBlockData(liveTable), false);
    });
});
