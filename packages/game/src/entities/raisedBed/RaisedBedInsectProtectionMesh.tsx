import { useEffect, useMemo } from 'react';
import {
    BufferGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Shape,
} from 'three';
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

type InsectMeshCover = {
    indices: number[];
    positions: number[];
};

export type RaisedBedInsectProtectionMeshVisual = {
    anchors: [number, number, number][];
    cover: InsectMeshCover;
    endPositions: [number, number, number][];
    endRotation: [number, number, number];
    endShape: Shape;
    frameRods: InsectMeshRod[];
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
            const angle = progress * Math.PI;
            return {
                lateral: -Math.cos(angle) * archRadius,
                y: meshBaseLift + Math.sin(angle) * archRadius,
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

    const coverPositions = archPoints.flatMap(({ lateral, y }) =>
        lengthRunsAlongX
            ? [-length / 2, y, lateral, length / 2, y, lateral]
            : [lateral, y, -length / 2, lateral, y, length / 2],
    );
    const coverIndices = Array.from(
        { length: archSegmentCount },
        (_, index) => {
            const start = index * 2;
            return [
                start,
                start + 1,
                start + 2,
                start + 1,
                start + 3,
                start + 2,
            ];
        },
    ).flat();

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
        cover: {
            indices: coverIndices,
            positions: coverPositions,
        },
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
    };
}

export function RaisedBedInsectProtectionMesh({
    layout,
}: {
    layout: RaisedBedInsectProtectionMeshLayout;
}) {
    const visual = useMemo(
        () => createRaisedBedInsectProtectionMeshVisual(layout),
        [layout],
    );
    const coverGeometry = useMemo(() => {
        const geometry = new BufferGeometry();
        geometry.setAttribute(
            'position',
            new Float32BufferAttribute(visual.cover.positions, 3),
        );
        geometry.setIndex(visual.cover.indices);
        geometry.computeVertexNormals();
        return geometry;
    }, [visual.cover]);

    useEffect(() => () => coverGeometry.dispose(), [coverGeometry]);

    return (
        <group
            name="VisualReward:InsectProtectionMesh"
            position={layout.position}
            userData={{ [blockInteractionPassthroughUserDataKey]: true }}
        >
            <mesh geometry={coverGeometry} renderOrder={10}>
                <meshStandardMaterial
                    color="#eef2df"
                    depthWrite={false}
                    opacity={0.2}
                    roughness={1}
                    side={DoubleSide}
                    transparent
                />
            </mesh>
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
