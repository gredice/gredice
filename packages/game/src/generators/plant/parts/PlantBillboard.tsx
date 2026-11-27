'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    type PropsWithChildren,
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import * as THREE from 'three';
import CSM from 'three-custom-shader-material';
import { useGameState } from '../../../useGameState';
import { usePlantInstanceBufferMetrics } from '../hooks/usePlantInstanceBufferMetrics';
import { usePlantSway } from '../hooks/usePlantSway';
import {
    createStaticInstancedBufferAttribute,
    finalizeStaticInstanceMatrixUpload,
    markStaticInstancedAttributeForUpload,
} from '../lib/plantInstanceBuffers';
import type { PlantLodLevel } from '../lib/plantLod';
import {
    createPlantBillboardShapeUniforms,
    getMidBillboardAccentCards,
    getMidBillboardSwayPhase,
    getPlantBillboardAccentSeed,
    getPlantBillboardClump,
    getPlantBillboardClumpAccent,
    midBillboardCardGeometry,
    midBillboardFragmentShader,
    midBillboardVertexShader,
    PLANT_BILLBOARD_SHAPE,
    type PlantBillboardCard,
    type PlantBillboardShape,
} from '../lib/plantMidBillboardMaterial';

export interface PlantBillboardSummary {
    accentCenterY: number;
    accentColor?: string;
    accentRadius?: number;
    canopyCenterY: number;
    canopyWidth: number;
    dominantColor: string;
    foliageColor: string;
    hasFoliage: boolean;
    height: number;
    stemColor: string;
    stemWidth: number;
}

interface PlantBillboardProps {
    animate?: boolean;
    level: Exclude<PlantLodLevel, 'near'>;
    seed: string;
    summary: PlantBillboardSummary;
}

export interface PlantBillboardBatchItem {
    position: readonly [number, number, number];
    scale: number;
    summary: PlantBillboardSummary;
}

interface PlantBillboardBatchProps {
    debugName?: string;
    level: Exclude<PlantLodLevel, 'near'>;
    billboards: PlantBillboardBatchItem[];
}

interface BillboardInstanceItem {
    /** Produce dots painted into a far clump: albedo and packed layout. */
    accent: THREE.Vector4;
    color: THREE.Color;
    matrix: THREE.Matrix4;
    swayPhase: number;
}

interface PlantBillboardAccent {
    color: string;
    /** Dot layout seed; batched cards take it from the sway phase instead. */
    seed: number;
    value: number;
}

interface BillboardInstanceMeshProps {
    animate?: boolean;
    debugName: string;
    items: BillboardInstanceItem[];
    shape: PlantBillboardShape;
    swaySeed: string;
}

const BILLBOARD_IDENTITY_QUATERNION = new THREE.Quaternion();

/**
 * Every plant card draws in two passes over the same triangles (the card
 * geometry has one draw group per pass). The opaque pass draws the solid
 * inside and writes depth, so neighbouring plants overlap correctly whatever
 * order their instances are drawn in. The blended pass draws only the soft
 * fringe outside the outline, without writing depth, so a card's edge never
 * hides the plant behind it. Both are lit by the scene like the 3D plant.
 */
const plantCardSharedMaterialProps = {
    baseMaterial: THREE.MeshLambertMaterial,
    fragmentShader: midBillboardFragmentShader,
    side: THREE.FrontSide,
    vertexShader: midBillboardVertexShader,
} as const;

const plantCardPassMaterialProps = [
    { ...plantCardSharedMaterialProps, depthWrite: true, transparent: false },
    { ...plantCardSharedMaterialProps, depthWrite: false, transparent: true },
] as const;

function PlantCardMaterials({
    uniforms,
}: {
    uniforms: Record<string, THREE.IUniform>;
}) {
    return (
        <>
            {plantCardPassMaterialProps.map((props, pass) => (
                <CSM
                    // One material per draw group of the card geometry.
                    key={props.transparent ? 'edge' : 'solid'}
                    attach={`material-${pass}`}
                    {...props}
                    uniforms={uniforms}
                />
            ))}
        </>
    );
}

function CameraFacingBillboard({ children }: PropsWithChildren) {
    const groupRef = useRef<THREE.Group>(null);
    const camera = useThree((state) => state.camera);
    const gameCamera = useGameState((state) => state.gameCamera);
    const gardenAvatarView = useGameState((state) => state.gardenAvatarView);

    const updateCameraFacing = useCallback(() => {
        groupRef.current?.quaternion.copy(camera.quaternion);
    }, [camera]);

    useLayoutEffect(() => {
        updateCameraFacing();

        if (!gameCamera) {
            return;
        }

        return gameCamera.subscribe(() => updateCameraFacing());
    }, [gameCamera, updateCameraFacing]);

    useFrame(() => {
        if (gardenAvatarView !== 'overview') {
            updateCameraFacing();
        }
    }, -90);

    return <group ref={groupRef}>{children}</group>;
}

function getStemCard(summary: PlantBillboardSummary): PlantBillboardCard {
    return {
        centerX: 0,
        centerY: summary.height * 0.42,
        halfHeight: Math.max(summary.height * 0.9, 0.2) / 2,
        halfWidth: Math.max(summary.stemWidth, 0.06) / 2,
    };
}

function getClumpColor(summary: PlantBillboardSummary) {
    return summary.hasFoliage ? summary.foliageColor : summary.dominantColor;
}

/** Produce or flower dots for a far clump, which has no accent cards. */
function getFarClumpAccent(
    summary: PlantBillboardSummary,
    seed = 0,
): PlantBillboardAccent | undefined {
    if (!summary.accentColor) {
        return undefined;
    }
    return {
        color: summary.accentColor,
        seed,
        value: getPlantBillboardClumpAccent(summary),
    };
}

function createBillboardItem({
    accent,
    card,
    color,
    position,
    scale,
    swayPosition,
}: {
    accent?: PlantBillboardAccent;
    card: PlantBillboardCard;
    color: string;
    position: readonly [number, number, number];
    scale: number;
    swayPosition?: readonly [number, number, number];
}) {
    const accentColor = new THREE.Color(accent?.color ?? '#ffffff');
    return {
        accent: new THREE.Vector4(
            accentColor.r,
            accentColor.g,
            accentColor.b,
            accent?.value ?? 0,
        ),
        color: new THREE.Color(color),
        matrix: new THREE.Matrix4().compose(
            new THREE.Vector3(
                position[0] + card.centerX * scale,
                position[1] + card.centerY * scale,
                position[2],
            ),
            BILLBOARD_IDENTITY_QUATERNION,
            new THREE.Vector3(
                card.halfWidth * scale,
                card.halfHeight * scale,
                1,
            ),
        ),
        swayPhase:
            swayPosition === undefined
                ? 0
                : getMidBillboardSwayPhase(swayPosition),
    } satisfies BillboardInstanceItem;
}

function BillboardInstanceMesh({
    animate = true,
    debugName,
    items,
    shape,
    swaySeed,
}: BillboardInstanceMeshProps) {
    const meshRef = useRef<THREE.InstancedMesh | null>(null);
    const instanceCapacity = items.length;
    const geometry = useMemo(() => midBillboardCardGeometry.clone(), []);
    const tintAttribute = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 3),
        [instanceCapacity],
    );
    const swayPhaseAttribute = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 1),
        [instanceCapacity],
    );
    const opacityAttribute = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 1),
        [instanceCapacity],
    );
    const accentAttribute = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 4),
        [instanceCapacity],
    );
    const swayUniforms = usePlantSway(swaySeed, {
        amplitude: 0.055,
        enabled: animate,
        speed: 1.1,
    });
    const uniforms = useMemo(
        () => ({
            ...swayUniforms,
            ...createPlantBillboardShapeUniforms(shape),
            uOpacity: { value: 1 },
            uTint: { value: new THREE.Color('#ffffff') },
        }),
        [shape, swayUniforms],
    );
    usePlantInstanceBufferMetrics({
        extraAllocatedBytes:
            tintAttribute.array.byteLength +
            swayPhaseAttribute.array.byteLength +
            opacityAttribute.array.byteLength +
            accentAttribute.array.byteLength,
        kind: 'billboard',
        liveCount: items.length,
        meshRef,
    });

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) {
            return;
        }

        mesh.geometry.setAttribute('instanceTint', tintAttribute);
        mesh.geometry.setAttribute('instanceOpacity', opacityAttribute);
        mesh.geometry.setAttribute('instanceSwayPhase', swayPhaseAttribute);
        mesh.geometry.setAttribute('instanceAccent', accentAttribute);
        items.forEach((item, index) => {
            mesh.setMatrixAt(index, item.matrix);
            tintAttribute.setXYZ(
                index,
                item.color.r,
                item.color.g,
                item.color.b,
            );
            opacityAttribute.setX(index, 1);
            swayPhaseAttribute.setX(index, item.swayPhase);
            accentAttribute.setXYZW(
                index,
                item.accent.x,
                item.accent.y,
                item.accent.z,
                item.accent.w,
            );
        });
        finalizeStaticInstanceMatrixUpload(mesh, items.length);
        markStaticInstancedAttributeForUpload(tintAttribute, items.length);
        markStaticInstancedAttributeForUpload(opacityAttribute, items.length);
        markStaticInstancedAttributeForUpload(swayPhaseAttribute, items.length);
        markStaticInstancedAttributeForUpload(accentAttribute, items.length);
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [
        accentAttribute,
        items,
        opacityAttribute,
        swayPhaseAttribute,
        tintAttribute,
    ]);

    useLayoutEffect(() => () => geometry.dispose(), [geometry]);

    if (items.length === 0) {
        return null;
    }

    return (
        <instancedMesh
            ref={meshRef}
            name={debugName}
            args={[geometry, undefined, instanceCapacity]}
            frustumCulled={false}
        >
            <PlantCardMaterials uniforms={uniforms} />
        </instancedMesh>
    );
}

/**
 * Far and mid crops are the same leafy clump, so changing between the two
 * never changes the silhouette. The far clump paints its produce or flower
 * dots in; the mid view adds sway, breathing and the dots as cards; a plant
 * without leaves shows its stem there.
 */
export function PlantBillboardBatch({
    debugName = 'PlantBillboardBatch',
    level,
    billboards,
}: PlantBillboardBatchProps) {
    const clumpItems = useMemo(
        () =>
            billboards
                .filter(({ summary }) => level === 'far' || summary.hasFoliage)
                .map(({ position, scale, summary }) =>
                    createBillboardItem({
                        accent:
                            level === 'far'
                                ? getFarClumpAccent(summary)
                                : undefined,
                        card: getPlantBillboardClump(summary),
                        color: getClumpColor(summary),
                        position,
                        scale,
                        swayPosition: position,
                    }),
                ),
        [billboards, level],
    );
    const stemItems = useMemo(
        () =>
            level === 'mid'
                ? billboards
                      .filter(({ summary }) => !summary.hasFoliage)
                      .map(({ position, scale, summary }) =>
                          createBillboardItem({
                              card: getStemCard(summary),
                              color: summary.stemColor,
                              position,
                              scale,
                          }),
                      )
                : [],
        [billboards, level],
    );
    const accentItems = useMemo(
        () =>
            level === 'mid'
                ? billboards.flatMap(({ position, scale, summary }) =>
                      summary.accentColor
                          ? getMidBillboardAccentCards(
                                summary,
                                // The far clump lays its dots out with the
                                // same value, its instanceSwayPhase.
                                getMidBillboardSwayPhase(position),
                            ).map((card) =>
                                createBillboardItem({
                                    card,
                                    color: summary.accentColor ?? '#ffffff',
                                    position,
                                    scale,
                                    swayPosition: position,
                                }),
                            )
                          : [],
                  )
                : [],
        [billboards, level],
    );

    if (billboards.length === 0) {
        return null;
    }

    if (level === 'far') {
        return (
            <BillboardInstanceMesh
                animate={false}
                debugName={`${debugName}:far:count:${clumpItems.length}`}
                items={clumpItems}
                shape={PLANT_BILLBOARD_SHAPE.clump}
                swaySeed={`${debugName}:far`}
            />
        );
    }

    return (
        <group name={`${debugName}:mid:count:${billboards.length}`}>
            <BillboardInstanceMesh
                animate={false}
                debugName={`${debugName}:mid:stems:${stemItems.length}`}
                items={stemItems}
                shape={PLANT_BILLBOARD_SHAPE.stem}
                swaySeed={`${debugName}:mid:stems`}
            />
            <BillboardInstanceMesh
                debugName={`${debugName}:mid:foliage:${clumpItems.length}`}
                items={clumpItems}
                shape={PLANT_BILLBOARD_SHAPE.clump}
                swaySeed={`${debugName}:mid`}
            />
            <BillboardInstanceMesh
                debugName={`${debugName}:mid:accents:${accentItems.length}`}
                items={accentItems}
                shape={PLANT_BILLBOARD_SHAPE.dot}
                swaySeed={`${debugName}:mid`}
            />
        </group>
    );
}

function PlantCardMesh({
    accent,
    card,
    color,
    shape,
    swayUniforms,
}: {
    accent?: PlantBillboardAccent;
    card: PlantBillboardCard;
    color: string;
    shape: PlantBillboardShape;
    swayUniforms: ReturnType<typeof usePlantSway>;
}) {
    const accentColor = accent?.color;
    const accentSeed = accent?.seed;
    const accentValue = accent?.value;
    const uniforms = useMemo(
        () => ({
            ...swayUniforms,
            ...createPlantBillboardShapeUniforms(
                shape,
                undefined,
                accentColor === undefined ||
                    accentSeed === undefined ||
                    accentValue === undefined
                    ? undefined
                    : {
                          color: accentColor,
                          seed: accentSeed,
                          value: accentValue,
                      },
            ),
            uOpacity: { value: 1 },
            uTint: { value: new THREE.Color(color) },
        }),
        [accentColor, accentSeed, accentValue, color, shape, swayUniforms],
    );

    return (
        <mesh
            geometry={midBillboardCardGeometry}
            position={[card.centerX, card.centerY, 0]}
            scale={[card.halfWidth, card.halfHeight, 1]}
        >
            <PlantCardMaterials uniforms={uniforms} />
        </mesh>
    );
}

export function PlantBillboard({
    animate = true,
    level,
    seed,
    summary,
}: PlantBillboardProps) {
    const isMid = level === 'mid';
    const swayUniforms = usePlantSway(`${seed}:mid-billboard`, {
        amplitude: 0.055,
        breathSeed: seed,
        enabled: animate && isMid,
        speed: 1.1,
    });
    const accentSeed = useMemo(() => getPlantBillboardAccentSeed(seed), [seed]);
    const accentCards = isMid
        ? getMidBillboardAccentCards(summary, accentSeed)
        : [];

    return (
        <CameraFacingBillboard>
            {isMid && !summary.hasFoliage ? (
                <PlantCardMesh
                    card={getStemCard(summary)}
                    color={summary.stemColor}
                    shape={PLANT_BILLBOARD_SHAPE.stem}
                    swayUniforms={swayUniforms}
                />
            ) : (
                <PlantCardMesh
                    accent={
                        isMid
                            ? undefined
                            : getFarClumpAccent(summary, accentSeed)
                    }
                    card={getPlantBillboardClump(summary)}
                    color={getClumpColor(summary)}
                    shape={PLANT_BILLBOARD_SHAPE.clump}
                    swayUniforms={swayUniforms}
                />
            )}
            {summary.accentColor
                ? accentCards.map((card) => (
                      <PlantCardMesh
                          key={`${card.centerX}:${card.centerY}`}
                          card={card}
                          color={summary.accentColor ?? '#ffffff'}
                          shape={PLANT_BILLBOARD_SHAPE.dot}
                          swayUniforms={swayUniforms}
                      />
                  ))
                : null}
        </CameraFacingBillboard>
    );
}
