import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createGardenOverview2DLayout,
    gardenOverview2DMaxRenderedCells,
    getGardenOverview2DGridArea,
    getGardenOverview2DImageRotationSuffix,
    getGardenOverview2DPreviewTrackPadding,
    rotateGardenOverview2DPosition,
} from './gardenOverview2DLayout';

const blockData = [
    {
        attributes: {
            spanDepth: 2,
            spanWidth: 3,
        },
        information: {
            name: 'Shade',
        },
    },
    {
        attributes: {},
        information: {
            name: 'Block_Grass',
        },
    },
];
const blockDataByName = new Map(
    blockData.map((block) => [block.information.name, block]),
);

test('lays out negative garden coordinates with padding and reversible rotation', () => {
    const layout = createGardenOverview2DLayout({
        blockData,
        padding: 1,
        stacks: [
            {
                blocks: [
                    {
                        id: 'ground',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
                position: { x: -2, z: 1 },
            },
            {
                blocks: [
                    {
                        id: 'shade',
                        name: 'Shade',
                        rotation: 0,
                    },
                ],
                position: { x: 1, z: -1 },
            },
        ],
        worldRotation: 1,
    });

    assert.deepEqual(rotateGardenOverview2DPosition({ x: -2, z: 1 }, 1), {
        x: 1,
        z: 2,
    });
    assert.equal(layout.isSparse, false);
    assert.equal(layout.cells.length, layout.columnCount * layout.rowCount);
    assert.ok(
        layout.cells.some((cell) => cell.worldX === -2 && cell.worldZ === 1),
    );
    assert.equal(
        layout.items.find((item) => item.block.id === 'shade')?.gridColumnSpan,
        2,
    );
    assert.equal(
        layout.items.find((item) => item.block.id === 'shade')?.gridRowSpan,
        3,
    );
});

test('computes a preview grid area from the same footprint rules as existing blocks', () => {
    const layout = createGardenOverview2DLayout({
        blockData,
        padding: 2,
        stacks: [],
        worldRotation: 3,
    });
    const area = getGardenOverview2DGridArea({
        block: {
            name: 'Shade',
            rotation: 0,
        },
        blockDataByName,
        position: { x: 0, z: 0 },
        projection: layout.projection,
        worldRotation: 3,
    });

    assert.deepEqual(area, {
        gridColumnSpan: 2,
        gridColumnStart: 2,
        gridRowSpan: 3,
        gridRowStart: 3,
    });
});

test('combines block and world rotation for directional image assets', () => {
    assert.equal(getGardenOverview2DImageRotationSuffix(0, 0), 1);
    assert.equal(getGardenOverview2DImageRotationSuffix(1, 0), 2);
    assert.equal(getGardenOverview2DImageRotationSuffix(3, 1), 1);
    assert.equal(getGardenOverview2DImageRotationSuffix(-1, 0), 4);
});

test('keeps edge previews within explicit non-targetable tracks at every rotation', () => {
    const previewTrackPadding =
        getGardenOverview2DPreviewTrackPadding(blockData);

    assert.equal(previewTrackPadding, 2);

    for (let worldRotation = 0; worldRotation < 4; worldRotation += 1) {
        const layout = createGardenOverview2DLayout({
            blockData,
            padding: 2,
            stacks: [],
            worldRotation,
        });
        const explicitColumnCount =
            layout.columnCount + previewTrackPadding * 2;
        const explicitRowCount = layout.rowCount + previewTrackPadding * 2;
        const renderedCorners = [
            { x: layout.bounds.minX, z: layout.bounds.minZ },
            { x: layout.bounds.maxX, z: layout.bounds.minZ },
            { x: layout.bounds.minX, z: layout.bounds.maxZ },
            { x: layout.bounds.maxX, z: layout.bounds.maxZ },
        ];

        for (const renderedPosition of renderedCorners) {
            const position = rotateGardenOverview2DPosition(
                renderedPosition,
                -worldRotation,
            );
            const area = getGardenOverview2DGridArea({
                block: {
                    name: 'Shade',
                    rotation: 0,
                },
                blockDataByName,
                position,
                projection: layout.projection,
                worldRotation,
            });
            const shiftedColumnStart =
                area.gridColumnStart + previewTrackPadding;
            const shiftedRowStart = area.gridRowStart + previewTrackPadding;

            assert.ok(shiftedColumnStart >= 1);
            assert.ok(shiftedRowStart >= 1);
            assert.ok(
                shiftedColumnStart + area.gridColumnSpan - 1 <=
                    explicitColumnCount,
            );
            assert.ok(
                shiftedRowStart + area.gridRowSpan - 1 <= explicitRowCount,
            );
        }
    }
});

test('compresses sparse coordinates without enumerating the empty rectangle', () => {
    const farPosition = { x: 1_000_000, z: -1_000_000 };
    const layout = createGardenOverview2DLayout({
        blockData,
        padding: 2,
        stacks: [
            {
                blocks: [
                    {
                        id: 'near',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
                position: { x: 0, z: 0 },
            },
            {
                blocks: [
                    {
                        id: 'far',
                        name: 'Shade',
                        rotation: 0,
                    },
                ],
                position: farPosition,
            },
        ],
        worldRotation: 0,
    });

    assert.equal(layout.isSparse, true);
    assert.ok(layout.cells.length <= gardenOverview2DMaxRenderedCells);
    assert.ok(layout.cells.length < 100);
    assert.ok(layout.columnCount < 25);
    assert.ok(layout.rowCount < 25);
    assert.ok(
        layout.cells.some(
            (cell) =>
                cell.worldX === farPosition.x && cell.worldZ === farPosition.z,
        ),
    );
    assert.ok(
        !layout.cells.some(
            (cell) => cell.worldX === 500_000 && cell.worldZ === -500_000,
        ),
    );

    const placementArea = getGardenOverview2DGridArea({
        block: {
            name: 'Shade',
            rotation: 0,
        },
        blockDataByName,
        position: { x: 2, z: 0 },
        projection: layout.projection,
        worldRotation: 0,
    });
    const previewTrackPadding =
        getGardenOverview2DPreviewTrackPadding(blockData);

    assert.equal(placementArea.gridColumnSpan, 3);
    assert.equal(placementArea.gridRowSpan, 2);
    assert.ok(
        placementArea.gridColumnStart +
            previewTrackPadding +
            placementArea.gridColumnSpan -
            1 <=
            layout.columnCount + previewTrackPadding * 2,
    );
    assert.ok(
        placementArea.gridRowStart +
            previewTrackPadding +
            placementArea.gridRowSpan -
            1 <=
            layout.rowCount + previewTrackPadding * 2,
    );
});
