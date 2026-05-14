import { useEffect } from 'react';
import type { BufferGeometry } from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useOperations } from '../../hooks/useOperations';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import {
    type GameQualityProfile,
    resolveGameQualityProfile,
} from '../../scene/gameQuality';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import {
    getGridPositionFromIndex,
    type RaisedBedOrientation,
} from '../../utils/raisedBedOrientation';
import { useGameGLTF } from '../../utils/useGameGLTF';

const combinedOverlap = 0.1;
const halfOverlap = combinedOverlap / 2;
const fieldMulchScale: [number, number, number] = [1, 3, 1];

type CurrentGardenData = NonNullable<
    NonNullable<ReturnType<typeof useCurrentGarden>['data']>
>;

type RaisedBedDirtGeometryName =
    | 'Raised_Bed_O_2'
    | 'Raised_Bed_L_1'
    | 'Raised_Bed_I_1'
    | 'Raised_Bed_U_1';

type FootprintBounds = {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
};

type RaisedBedPlacement = {
    block: Block;
    blockIndex: number;
    blockOffset: number;
    dirtGeometryName: RaisedBedDirtGeometryName;
    origin: [number, number, number];
    rotationQuarterTurns: number;
    stack: Stack;
};

type MulchVisual = {
    blockId: number;
    blockName: string;
    application: string;
};

function normalizeText(value: string | null | undefined) {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function textIncludesAny(text: string, keywords: string[]) {
    return keywords.some((keyword) => text.includes(keyword));
}

function getMulchKeywords(blockName: string) {
    switch (blockName) {
        case 'MulchHey':
            return ['slama', 'sijeno', 'hay', 'straw', 'hey'];
        case 'MulchCoconut':
            return ['kokos', 'kokosova', 'kokosove', 'coconut'];
        case 'MulchWood':
            return ['drvo', 'drveta', 'drvena', 'wood', 'kora'];
        default:
            return [];
    }
}

function isBedMulchApplication(application: string) {
    return application === 'raisedBedFull' || application === 'raisedBed1m';
}

function isFieldMulchApplication(application: string) {
    return application === 'plant';
}

function getBlockPlacement(garden: CurrentGardenData, blockId: string) {
    for (const stack of garden.stacks) {
        const blockIndex = stack.blocks.findIndex(
            (candidate) => candidate.id === blockId,
        );
        if (blockIndex < 0) {
            continue;
        }

        const block = stack.blocks[blockIndex];
        if (block) {
            return {
                block,
                stack,
                stackBlockIndex: blockIndex,
            };
        }
    }

    return null;
}

function getRaisedBedNeighbors(
    garden: CurrentGardenData,
    stack: Stack,
    block: Block,
) {
    function getStackAt(x: number, z: number) {
        return garden.stacks.find(
            (candidate) =>
                candidate.position.x === x && candidate.position.z === z,
        );
    }

    const currentInStackIndex = stack.blocks.indexOf(block);
    const north = getStackAt(stack.position.x + 1, stack.position.z);
    const east = getStackAt(stack.position.x, stack.position.z - 1);
    const south = getStackAt(stack.position.x - 1, stack.position.z);
    const west = getStackAt(stack.position.x, stack.position.z + 1);

    const neighbors = {
        n: north?.blocks.at(currentInStackIndex)?.name === block.name,
        e: east?.blocks.at(currentInStackIndex)?.name === block.name,
        s: south?.blocks.at(currentInStackIndex)?.name === block.name,
        w: west?.blocks.at(currentInStackIndex)?.name === block.name,
    };

    return {
        ...neighbors,
        total:
            (neighbors.n ? 1 : 0) +
            (neighbors.e ? 1 : 0) +
            (neighbors.s ? 1 : 0) +
            (neighbors.w ? 1 : 0),
    };
}

function getRaisedBedOrigin(
    blockData: ReturnType<typeof useBlockData>['data'],
    stack: Stack,
    block: Block,
    neighbors: ReturnType<typeof getRaisedBedNeighbors>,
): [number, number, number] {
    const currentStackHeight = getStackHeight(blockData, stack, block);

    let x = stack.position.x;
    let z = stack.position.z;

    if (neighbors.total === 1) {
        if (neighbors.n) {
            x += halfOverlap;
        } else if (neighbors.e) {
            z -= halfOverlap;
        } else if (neighbors.s) {
            x -= halfOverlap;
        } else if (neighbors.w) {
            z += halfOverlap;
        }
    }

    return [x, currentStackHeight + 1, z];
}

function getRaisedBedSurfaceY(origin: [number, number, number]) {
    return origin[1] - 0.75;
}

function getFieldWorldPosition(input: {
    blockIndex: number;
    localPositionIndex: number;
    orientation: RaisedBedOrientation;
    origin: [number, number, number];
}) {
    const { blockIndex, localPositionIndex, orientation, origin } = input;
    const offsetX =
        orientation === 'vertical' ? 0.31 - blockIndex * 0.05 : 0.27;
    const offsetZ =
        orientation === 'vertical' ? 0.27 : 0.27 + blockIndex * 0.05;
    const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
    const multiplierZ = orientation === 'vertical' ? 0.27 : 0.285;
    const { row, col } = getGridPositionFromIndex(
        localPositionIndex,
        orientation,
    );

    return [
        origin[0] + col * multiplierX - offsetX,
        getRaisedBedSurfaceY(origin),
        origin[2] + (2 - row) * multiplierZ - offsetZ,
    ] as [number, number, number];
}

function getPlacementForPositionIndex(
    placements: RaisedBedPlacement[],
    positionIndex: number,
) {
    for (const placement of placements) {
        if (
            positionIndex >= placement.blockOffset &&
            positionIndex < placement.blockOffset + 9
        ) {
            return {
                ...placement,
                localPositionIndex: positionIndex - placement.blockOffset,
            };
        }
    }

    return null;
}

function getRaisedBedSurfaceGeometry(
    neighbors: ReturnType<typeof getRaisedBedNeighbors>,
): {
    dirtGeometryName: RaisedBedDirtGeometryName;
    rotationQuarterTurns: number;
} {
    let dirtGeometryName: RaisedBedDirtGeometryName = 'Raised_Bed_O_2';
    let rotationQuarterTurns = 0;

    if (neighbors.total === 1) {
        dirtGeometryName = 'Raised_Bed_U_1';

        if (neighbors.n) {
            rotationQuarterTurns = 0;
        } else if (neighbors.e) {
            rotationQuarterTurns = 1;
        } else if (neighbors.s) {
            rotationQuarterTurns = 2;
        } else if (neighbors.w) {
            rotationQuarterTurns = 3;
        }
    } else if (neighbors.total === 2) {
        if ((neighbors.n && neighbors.s) || (neighbors.e && neighbors.w)) {
            dirtGeometryName = 'Raised_Bed_I_1';
            rotationQuarterTurns = neighbors.n && neighbors.s ? 1 : 0;
        } else {
            dirtGeometryName = 'Raised_Bed_L_1';

            if (neighbors.n && neighbors.e) {
                rotationQuarterTurns = 0;
            } else if (neighbors.e && neighbors.s) {
                rotationQuarterTurns = 1;
            } else if (neighbors.s && neighbors.w) {
                rotationQuarterTurns = 2;
            } else {
                rotationQuarterTurns = 3;
            }
        }
    }

    return {
        dirtGeometryName,
        rotationQuarterTurns,
    };
}

function getGeometryFootprintBounds(geometry: BufferGeometry): FootprintBounds {
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;

    if (!boundingBox) {
        return {
            minX: -0.5,
            maxX: 0.5,
            minZ: -0.5,
            maxZ: 0.5,
        };
    }

    return {
        minX: boundingBox.min.x,
        maxX: boundingBox.max.x,
        minZ: boundingBox.min.z,
        maxZ: boundingBox.max.z,
    };
}

function rotateFootprintBounds(
    bounds: FootprintBounds,
    rotationQuarterTurns: number,
): FootprintBounds {
    const normalizedTurns = ((rotationQuarterTurns % 4) + 4) % 4;
    const corners = [
        [bounds.minX, bounds.minZ],
        [bounds.minX, bounds.maxZ],
        [bounds.maxX, bounds.minZ],
        [bounds.maxX, bounds.maxZ],
    ] as const;

    const rotatedCorners = corners.map(([x, z]) => {
        switch (normalizedTurns) {
            case 1:
                return [-z, x] as const;
            case 2:
                return [-x, -z] as const;
            case 3:
                return [z, -x] as const;
            default:
                return [x, z] as const;
        }
    });

    return {
        minX: Math.min(...rotatedCorners.map(([x]) => x)),
        maxX: Math.max(...rotatedCorners.map(([x]) => x)),
        minZ: Math.min(...rotatedCorners.map(([, z]) => z)),
        maxZ: Math.max(...rotatedCorners.map(([, z]) => z)),
    };
}

function translateFootprintBounds(
    bounds: FootprintBounds,
    origin: [number, number, number],
): FootprintBounds {
    return {
        minX: bounds.minX + origin[0],
        maxX: bounds.maxX + origin[0],
        minZ: bounds.minZ + origin[2],
        maxZ: bounds.maxZ + origin[2],
    };
}

function getUnionFootprintBounds(boundsList: FootprintBounds[]) {
    return {
        minX: Math.min(...boundsList.map((bounds) => bounds.minX)),
        maxX: Math.max(...boundsList.map((bounds) => bounds.maxX)),
        minZ: Math.min(...boundsList.map((bounds) => bounds.minZ)),
        maxZ: Math.max(...boundsList.map((bounds) => bounds.maxZ)),
    };
}

function getMulchGeometry(
    nodes: ReturnType<typeof useGameGLTF>['nodes'],
    blockName: string,
) {
    if (blockName === 'MulchHey') {
        return nodes.Mulch_Hey.geometry;
    }
    if (blockName === 'MulchCoconut') {
        return nodes.Mulch_Coconut.geometry;
    }
    if (blockName === 'MulchWood') {
        return nodes.Mulch_Wood.geometry;
    }

    return null;
}

function getFullBedSurfaceBounds(
    placements: RaisedBedPlacement[],
    nodes: ReturnType<typeof useGameGLTF>['nodes'],
) {
    return getUnionFootprintBounds(
        placements.map((placement) =>
            translateFootprintBounds(
                rotateFootprintBounds(
                    getGeometryFootprintBounds(
                        nodes[placement.dirtGeometryName].geometry,
                    ),
                    placement.rotationQuarterTurns,
                ),
                placement.origin,
            ),
        ),
    );
}

function getFullBedPosition(surfaceBounds: FootprintBounds, surfaceY: number) {
    return [
        (surfaceBounds.minX + surfaceBounds.maxX) / 2,
        surfaceY,
        (surfaceBounds.minZ + surfaceBounds.maxZ) / 2,
    ] as [number, number, number];
}

function getFullBedScale(
    surfaceBounds: FootprintBounds,
    blockName: string,
    nodes: ReturnType<typeof useGameGLTF>['nodes'],
) {
    const mulchGeometry = getMulchGeometry(nodes, blockName);
    if (!mulchGeometry) {
        return [3, 3, 3] as [number, number, number];
    }

    const mulchBounds = getGeometryFootprintBounds(mulchGeometry);
    const mulchWidth = mulchBounds.maxX - mulchBounds.minX;
    const mulchDepth = mulchBounds.maxZ - mulchBounds.minZ;
    const surfaceWidth = surfaceBounds.maxX - surfaceBounds.minX;
    const surfaceDepth = surfaceBounds.maxZ - surfaceBounds.minZ;

    if (mulchWidth <= 0 || mulchDepth <= 0) {
        return [3, 3, 3] as [number, number, number];
    }

    return [surfaceWidth / mulchWidth, 3, surfaceDepth / mulchDepth] as [
        number,
        number,
        number,
    ];
}

function resolveMulchVisualByOperationId(
    operations: ReturnType<typeof useOperations>['data'],
    blocks: ReturnType<typeof useBlockData>['data'],
) {
    const visuals = new Map<number, MulchVisual>();
    const mulchBlocks =
        blocks?.filter((block) => block.information.name.startsWith('Mulch')) ??
        [];

    for (const operation of operations ?? []) {
        const application = operation.attributes.application;
        if (
            !isBedMulchApplication(application) &&
            !isFieldMulchApplication(application)
        ) {
            continue;
        }

        const operationText = normalizeText(
            [
                operation.information.name,
                operation.information.label,
                operation.information.shortDescription,
                operation.information.description,
                operation.image?.cover?.url,
            ].join(' '),
        );

        let matchedBlock = mulchBlocks.find((block) =>
            (operation.image?.cover?.url ?? '').includes(
                block.information.name,
            ),
        );

        if (!matchedBlock) {
            matchedBlock = mulchBlocks.find((block) =>
                textIncludesAny(
                    operationText,
                    getMulchKeywords(block.information.name),
                ),
            );
        }

        if (!matchedBlock) {
            continue;
        }

        visuals.set(operation.id, {
            blockId: matchedBlock.id,
            blockName: matchedBlock.information.name,
            application,
        });
    }

    return visuals;
}

function MulchMesh({
    geometry,
    minSnowCoverage,
    position,
    renderSnow,
    scale,
}: {
    geometry: BufferGeometry;
    minSnowCoverage: number;
    position: [number, number, number];
    renderSnow: boolean;
    scale: [number, number, number];
}) {
    const { materials } = useGameGLTF();

    return (
        <group position={position}>
            <mesh
                castShadow
                receiveShadow
                scale={scale}
                geometry={geometry}
                material={materials['Material.ColorPaletteMain']}
            >
                {renderSnow && (
                    <SnowOverlay
                        geometry={geometry}
                        minCoverage={minSnowCoverage}
                        {...snowPresets.mulch}
                    />
                )}
            </mesh>
        </group>
    );
}

function RaisedBedMulchProfileMetadata({ count }: { count: number }) {
    useEffect(() => {
        updateGameProfileMetadata({
            raisedBedMulchOverlayCount: count,
        });
    }, [count]);

    return null;
}

export function RaisedBedMulchOverlays({
    quality,
}: {
    quality?: GameQualityProfile;
}) {
    const { data: currentGarden } = useCurrentGarden();
    const { data: cart } = useShoppingCart();
    const { data: operations } = useOperations();
    const { data: blockData } = useBlockData();
    const { nodes } = useGameGLTF();
    const qualityProfile = quality ?? resolveGameQualityProfile();
    const snowCoverage = useGameState((state) => state.snowCoverage);
    const renderSnow = snowCoverage >= qualityProfile.snowOverlayMinCoverage;

    if (!currentGarden || !blockData || !operations) {
        return <RaisedBedMulchProfileMetadata count={0} />;
    }

    const mulchVisualByOperationId = resolveMulchVisualByOperationId(
        operations,
        blockData,
    );
    if (mulchVisualByOperationId.size === 0) {
        return <RaisedBedMulchProfileMetadata count={0} />;
    }

    const overlays = [];

    for (const raisedBed of currentGarden.raisedBeds) {
        const blockIds = getRaisedBedBlockIds(currentGarden, raisedBed.id);
        const placements: RaisedBedPlacement[] = [];

        for (const [blockIndex, blockId] of blockIds.entries()) {
            const placement = getBlockPlacement(currentGarden, blockId);
            if (!placement) {
                continue;
            }

            const neighbors = getRaisedBedNeighbors(
                currentGarden,
                placement.stack,
                placement.block,
            );
            const surfaceGeometry = getRaisedBedSurfaceGeometry(neighbors);

            placements.push({
                block: placement.block,
                blockIndex,
                blockOffset: Math.max(blockIds.length - 1 - blockIndex, 0) * 9,
                dirtGeometryName: surfaceGeometry.dirtGeometryName,
                origin: getRaisedBedOrigin(
                    blockData,
                    placement.stack,
                    placement.block,
                    neighbors,
                ),
                rotationQuarterTurns: surfaceGeometry.rotationQuarterTurns,
                stack: placement.stack,
            });
        }

        if (placements.length === 0) {
            continue;
        }

        const fullBedCartVisual = cart?.items.find((item) => {
            if (
                item.gardenId !== currentGarden.id ||
                item.raisedBedId !== raisedBed.id ||
                item.entityTypeName !== 'operation'
            ) {
                return false;
            }

            const visual = mulchVisualByOperationId.get(Number(item.entityId));
            return Boolean(visual && isBedMulchApplication(visual.application));
        });

        const fullBedCartMulch =
            fullBedCartVisual &&
            mulchVisualByOperationId.get(Number(fullBedCartVisual.entityId));
        const fullBedAppliedMulch = (raisedBed.appliedOperations ?? []).find(
            (operation) => {
                const visual = mulchVisualByOperationId.get(operation.entityId);
                return Boolean(
                    visual && isBedMulchApplication(visual.application),
                );
            },
        );

        if (fullBedCartMulch || fullBedAppliedMulch) {
            let visual = fullBedCartMulch;
            if (!visual && fullBedAppliedMulch) {
                visual = mulchVisualByOperationId.get(
                    fullBedAppliedMulch.entityId,
                );
            }
            if (visual) {
                const mulchGeometry = getMulchGeometry(nodes, visual.blockName);
                if (mulchGeometry) {
                    const surfaceBounds = getFullBedSurfaceBounds(
                        placements,
                        nodes,
                    );
                    overlays.push(
                        <MulchMesh
                            key={`raised-bed-mulch-${raisedBed.id}-${visual.blockId}`}
                            geometry={mulchGeometry}
                            minSnowCoverage={
                                qualityProfile.snowOverlayMinCoverage
                            }
                            position={getFullBedPosition(
                                surfaceBounds,
                                getRaisedBedSurfaceY(placements[0].origin),
                            )}
                            renderSnow={renderSnow}
                            scale={getFullBedScale(
                                surfaceBounds,
                                visual.blockName,
                                nodes,
                            )}
                        />,
                    );
                }
            }
            continue;
        }

        const fieldMulchByPositionIndex = new Map<number, string>();

        for (const operation of raisedBed.appliedOperations ?? []) {
            const visual = mulchVisualByOperationId.get(operation.entityId);
            if (!visual || !isFieldMulchApplication(visual.application)) {
                continue;
            }

            const field = raisedBed.fields.find(
                (candidate) => candidate.id === operation.raisedBedFieldId,
            );
            if (!field || !isRaisedBedFieldOccupied(field)) {
                continue;
            }

            const operationTimestamp = Date.parse(
                operation.completedAt ?? operation.createdAt,
            );
            const sowTimestamp = field.plantSowDate
                ? Date.parse(field.plantSowDate)
                : Number.NaN;
            if (
                Number.isFinite(sowTimestamp) &&
                operationTimestamp < sowTimestamp
            ) {
                continue;
            }

            fieldMulchByPositionIndex.set(
                field.positionIndex,
                visual.blockName,
            );
        }

        for (const item of cart?.items ?? []) {
            if (
                item.gardenId !== currentGarden.id ||
                item.raisedBedId !== raisedBed.id ||
                item.entityTypeName !== 'operation' ||
                typeof item.positionIndex !== 'number'
            ) {
                continue;
            }

            const visual = mulchVisualByOperationId.get(Number(item.entityId));
            if (!visual || !isFieldMulchApplication(visual.application)) {
                continue;
            }

            fieldMulchByPositionIndex.set(item.positionIndex, visual.blockName);
        }

        const orientation = raisedBed.orientation ?? 'vertical';
        for (const [positionIndex, blockName] of fieldMulchByPositionIndex) {
            const placement = getPlacementForPositionIndex(
                placements,
                positionIndex,
            );
            if (!placement) {
                continue;
            }

            const mulchGeometry = getMulchGeometry(nodes, blockName);
            if (!mulchGeometry) {
                continue;
            }

            overlays.push(
                <MulchMesh
                    key={`raised-bed-field-mulch-${raisedBed.id}-${positionIndex}-${blockName}`}
                    geometry={mulchGeometry}
                    minSnowCoverage={qualityProfile.snowOverlayMinCoverage}
                    position={getFieldWorldPosition({
                        blockIndex: placement.blockIndex,
                        localPositionIndex: placement.localPositionIndex,
                        orientation,
                        origin: placement.origin,
                    })}
                    renderSnow={renderSnow}
                    scale={fieldMulchScale}
                />,
            );
        }
    }

    return (
        <>
            <RaisedBedMulchProfileMetadata count={overlays.length} />
            {overlays}
        </>
    );
}
