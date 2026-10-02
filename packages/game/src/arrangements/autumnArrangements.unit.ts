import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import {
    autumnArrangements,
    getAutumnArrangementItems,
    getAutumnArrangementLayout,
    getAutumnArrangementPreviewUrl,
    getAvailableAutumnArrangements,
} from './autumnArrangements';

const blockData = getLocalSandboxBlockData();

for (const arrangement of autumnArrangements) {
    test(`${arrangement.id}: supported 2×3 corner, unique occupied cells and clear approach`, () => {
        const layout = getAutumnArrangementLayout(arrangement, blockData);
        assert.deepEqual(layout.garden, {
            x: 0,
            z: 0,
            width: 4,
            depth: 4,
            occupiedCells: 16,
        });
        assert.equal(layout.decoration.width, 2);
        assert.equal(layout.decoration.depth, 3);
        assert.ok(layout.decoration.occupiedCells <= 6);
        const occupied = new Set<string>();
        for (const placement of layout.placements.filter(
            (item) => item.entityName !== 'Block_Grass',
        )) {
            for (const { x, z } of placement.cells) {
                assert.ok(x >= 0 && z >= 0 && x < 4 && z < 4);
                assert.ok(!occupied.has(`${x}:${z}`), `Overlap at ${x}:${z}`);
                occupied.add(`${x}:${z}`);
                assert.ok(
                    arrangement.placements.some(
                        (support) =>
                            support.entityName === 'Block_Grass' &&
                            support.x === x &&
                            support.z === z,
                    ),
                );
            }
        }
        // Connected south entry to the corner; stepping stones are walkable scenery.
        for (const { x, z } of [
            { x: 2, z: 0 },
            { x: 2, z: 1 },
            { x: 2, z: 2 },
            { x: 1, z: 1 },
        ]) {
            assert.ok(
                !layout.placements
                    .filter((item) => item.role === 'included')
                    .some((item) =>
                        item.cells.some((cell) => cell.x === x && cell.z === z),
                    ) ||
                    (arrangement.id === 'evening-seat' && x === 1 && z === 1),
            );
        }
        const openApproach =
            arrangement.id === 'evening-seat' ? { x: 1, z: 2 } : { x: 1, z: 1 };
        assert.ok(!occupied.has(`${openApproach.x}:${openApproach.z}`));
        assert.equal(
            new Set(arrangement.placements.map((placement) => placement.id))
                .size,
            arrangement.placements.length,
        );
        assert.equal(
            getAutumnArrangementItems(arrangement, 'included').reduce(
                (sum, item) => sum + item.quantity,
                0,
            ),
            4,
        );
        assert.deepEqual(getAutumnArrangementItems(arrangement, 'scenery'), [
            { entityName: 'Block_Grass', quantity: 16 },
            { entityName: 'Tree', quantity: 1 },
            { entityName: 'Pine', quantity: 1 },
            { entityName: 'StoneWalkway', quantity: 3 },
        ]);
    });
}

test('references stay hidden until every pictured identity is present in published data', () => {
    assert.deepEqual(
        getAvailableAutumnArrangements({ blockData: undefined }),
        [],
    );
    assert.deepEqual(getAvailableAutumnArrangements({ blockData }), []);
    assert.equal(
        getAvailableAutumnArrangements({ blockData, isSandbox: true }).length,
        3,
    );
    const published = blockData.map((block, index) => ({
        ...block,
        id: index + 1,
        prices: { ...block.prices, sunflowers: 10 },
    }));
    assert.equal(
        getAvailableAutumnArrangements({ blockData: published }).length,
        3,
    );
    for (const arrangement of autumnArrangements) {
        for (const placement of arrangement.placements) {
            const missing = published.filter(
                (block) => block.information.name !== placement.entityName,
            );
            assert.ok(
                !getAvailableAutumnArrangements({ blockData: missing }).some(
                    (entry) => entry.id === arrangement.id,
                ),
            );
        }
    }
});

test('unknown catalogue spans fail instead of inventing one-cell support', () => {
    for (const arrangement of autumnArrangements)
        assert.throws(
            () => getAutumnArrangementLayout(arrangement, []),
            /Missing arrangement block/,
        );
});

test('withdrawn prices and changed multi-cell spans hide stale previews', () => {
    const published = blockData.map((block, index) => ({
        ...block,
        id: index + 1,
        prices: { ...block.prices, sunflowers: 10 },
    }));
    for (const price of [0, -1, Number.NaN]) {
        const withdrawn = published.map((block) =>
            block.information.name === 'GardenTeaTable'
                ? { ...block, prices: { ...block.prices, sunflowers: price } }
                : block,
        );
        assert.ok(
            !getAvailableAutumnArrangements({ blockData: withdrawn }).some(
                (entry) => entry.id === 'evening-seat',
            ),
        );
    }
    const resized = published.map((block) =>
        block.information.name === 'FallenLog'
            ? { ...block, attributes: { ...block.attributes, spanWidth: 1 } }
            : block,
    );
    assert.ok(
        !getAvailableAutumnArrangements({ blockData: resized }).some(
            (entry) => entry.id === 'woodland-path',
        ),
    );
});

test('preview URLs use the consumer game asset host', () => {
    for (const arrangement of autumnArrangements) {
        assert.equal(
            getAutumnArrangementPreviewUrl(arrangement, ''),
            arrangement.preview,
        );
        assert.equal(
            getAutumnArrangementPreviewUrl(
                arrangement,
                'https://vrt.gredice.com/',
            ),
            `https://vrt.gredice.com${arrangement.preview}`,
        );
    }
});
