import { DoubleSide, Shape } from 'three';
import { blockInteractionPassthroughUserDataKey } from '../../controls/BlockInteractionResolver';
import type { RaisedBedOrientation } from '../../utils/raisedBedOrientation';
import { getRaisedBedFieldSurfacePosition } from './raisedBedSoilWetPatches';

export type RaisedBedInsectProtectionMeshLayout = {
    depth: number;
    position: [number, number, number];
    width: number;
};

export type RaisedBedInsectProtectionMeshBlock = {
    blockIndex: number;
    blockOffset: number;
    position: readonly [number, number, number];
    raisedBedId: number;
};

type InsectMeshRod = {
    key: string;
    length: number;
    position: [number, number, number];
    rotation: [number, number, number];
};

type InsectMeshPanel = {
    depth: number;
    key: string;
    position: [number, number, number];
    rotation: [number, number, number];
    width: number;
};

export type RaisedBedInsectProtectionMeshVisual = {
    anchors: [number, number, number][];
    endPositions: [number, number, number][];
    endRotation: [number, number, number];
    endShape: Shape;
    frameRods: InsectMeshRod[];
    panels: InsectMeshPanel[];
};

const meshInset = 0.018;
const meshBaseLift = 0.026;
const archSegmentCount = 8;
const fieldMeshSize = 0.25;
const wholeBedMeshPadding = 0.02;

export function createRaisedBedWholeInsectProtectionMeshLayout({
    blocks,
    orientation,
}: {
    blocks: readonly RaisedBedInsectProtectionMeshBlock[];
    orientation: RaisedBedOrientation;
}): RaisedBedInsectProtectionMeshLayout | null {
    if (blocks.length === 0) {
        return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    const fieldHalfSize = fieldMeshSize / 2;

    for (const block of blocks) {
        for (let positionIndex = 0; positionIndex < 9; positionIndex += 1) {
            const localPosition = getRaisedBedFieldSurfacePosition({
                blockIndex: block.blockIndex,
                orientation,
                positionIndex,
                y: 0,
            });
            const centerX = block.position[0] + localPosition[0];
            const centerZ = block.position[2] + localPosition[2];

            minX = Math.min(minX, centerX - fieldHalfSize);
            maxX = Math.max(maxX, centerX + fieldHalfSize);
            minZ = Math.min(minZ, centerZ - fieldHalfSize);
            maxZ = Math.max(maxZ, centerZ + fieldHalfSize);
        }
    }

    minX -= wholeBedMeshPadding;
    maxX += wholeBedMeshPadding;
    minZ -= wholeBedMeshPadding;
    maxZ += wholeBedMeshPadding;

    const owner = blocks.find((block) => block.blockIndex === 0) ?? blocks[0];

    return {
        depth: maxZ - minZ,
        position: [
            (minX + maxX) / 2,
            owner.position[1] - 0.704,
            (minZ + maxZ) / 2,
        ],
        width: maxX - minX,
    };
}

export function createRaisedBedFieldInsectProtectionMeshLayout({
    block,
    orientation,
    positionIndex,
}: {
    block: RaisedBedInsectProtectionMeshBlock;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}): RaisedBedInsectProtectionMeshLayout {
    const localPosition = getRaisedBedFieldSurfacePosition({
        blockIndex: block.blockIndex,
        orientation,
        positionIndex,
        y: -0.704,
    });

    return {
        depth: fieldMeshSize,
        position: [
            block.position[0] + localPosition[0],
            block.position[1] + localPosition[1],
            block.position[2] + localPosition[2],
        ],
        width: fieldMeshSize,
    };
}

export function createRaisedBedInsectProtectionMeshVisual(
    layout: RaisedBedInsectProtectionMeshLayout,
): RaisedBedInsectProtectionMeshVisual {
    const lengthRunsAlongX = layout.width >= layout.depth;
    const length = Math.max(
        (lengthRunsAlongX ? layout.width : layout.depth) - meshInset * 2,
        0.18,
    );
    const span = Math.max(
        (lengthRunsAlongX ? layout.depth : layout.width) - meshInset * 2,
        0.18,
    );
    const archRadius = span / 2;
    const archPoints = Array.from(
        { length: archSegmentCount + 1 },
        (_, index) => {
            const progress = index / archSegmentCount;
            const lateral = -archRadius + archRadius * 2 * progress;
            return {
                lateral,
                y:
                    meshBaseLift +
                    Math.sqrt(
                        Math.max(
                            archRadius * archRadius - lateral * lateral,
                            0,
                        ),
                    ),
            };
        },
    );
    const hoopCount = length > fieldMeshSize ? 4 : 2;
    const hoopPositions = Array.from(
        { length: hoopCount },
        (_, index) =>
            -length / 2 + (length * index) / Math.max(hoopCount - 1, 1),
    );
    const frameRods: InsectMeshRod[] = [];
    const panels: InsectMeshPanel[] = [];

    for (const [hoopIndex, longitudinal] of hoopPositions.entries()) {
        for (let index = 0; index < archSegmentCount; index += 1) {
            const start = archPoints[index];
            const end = archPoints[index + 1];
            const deltaLateral = end.lateral - start.lateral;
            const deltaY = end.y - start.y;
            const rodLength = Math.hypot(deltaLateral, deltaY);
            const midpointLateral = (start.lateral + end.lateral) / 2;
            const midpointY = (start.y + end.y) / 2;

            frameRods.push({
                key: `hoop-${hoopIndex.toString()}-${index.toString()}`,
                length: rodLength,
                position: lengthRunsAlongX
                    ? [longitudinal, midpointY, midpointLateral]
                    : [midpointLateral, midpointY, longitudinal],
                rotation: lengthRunsAlongX
                    ? [Math.atan2(deltaLateral, deltaY), 0, 0]
                    : [0, 0, -Math.atan2(deltaLateral, deltaY)],
            });
        }
    }

    for (let index = 0; index < archSegmentCount; index += 1) {
        const start = archPoints[index];
        const end = archPoints[index + 1];
        const deltaLateral = end.lateral - start.lateral;
        const deltaY = end.y - start.y;
        const panelWidth = Math.hypot(deltaLateral, deltaY);
        const midpointLateral = (start.lateral + end.lateral) / 2;
        const midpointY = (start.y + end.y) / 2;

        panels.push({
            depth: length,
            key: `panel-${index.toString()}`,
            position: lengthRunsAlongX
                ? [0, midpointY, midpointLateral]
                : [midpointLateral, midpointY, 0],
            rotation: lengthRunsAlongX
                ? [-Math.atan2(deltaY, deltaLateral), 0, 0]
                : [0, 0, Math.atan2(deltaY, deltaLateral)],
            width: panelWidth,
        });
    }

    const endShape = new Shape();
    endShape.moveTo(archPoints[0].lateral, meshBaseLift);
    for (const point of archPoints) {
        endShape.lineTo(point.lateral, point.y);
    }
    endShape.lineTo(archPoints.at(-1)?.lateral ?? span / 2, meshBaseLift);
    endShape.closePath();

    const anchors = [-1, 1].flatMap((longitudinalDirection) =>
        [-1, 1].map((lateralDirection): [number, number, number] =>
            lengthRunsAlongX
                ? [
                      (longitudinalDirection * length) / 2,
                      meshBaseLift,
                      (lateralDirection * span) / 2,
                  ]
                : [
                      (lateralDirection * span) / 2,
                      meshBaseLift,
                      (longitudinalDirection * length) / 2,
                  ],
        ),
    );

    return {
        anchors,
        endPositions: lengthRunsAlongX
            ? [
                  [-length / 2, 0, 0],
                  [length / 2, 0, 0],
              ]
            : [
                  [0, 0, -length / 2],
                  [0, 0, length / 2],
              ],
        endRotation: lengthRunsAlongX ? [0, Math.PI / 2, 0] : [0, 0, 0],
        endShape,
        frameRods,
        panels,
    };
}

export function RaisedBedInsectProtectionMesh({
    layout,
}: {
    layout: RaisedBedInsectProtectionMeshLayout;
}) {
    const visual = createRaisedBedInsectProtectionMeshVisual(layout);
    const lengthRunsAlongX = layout.width >= layout.depth;

    return (
        <group
            name="VisualReward:InsectProtectionMesh"
            position={layout.position}
            userData={{ [blockInteractionPassthroughUserDataKey]: true }}
        >
            {visual.panels.map((panel) => {
                const lengthSegments = Math.max(
                    4,
                    Math.round(panel.depth / 0.09),
                );

                return (
                    <group
                        key={panel.key}
                        position={panel.position}
                        rotation={panel.rotation}
                    >
                        <mesh renderOrder={10}>
                            {lengthRunsAlongX ? (
                                <boxGeometry
                                    args={[
                                        panel.depth,
                                        0.004,
                                        panel.width,
                                        lengthSegments,
                                        1,
                                        1,
                                    ]}
                                />
                            ) : (
                                <boxGeometry
                                    args={[
                                        panel.width,
                                        0.004,
                                        panel.depth,
                                        1,
                                        1,
                                        lengthSegments,
                                    ]}
                                />
                            )}
                            <meshStandardMaterial
                                color="#eef2df"
                                depthWrite={false}
                                opacity={0.13}
                                roughness={1}
                                transparent
                            />
                        </mesh>
                        <mesh renderOrder={11} scale={[1.002, 1.25, 1.002]}>
                            {lengthRunsAlongX ? (
                                <boxGeometry
                                    args={[
                                        panel.depth,
                                        0.004,
                                        panel.width,
                                        lengthSegments,
                                        1,
                                        1,
                                    ]}
                                />
                            ) : (
                                <boxGeometry
                                    args={[
                                        panel.width,
                                        0.004,
                                        panel.depth,
                                        1,
                                        1,
                                        lengthSegments,
                                    ]}
                                />
                            )}
                            <meshBasicMaterial
                                color="#cbd4bc"
                                depthWrite={false}
                                opacity={0.24}
                                transparent
                                wireframe
                            />
                        </mesh>
                    </group>
                );
            })}
            {visual.endPositions.map((position, index) => (
                <mesh
                    key={`end-${index.toString()}`}
                    position={position}
                    renderOrder={10}
                    rotation={visual.endRotation}
                >
                    <shapeGeometry args={[visual.endShape]} />
                    <meshStandardMaterial
                        color="#eef2df"
                        depthWrite={false}
                        opacity={0.16}
                        roughness={1}
                        side={DoubleSide}
                        transparent
                    />
                </mesh>
            ))}
            {visual.frameRods.map((rod) => (
                <mesh
                    castShadow
                    key={rod.key}
                    position={rod.position}
                    renderOrder={11}
                    rotation={rod.rotation}
                >
                    <cylinderGeometry args={[0.009, 0.009, rod.length, 6]} />
                    <meshStandardMaterial color="#d7d6bd" roughness={0.92} />
                </mesh>
            ))}
            {visual.anchors.map((position, index) => (
                <mesh
                    castShadow
                    key={`anchor-${index.toString()}`}
                    position={position}
                    renderOrder={12}
                >
                    <boxGeometry args={[0.07, 0.026, 0.05]} />
                    <meshStandardMaterial color="#8c7650" roughness={1} />
                </mesh>
            ))}
        </group>
    );
}
