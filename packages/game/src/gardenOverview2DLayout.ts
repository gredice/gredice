import {
    type GardenBlockDataLike,
    getGardenBlockFootprintOffsets,
    getGardenBlockSpan,
} from '@gredice/js/gardenBlocks';

export type GardenOverview2DBlockData = GardenBlockDataLike & {
    information: {
        name: string;
    };
};

type GardenOverview2DBlock = {
    id: string;
    name: string;
    rotation: number;
};

type GardenOverview2DStack = {
    blocks: readonly GardenOverview2DBlock[];
    position: {
        x: number;
        z: number;
    };
};

export type GardenOverview2DBounds = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

export type GardenOverview2DGridArea = {
    gridColumnSpan: number;
    gridColumnStart: number;
    gridRowSpan: number;
    gridRowStart: number;
};

export type GardenOverview2DLayoutItem = GardenOverview2DGridArea & {
    block: GardenOverview2DBlock;
    blockIndex: number;
    stackIndex: number;
    worldX: number;
    worldZ: number;
};

export type GardenOverview2DLayoutCell = {
    gridColumnStart: number;
    gridRowStart: number;
    worldX: number;
    worldZ: number;
};

type GardenOverview2DAxisProjection = {
    coordinates: readonly number[];
    trackByCoordinate: ReadonlyMap<number, number>;
    trackCount: number;
};

export type GardenOverview2DGridProjection = {
    columns: GardenOverview2DAxisProjection;
    rows: GardenOverview2DAxisProjection;
};

export type GardenOverview2DLayout = {
    bounds: GardenOverview2DBounds;
    cells: GardenOverview2DLayoutCell[];
    columnCount: number;
    isSparse: boolean;
    items: GardenOverview2DLayoutItem[];
    projection: GardenOverview2DGridProjection;
    rowCount: number;
};

type RenderedArea = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

export const gardenOverview2DGridPadding = 2;
export const gardenOverview2DMaxRenderedCells = 2_500;

export function normalizeGardenOverview2DRotation(rotation: number) {
    return ((Math.round(rotation) % 4) + 4) % 4;
}

export function getGardenOverview2DImageRotationSuffix(
    blockRotation: number,
    worldRotation: number,
) {
    return normalizeGardenOverview2DRotation(blockRotation + worldRotation) + 1;
}

export function getGardenOverview2DPreviewTrackPadding(
    blockData: readonly GardenOverview2DBlockData[],
) {
    return blockData.reduce((padding, block) => {
        const span = getGardenBlockSpan(block);

        return Math.max(padding, span.width - 1, span.depth - 1);
    }, 0);
}

export function rotateGardenOverview2DPosition(
    position: { x: number; z: number },
    rotation: number,
) {
    switch (normalizeGardenOverview2DRotation(rotation)) {
        case 1:
            return { x: position.z, z: -position.x };
        case 2:
            return { x: -position.x, z: -position.z };
        case 3:
            return { x: -position.z, z: position.x };
        default:
            return position;
    }
}

function getRenderedArea({
    block,
    blockDataByName,
    position,
    worldRotation,
}: {
    block: Pick<GardenOverview2DBlock, 'name' | 'rotation'>;
    blockDataByName: ReadonlyMap<string, GardenOverview2DBlockData>;
    position: { x: number; z: number };
    worldRotation: number;
}): RenderedArea {
    const blockData = blockDataByName.get(block.name);
    const renderedPositions = getGardenBlockFootprintOffsets(
        blockData,
        block.rotation,
    ).map((offset) =>
        rotateGardenOverview2DPosition(
            {
                x: position.x + offset.x,
                z: position.z + offset.y,
            },
            worldRotation,
        ),
    );
    const xs = renderedPositions.map(({ x }) => x);
    const zs = renderedPositions.map(({ z }) => z);

    return {
        maxX: Math.max(...xs),
        maxZ: Math.max(...zs),
        minX: Math.min(...xs),
        minZ: Math.min(...zs),
    };
}

function createAxisProjection(
    coordinateValues: ReadonlySet<number>,
): GardenOverview2DAxisProjection {
    const coordinates = [...coordinateValues].sort(
        (left, right) => left - right,
    );
    const trackByCoordinate = new Map<number, number>();
    let nextTrack = 1;
    let previousCoordinate: number | undefined;

    for (const coordinate of coordinates) {
        if (
            previousCoordinate !== undefined &&
            coordinate - previousCoordinate > 1
        ) {
            nextTrack += 1;
        }

        trackByCoordinate.set(coordinate, nextTrack);
        nextTrack += 1;
        previousCoordinate = coordinate;
    }

    return {
        coordinates,
        trackByCoordinate,
        trackCount: nextTrack - 1,
    };
}

function getAxisTrack(
    projection: GardenOverview2DAxisProjection,
    coordinate: number,
) {
    const exactTrack = projection.trackByCoordinate.get(coordinate);
    if (exactTrack !== undefined) {
        return exactTrack;
    }

    const firstCoordinate = projection.coordinates[0];
    const lastCoordinate = projection.coordinates.at(-1);
    if (firstCoordinate === undefined || lastCoordinate === undefined) {
        return 1;
    }
    if (coordinate < firstCoordinate) {
        return coordinate - firstCoordinate + 1;
    }
    if (coordinate > lastCoordinate) {
        return projection.trackCount + coordinate - lastCoordinate;
    }

    let lowerIndex = 0;
    let upperIndex = projection.coordinates.length;

    while (lowerIndex < upperIndex) {
        const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
        const middleCoordinate = projection.coordinates[middleIndex];
        if (middleCoordinate !== undefined && middleCoordinate < coordinate) {
            lowerIndex = middleIndex + 1;
        } else {
            upperIndex = middleIndex;
        }
    }

    const nextCoordinate = projection.coordinates[lowerIndex];
    return nextCoordinate === undefined
        ? projection.trackCount
        : (projection.trackByCoordinate.get(nextCoordinate) ?? 2) - 1;
}

function renderedAreaToGridArea(
    area: RenderedArea,
    projection: GardenOverview2DGridProjection,
): GardenOverview2DGridArea {
    const gridColumnStart = getAxisTrack(projection.columns, area.minX);
    const gridColumnEnd = getAxisTrack(projection.columns, area.maxX);
    const gridRowStart = getAxisTrack(projection.rows, area.minZ);
    const gridRowEnd = getAxisTrack(projection.rows, area.maxZ);

    return {
        gridColumnSpan: Math.max(1, gridColumnEnd - gridColumnStart + 1),
        gridColumnStart,
        gridRowSpan: Math.max(1, gridRowEnd - gridRowStart + 1),
        gridRowStart,
    };
}

export function getGardenOverview2DGridArea({
    block,
    blockDataByName,
    position,
    projection,
    worldRotation,
}: {
    block: Pick<GardenOverview2DBlock, 'name' | 'rotation'>;
    blockDataByName: ReadonlyMap<string, GardenOverview2DBlockData>;
    position: { x: number; z: number };
    projection: GardenOverview2DGridProjection;
    worldRotation: number;
}) {
    return renderedAreaToGridArea(
        getRenderedArea({
            block,
            blockDataByName,
            position,
            worldRotation,
        }),
        projection,
    );
}

export function createGardenOverview2DLayout({
    blockData,
    padding = gardenOverview2DGridPadding,
    stacks,
    worldRotation,
}: {
    blockData: readonly GardenOverview2DBlockData[];
    padding?: number;
    stacks: readonly GardenOverview2DStack[];
    worldRotation: number;
}): GardenOverview2DLayout {
    const blockDataByName = new Map(
        blockData.map((candidate) => [candidate.information.name, candidate]),
    );
    const renderedItems: Array<{
        area: RenderedArea;
        block: GardenOverview2DBlock;
        blockIndex: number;
        stackIndex: number;
        worldX: number;
        worldZ: number;
    }> = [];
    const renderedStackPositions: Array<{ x: number; z: number }> = [];
    const renderedStackAreas = stacks.map((stack, stackIndex) => {
        const renderedPosition = rotateGardenOverview2DPosition(
            stack.position,
            worldRotation,
        );
        const stackArea = {
            maxX: renderedPosition.x,
            maxZ: renderedPosition.z,
            minX: renderedPosition.x,
            minZ: renderedPosition.z,
        };
        renderedStackPositions.push(renderedPosition);

        stack.blocks.forEach((block, blockIndex) => {
            const area = getRenderedArea({
                block,
                blockDataByName,
                position: stack.position,
                worldRotation,
            });
            stackArea.maxX = Math.max(stackArea.maxX, area.maxX);
            stackArea.maxZ = Math.max(stackArea.maxZ, area.maxZ);
            stackArea.minX = Math.min(stackArea.minX, area.minX);
            stackArea.minZ = Math.min(stackArea.minZ, area.minZ);
            renderedItems.push({
                area,
                block,
                blockIndex,
                stackIndex,
                worldX: stack.position.x,
                worldZ: stack.position.z,
            });
        });

        return stackArea;
    });
    const allXs = [
        ...renderedStackAreas.flatMap(({ minX, maxX }) => [minX, maxX]),
    ];
    const allZs = [
        ...renderedStackAreas.flatMap(({ minZ, maxZ }) => [minZ, maxZ]),
    ];
    const minX = allXs.length ? Math.min(...allXs) : 0;
    const maxX = allXs.length ? Math.max(...allXs) : 0;
    const minZ = allZs.length ? Math.min(...allZs) : 0;
    const maxZ = allZs.length ? Math.max(...allZs) : 0;
    const normalizedPadding = Math.max(0, Math.round(padding));
    const bounds = {
        maxX: maxX + normalizedPadding,
        maxZ: maxZ + normalizedPadding,
        minX: minX - normalizedPadding,
        minZ: minZ - normalizedPadding,
    };
    const denseColumnCount = bounds.maxX - bounds.minX + 1;
    const denseRowCount = bounds.maxZ - bounds.minZ + 1;
    const renderDenseGrid =
        Number.isSafeInteger(denseColumnCount) &&
        Number.isSafeInteger(denseRowCount) &&
        denseColumnCount > 0 &&
        denseRowCount > 0 &&
        denseColumnCount <= gardenOverview2DMaxRenderedCells &&
        denseRowCount <=
            Math.floor(gardenOverview2DMaxRenderedCells / denseColumnCount);
    const renderedCellByCoordinate = new Map<
        string,
        { x: number; z: number }
    >();
    const addRenderedCell = (x: number, z: number) => {
        if (renderedCellByCoordinate.size >= gardenOverview2DMaxRenderedCells) {
            return;
        }

        renderedCellByCoordinate.set(`${x}:${z}`, { x, z });
    };

    if (renderDenseGrid) {
        for (let gridZ = bounds.minZ; gridZ <= bounds.maxZ; gridZ += 1) {
            for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 1) {
                addRenderedCell(gridX, gridZ);
            }
        }
    } else {
        for (const position of renderedStackPositions) {
            addRenderedCell(position.x, position.z);
        }

        for (const { area } of renderedItems) {
            for (
                let gridZ = area.minZ;
                gridZ <= area.maxZ &&
                renderedCellByCoordinate.size <
                    gardenOverview2DMaxRenderedCells;
                gridZ += 1
            ) {
                for (
                    let gridX = area.minX;
                    gridX <= area.maxX &&
                    renderedCellByCoordinate.size <
                        gardenOverview2DMaxRenderedCells;
                    gridX += 1
                ) {
                    addRenderedCell(gridX, gridZ);
                }
            }
        }

        for (const area of renderedStackAreas) {
            for (
                let gridZ = area.minZ - normalizedPadding;
                gridZ <= area.maxZ + normalizedPadding &&
                renderedCellByCoordinate.size <
                    gardenOverview2DMaxRenderedCells;
                gridZ += 1
            ) {
                for (
                    let gridX = area.minX - normalizedPadding;
                    gridX <= area.maxX + normalizedPadding &&
                    renderedCellByCoordinate.size <
                        gardenOverview2DMaxRenderedCells;
                    gridX += 1
                ) {
                    addRenderedCell(gridX, gridZ);
                }
            }
        }
    }

    const columnCoordinates = new Set<number>();
    const rowCoordinates = new Set<number>();
    for (const { area } of renderedItems) {
        for (let gridX = area.minX; gridX <= area.maxX; gridX += 1) {
            columnCoordinates.add(gridX);
        }
        for (let gridZ = area.minZ; gridZ <= area.maxZ; gridZ += 1) {
            rowCoordinates.add(gridZ);
        }
    }
    for (const position of renderedStackPositions) {
        columnCoordinates.add(position.x);
        rowCoordinates.add(position.z);
    }

    const previewTrackPadding =
        getGardenOverview2DPreviewTrackPadding(blockData);
    for (const { x, z } of renderedCellByCoordinate.values()) {
        for (
            let offset = -previewTrackPadding;
            offset <= previewTrackPadding;
            offset += 1
        ) {
            const bufferedX = x + offset;
            const bufferedZ = z + offset;
            if (bufferedX >= bounds.minX && bufferedX <= bounds.maxX) {
                columnCoordinates.add(bufferedX);
            }
            if (bufferedZ >= bounds.minZ && bufferedZ <= bounds.maxZ) {
                rowCoordinates.add(bufferedZ);
            }
        }
        columnCoordinates.add(x);
        rowCoordinates.add(z);
    }

    const projection = {
        columns: createAxisProjection(columnCoordinates),
        rows: createAxisProjection(rowCoordinates),
    };
    const cells = [...renderedCellByCoordinate.values()].map(({ x, z }) => {
        const worldPosition = rotateGardenOverview2DPosition(
            { x, z },
            -worldRotation,
        );

        return {
            gridColumnStart: getAxisTrack(projection.columns, x),
            gridRowStart: getAxisTrack(projection.rows, z),
            worldX: worldPosition.x,
            worldZ: worldPosition.z,
        };
    });

    return {
        bounds,
        cells,
        columnCount: projection.columns.trackCount,
        isSparse: !renderDenseGrid,
        items: renderedItems.map(({ area, ...item }) => ({
            ...item,
            ...renderedAreaToGridArea(area, projection),
        })),
        projection,
        rowCount: projection.rows.trackCount,
    };
}
