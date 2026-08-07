import type { RaisedBedOrientation } from '../../utils/raisedBedOrientation';
import { getRaisedBedFieldSurfacePosition } from './raisedBedSoilWetPatches';

export const raisedBedFieldVisualChunkSize = 8;

const fieldCoverSize = 0.25;
const fieldCoverHalfSize = fieldCoverSize / 2;
const wholeCoverPadding = 0.02;
const wholeCoverHemThickness = 0.018;
const weedFieldScatterRadius = 0.082;
const weedBladeCount = {
    heavy: 10,
    light: 5,
} as const;

export type RaisedBedFieldVisualVector3 = readonly [
    x: number,
    y: number,
    z: number,
];

export type RaisedBedFieldVisualTransform = {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
};

export type RaisedBedFieldVisualBlock = {
    blockIndex: number;
    position: RaisedBedFieldVisualVector3;
};

export type RaisedBedFieldWeedLevel = keyof typeof weedBladeCount;

export type RaisedBedCoverPrimitive = {
    geometry: 'box' | 'plane';
    key: string;
    layer: 'cover-bar' | 'cover-hem' | 'cover-surface';
    renderOrder: 4 | 5 | 6;
    transform: RaisedBedFieldVisualTransform;
};

export type RaisedBedSupportDescriptor = {
    key: string;
    layer: 'support';
    renderOrder: 8;
    transform: RaisedBedFieldVisualTransform;
};

export type RaisedBedSeedDescriptor = {
    key: string;
    layer: 'seed-pending' | 'seed-sown';
    transform: RaisedBedFieldVisualTransform;
};

export function getRaisedBedFieldLocalPosition({
    blockIndex,
    orientation,
    positionIndex,
    y,
}: {
    blockIndex: number;
    orientation: RaisedBedOrientation;
    positionIndex: number;
    y: number;
}) {
    return getRaisedBedFieldSurfacePosition({
        blockIndex,
        orientation,
        positionIndex,
        y,
    });
}

export function getRaisedBedFieldWorldPosition({
    blockIndex,
    blockPosition,
    orientation,
    positionIndex,
    y,
}: {
    blockIndex: number;
    blockPosition: RaisedBedFieldVisualVector3;
    orientation: RaisedBedOrientation;
    positionIndex: number;
    y: number;
}) {
    const localPosition = getRaisedBedFieldLocalPosition({
        blockIndex,
        orientation,
        positionIndex,
        y,
    });

    return [
        blockPosition[0] + localPosition[0],
        blockPosition[1] + localPosition[1],
        blockPosition[2] + localPosition[2],
    ] satisfies [number, number, number];
}

/**
 * Assign all visual layers for a raised bed to one spatial owner. Using the
 * X/Z bounds centroid, rather than each field position, keeps a connected bed
 * in one chunk even when it straddles a chunk boundary.
 */
export function getRaisedBedFieldVisualChunkKey({
    chunkSize = raisedBedFieldVisualChunkSize,
    positions,
}: {
    chunkSize?: number;
    positions: readonly RaisedBedFieldVisualVector3[];
}) {
    if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
        throw new RangeError(
            'Raised-bed field visual chunk size must be positive.',
        );
    }
    if (positions.length === 0) {
        return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const position of positions) {
        if (!Number.isFinite(position[0]) || !Number.isFinite(position[2])) {
            throw new RangeError(
                'Raised-bed field visual positions must contain finite X/Z values.',
            );
        }
        minX = Math.min(minX, position[0]);
        maxX = Math.max(maxX, position[0]);
        minZ = Math.min(minZ, position[2]);
        maxZ = Math.max(maxZ, position[2]);
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    return `${Math.floor(centerX / chunkSize)}:${Math.floor(
        centerZ / chunkSize,
    )}`;
}

function seededWeedRandom(
    positionIndex: number,
    bladeIndex: number,
    channel: number,
) {
    const value = Math.sin(
        (positionIndex + 1) * 12.9898 +
            (bladeIndex + 1) * 78.233 +
            channel * 37.719,
    );
    const scaledValue = value * 43758.5453;

    return scaledValue - Math.floor(scaledValue);
}

function weedRange(
    positionIndex: number,
    bladeIndex: number,
    channel: number,
    min: number,
    max: number,
) {
    return (
        min + seededWeedRandom(positionIndex, bladeIndex, channel) * (max - min)
    );
}

/**
 * Produces matrices for a unit, four-sided cone. Scaling the unit cone by the
 * returned radius/height/radius exactly matches the legacy per-blade geometry.
 */
export function createRaisedBedFieldWeedTransforms({
    blockIndex,
    blockPosition,
    level,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    blockPosition: RaisedBedFieldVisualVector3;
    level: RaisedBedFieldWeedLevel;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const fieldPosition = getRaisedBedFieldWorldPosition({
        blockIndex,
        blockPosition,
        orientation,
        positionIndex,
        y: -0.72,
    });
    const seedPositionIndex = blockIndex * 9 + positionIndex;

    return Array.from(
        { length: weedBladeCount[level] },
        (_, bladeIndex): RaisedBedFieldVisualTransform => {
            const height =
                level === 'heavy'
                    ? weedRange(seedPositionIndex, bladeIndex, 0, 0.052, 0.085)
                    : weedRange(seedPositionIndex, bladeIndex, 0, 0.038, 0.062);
            const radius =
                level === 'heavy'
                    ? weedRange(seedPositionIndex, bladeIndex, 1, 0.005, 0.008)
                    : weedRange(seedPositionIndex, bladeIndex, 1, 0.004, 0.006);
            const x = weedRange(
                seedPositionIndex,
                bladeIndex,
                2,
                -weedFieldScatterRadius,
                weedFieldScatterRadius,
            );
            const z = weedRange(
                seedPositionIndex,
                bladeIndex,
                3,
                -weedFieldScatterRadius,
                weedFieldScatterRadius,
            );

            return {
                position: [
                    fieldPosition[0] + x,
                    fieldPosition[1] + height / 2,
                    fieldPosition[2] + z,
                ],
                rotation: [
                    weedRange(seedPositionIndex, bladeIndex, 4, -0.18, 0.18),
                    weedRange(seedPositionIndex, bladeIndex, 6, 0, Math.PI * 2),
                    weedRange(seedPositionIndex, bladeIndex, 5, -0.18, 0.18),
                ],
                scale: [radius, height, radius],
            };
        },
    );
}

function coverPrimitive({
    geometry,
    key,
    layer,
    position,
    renderOrder,
    rotation = [0, 0, 0],
    scale,
}: {
    geometry: RaisedBedCoverPrimitive['geometry'];
    key: string;
    layer: RaisedBedCoverPrimitive['layer'];
    position: [number, number, number];
    renderOrder: RaisedBedCoverPrimitive['renderOrder'];
    rotation?: [number, number, number];
    scale: [number, number, number];
}): RaisedBedCoverPrimitive {
    return {
        geometry,
        key,
        layer,
        renderOrder,
        transform: {
            position,
            rotation,
            scale,
        },
    };
}

export function createRaisedBedFieldCoverPrimitives({
    blockIndex,
    blockPosition,
    keyPrefix,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    blockPosition: RaisedBedFieldVisualVector3;
    keyPrefix: string;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const center = getRaisedBedFieldWorldPosition({
        blockIndex,
        blockPosition,
        orientation,
        positionIndex,
        y: -0.704,
    });

    return [
        coverPrimitive({
            geometry: 'plane',
            key: `${keyPrefix}:surface`,
            layer: 'cover-surface',
            position: [center[0], center[1] + 0.004, center[2]],
            renderOrder: 4,
            rotation: [-Math.PI / 2, 0, 0],
            scale: [fieldCoverSize, fieldCoverSize, 1],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:hem:north`,
            layer: 'cover-hem',
            position: [center[0], center[1] + 0.012, center[2] - 0.118],
            renderOrder: 5,
            scale: [0.255, 0.008, 0.012],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:hem:south`,
            layer: 'cover-hem',
            position: [center[0], center[1] + 0.012, center[2] + 0.118],
            renderOrder: 5,
            scale: [0.255, 0.008, 0.012],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:hem:east`,
            layer: 'cover-hem',
            position: [center[0] - 0.118, center[1] + 0.012, center[2]],
            renderOrder: 5,
            scale: [0.012, 0.008, 0.255],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:hem:west`,
            layer: 'cover-hem',
            position: [center[0] + 0.118, center[1] + 0.012, center[2]],
            renderOrder: 5,
            scale: [0.012, 0.008, 0.255],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:bar:x`,
            layer: 'cover-bar',
            position: [center[0], center[1] + 0.014, center[2]],
            renderOrder: 6,
            scale: [0.22, 0.006, 0.008],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:bar:z`,
            layer: 'cover-bar',
            position: [center[0], center[1] + 0.015, center[2]],
            renderOrder: 6,
            scale: [0.008, 0.006, 0.22],
        }),
    ] satisfies RaisedBedCoverPrimitive[];
}

export function createRaisedBedWholeCoverPrimitives({
    blocks,
    keyPrefix,
    orientation,
}: {
    blocks: readonly RaisedBedFieldVisualBlock[];
    keyPrefix: string;
    orientation: RaisedBedOrientation;
}) {
    if (blocks.length === 0) {
        return [] as RaisedBedCoverPrimitive[];
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const block of blocks) {
        for (let positionIndex = 0; positionIndex < 9; positionIndex += 1) {
            const center = getRaisedBedFieldWorldPosition({
                blockIndex: block.blockIndex,
                blockPosition: block.position,
                orientation,
                positionIndex,
                y: 0,
            });
            minX = Math.min(minX, center[0] - fieldCoverHalfSize);
            maxX = Math.max(maxX, center[0] + fieldCoverHalfSize);
            minZ = Math.min(minZ, center[2] - fieldCoverHalfSize);
            maxZ = Math.max(maxZ, center[2] + fieldCoverHalfSize);
        }
    }

    minX -= wholeCoverPadding;
    maxX += wholeCoverPadding;
    minZ -= wholeCoverPadding;
    maxZ += wholeCoverPadding;

    const owner = blocks.find((block) => block.blockIndex === 0) ?? blocks[0];
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const center: [number, number, number] = [
        (minX + maxX) / 2,
        owner.position[1] - 0.704,
        (minZ + maxZ) / 2,
    ];

    return [
        coverPrimitive({
            geometry: 'plane',
            key: `${keyPrefix}:surface`,
            layer: 'cover-surface',
            position: [center[0], center[1] + 0.004, center[2]],
            renderOrder: 4,
            rotation: [-Math.PI / 2, 0, 0],
            scale: [width, depth, 1],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:hem:north`,
            layer: 'cover-hem',
            position: [center[0], center[1] + 0.012, center[2] - halfDepth],
            renderOrder: 5,
            scale: [
                width + wholeCoverHemThickness,
                0.008,
                wholeCoverHemThickness,
            ],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:hem:south`,
            layer: 'cover-hem',
            position: [center[0], center[1] + 0.012, center[2] + halfDepth],
            renderOrder: 5,
            scale: [
                width + wholeCoverHemThickness,
                0.008,
                wholeCoverHemThickness,
            ],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:hem:east`,
            layer: 'cover-hem',
            position: [center[0] - halfWidth, center[1] + 0.012, center[2]],
            renderOrder: 5,
            scale: [
                wholeCoverHemThickness,
                0.008,
                depth + wholeCoverHemThickness,
            ],
        }),
        coverPrimitive({
            geometry: 'box',
            key: `${keyPrefix}:hem:west`,
            layer: 'cover-hem',
            position: [center[0] + halfWidth, center[1] + 0.012, center[2]],
            renderOrder: 5,
            scale: [
                wholeCoverHemThickness,
                0.008,
                depth + wholeCoverHemThickness,
            ],
        }),
    ] satisfies RaisedBedCoverPrimitive[];
}

export function createRaisedBedFieldSupportDescriptor({
    blockIndex,
    blockPosition,
    key,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    blockPosition: RaisedBedFieldVisualVector3;
    key: string;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}): RaisedBedSupportDescriptor {
    const fieldPosition = getRaisedBedFieldWorldPosition({
        blockIndex,
        blockPosition,
        orientation,
        positionIndex,
        y: -0.724,
    });

    return {
        key,
        layer: 'support',
        renderOrder: 8,
        transform: {
            position: [
                fieldPosition[0],
                fieldPosition[1] + 0.39,
                fieldPosition[2],
            ],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
        },
    };
}

const seedLayoutByPlantsPerRow = [
    { multiplier: 0, offset: 0, scale: 2 },
    { multiplier: 0, offset: 0, scale: 2 },
    { multiplier: 0.13, offset: 0.03, scale: 1.8 },
    { multiplier: 0.09, offset: 0.025, scale: 1.6 },
    { multiplier: 0.07, offset: 0.0225, scale: 1.4 },
] as const;

export function createRaisedBedFieldSeedDescriptors({
    blockIndex,
    blockPosition,
    keyPrefix,
    orientation,
    plantsPerRow,
    positionIndex,
    sown,
    totalPlants = Math.max(Math.floor(plantsPerRow), 1) ** 2,
}: {
    blockIndex: number;
    blockPosition: RaisedBedFieldVisualVector3;
    keyPrefix: string;
    orientation: RaisedBedOrientation;
    plantsPerRow: number;
    positionIndex: number;
    sown: boolean;
    totalPlants?: number;
}) {
    const safePlantsPerRow = Math.max(Math.floor(plantsPerRow), 1);
    const seedLayout =
        seedLayoutByPlantsPerRow[safePlantsPerRow] ??
        seedLayoutByPlantsPerRow[seedLayoutByPlantsPerRow.length - 1];
    const fieldPosition = getRaisedBedFieldWorldPosition({
        blockIndex,
        blockPosition,
        orientation,
        positionIndex,
        y: -0.75,
    });
    const safeTotalPlants = Math.max(Math.floor(totalPlants), 0);

    return Array.from(
        { length: safeTotalPlants },
        (_, index): RaisedBedSeedDescriptor => {
            const slotX =
                Math.floor(index / safePlantsPerRow) * seedLayout.multiplier -
                safePlantsPerRow * seedLayout.offset;
            const slotZ =
                (index % safePlantsPerRow) * seedLayout.multiplier -
                safePlantsPerRow * seedLayout.offset;

            return {
                key: `${keyPrefix}:${index}`,
                layer: sown ? 'seed-sown' : 'seed-pending',
                transform: {
                    position: [
                        fieldPosition[0] + slotX,
                        fieldPosition[1],
                        fieldPosition[2] + slotZ,
                    ],
                    rotation: [0, 0, 0],
                    scale: [
                        seedLayout.scale,
                        seedLayout.scale,
                        seedLayout.scale,
                    ],
                },
            };
        },
    );
}
