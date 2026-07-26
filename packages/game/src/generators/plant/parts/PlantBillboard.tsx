'use client';

import { useThree } from '@react-three/fiber';
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
    getMidBillboardSwayPhase,
    midBillboardCardGeometry,
    midBillboardFragmentShader,
    midBillboardVertexShader,
} from '../lib/plantMidBillboardMaterial';

export interface PlantBillboardSummary {
    accentCenterY: number;
    accentColor?: string;
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
    color: THREE.Color;
    matrix: THREE.Matrix4;
    opacity: number;
    swayPhase: number;
}

interface BillboardInstanceMeshProps {
    debugName: string;
    geometry: THREE.BufferGeometry;
    items: BillboardInstanceItem[];
    opacity: number;
}

interface MidBillboardInstanceMeshProps
    extends Omit<BillboardInstanceMeshProps, 'opacity'> {
    swaySeed: string;
}

const BILLBOARD_IDENTITY_QUATERNION = new THREE.Quaternion();
const billboardPlaneGeometry = new THREE.PlaneGeometry(1, 1);

export const billboardVertexShader = /* glsl */ `
    attribute vec3 instanceTint;

    varying vec3 vInstanceTint;

    void main() {
        vInstanceTint = instanceTint;

        vec4 instanceCenter = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 instanceOffset = (instanceMatrix * vec4(position, 0.0)).xyz;
        vec4 mvPosition = modelViewMatrix * instanceCenter;
        mvPosition.xy += instanceOffset.xy;
        mvPosition.z += instanceOffset.z;

        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const billboardFragmentShader = /* glsl */ `
    uniform float uOpacity;

    varying vec3 vInstanceTint;

    void main() {
        gl_FragColor = vec4(vInstanceTint, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

function CameraFacingBillboard({ children }: PropsWithChildren) {
    const groupRef = useRef<THREE.Group>(null);
    const camera = useThree((state) => state.camera);
    const gameCamera = useGameState((state) => state.gameCamera);

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

    return <group ref={groupRef}>{children}</group>;
}

function createBillboardItem({
    color,
    height,
    opacity = 1,
    position,
    radius,
    swayPosition,
    width,
}: {
    color: string;
    height: number;
    opacity?: number;
    position: readonly [number, number, number];
    radius?: number;
    swayPosition?: readonly [number, number, number];
    width?: number;
}) {
    const scaleX = radius ?? width ?? 1;
    const scaleY = radius ?? height;

    return {
        color: new THREE.Color(color),
        matrix: new THREE.Matrix4().compose(
            new THREE.Vector3(...position),
            BILLBOARD_IDENTITY_QUATERNION,
            new THREE.Vector3(scaleX, scaleY, 1),
        ),
        opacity,
        swayPhase:
            swayPosition === undefined
                ? 0
                : getMidBillboardSwayPhase(swayPosition),
    } satisfies BillboardInstanceItem;
}

function BillboardInstanceMesh({
    debugName,
    geometry: sourceGeometry,
    items,
    opacity,
}: BillboardInstanceMeshProps) {
    const meshRef = useRef<THREE.InstancedMesh | null>(null);
    const instanceCapacity = items.length;
    const geometry = useMemo(() => sourceGeometry.clone(), [sourceGeometry]);
    const tintAttribute = useMemo(
        () => createStaticInstancedBufferAttribute(instanceCapacity, 3),
        [instanceCapacity],
    );
    const uniforms = useMemo(
        () => ({
            uOpacity: { value: opacity },
        }),
        [opacity],
    );
    usePlantInstanceBufferMetrics({
        extraAllocatedBytes: tintAttribute.array.byteLength,
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
        items.forEach((item, index) => {
            mesh.setMatrixAt(index, item.matrix);
            tintAttribute.setXYZ(
                index,
                item.color.r,
                item.color.g,
                item.color.b,
            );
        });
        finalizeStaticInstanceMatrixUpload(mesh, items.length);
        markStaticInstancedAttributeForUpload(tintAttribute, items.length);
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [items, tintAttribute]);

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
            <shaderMaterial
                depthWrite={false}
                fragmentShader={billboardFragmentShader}
                transparent
                uniforms={uniforms}
                vertexShader={billboardVertexShader}
            />
        </instancedMesh>
    );
}

function MidBillboardInstanceMesh({
    debugName,
    geometry: sourceGeometry,
    items,
    swaySeed,
}: MidBillboardInstanceMeshProps) {
    const meshRef = useRef<THREE.InstancedMesh | null>(null);
    const instanceCapacity = items.length;
    const geometry = useMemo(() => sourceGeometry.clone(), [sourceGeometry]);
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
    const swayUniforms = usePlantSway(swaySeed, {
        amplitude: 0.055,
        speed: 1.1,
    });
    const uniforms = useMemo(
        () => ({
            ...swayUniforms,
            uOpacity: { value: 1 },
            uTint: { value: new THREE.Color('#ffffff') },
        }),
        [swayUniforms],
    );
    usePlantInstanceBufferMetrics({
        extraAllocatedBytes:
            tintAttribute.array.byteLength +
            swayPhaseAttribute.array.byteLength +
            opacityAttribute.array.byteLength,
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
        items.forEach((item, index) => {
            mesh.setMatrixAt(index, item.matrix);
            tintAttribute.setXYZ(
                index,
                item.color.r,
                item.color.g,
                item.color.b,
            );
            opacityAttribute.setX(index, item.opacity);
            swayPhaseAttribute.setX(index, item.swayPhase);
        });
        finalizeStaticInstanceMatrixUpload(mesh, items.length);
        markStaticInstancedAttributeForUpload(tintAttribute, items.length);
        markStaticInstancedAttributeForUpload(opacityAttribute, items.length);
        markStaticInstancedAttributeForUpload(swayPhaseAttribute, items.length);
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
    }, [items, opacityAttribute, swayPhaseAttribute, tintAttribute]);

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
            <CSM
                baseMaterial={THREE.MeshLambertMaterial}
                depthWrite={false}
                fragmentShader={midBillboardFragmentShader}
                side={THREE.FrontSide}
                transparent
                uniforms={uniforms}
                vertexShader={midBillboardVertexShader}
            />
        </instancedMesh>
    );
}

export function PlantBillboardBatch({
    debugName = 'PlantBillboardBatch',
    level,
    billboards,
}: PlantBillboardBatchProps) {
    const farItems = useMemo(() => {
        if (level !== 'far') {
            return [];
        }

        return billboards.map(({ position, scale, summary }) =>
            createBillboardItem({
                color: summary.dominantColor,
                height: Math.max(summary.height * 0.72, 0.18) * scale,
                position: [
                    position[0],
                    position[1] + summary.height * 0.5 * scale,
                    position[2],
                ],
                width: Math.max(summary.canopyWidth * 0.42, 0.12) * scale,
            }),
        );
    }, [billboards, level]);
    const midStemItems = useMemo(() => {
        if (level !== 'mid') {
            return [];
        }

        return billboards.map(({ position, scale, summary }) =>
            createBillboardItem({
                color: summary.stemColor,
                height: Math.max(summary.height * 0.9, 0.2) * scale,
                position: [
                    position[0],
                    position[1] + summary.height * 0.42 * scale,
                    position[2] - 0.02 * scale,
                ],
                width: Math.max(summary.stemWidth, 0.06) * scale,
            }),
        );
    }, [billboards, level]);
    const midCanopyPrimaryItems = useMemo(() => {
        if (level !== 'mid') {
            return [];
        }

        return billboards
            .filter((billboard) => billboard.summary.hasFoliage)
            .map(({ position, scale, summary }) =>
                createBillboardItem({
                    color: summary.foliageColor,
                    height: 1,
                    position: [
                        position[0] - summary.canopyWidth * 0.08 * scale,
                        position[1] + summary.canopyCenterY * scale,
                        position[2],
                    ],
                    opacity: 0.88,
                    radius: Math.max(summary.canopyWidth * 0.28, 0.16) * scale,
                    swayPosition: position,
                }),
            );
    }, [billboards, level]);
    const midCanopySecondaryItems = useMemo(() => {
        if (level !== 'mid') {
            return [];
        }

        return billboards
            .filter((billboard) => billboard.summary.hasFoliage)
            .map(({ position, scale, summary }) =>
                createBillboardItem({
                    color: summary.foliageColor,
                    height: 1,
                    position: [
                        position[0] + summary.canopyWidth * 0.1 * scale,
                        position[1] +
                            (summary.canopyCenterY + summary.height * 0.06) *
                                scale,
                        position[2] + 0.01 * scale,
                    ],
                    opacity: 0.78,
                    radius: Math.max(summary.canopyWidth * 0.24, 0.14) * scale,
                    swayPosition: position,
                }),
            );
    }, [billboards, level]);
    const midAccentItems = useMemo(() => {
        if (level !== 'mid') {
            return [];
        }

        return billboards
            .filter(
                (
                    billboard,
                ): billboard is PlantBillboardBatchItem & {
                    summary: PlantBillboardSummary & { accentColor: string };
                } => Boolean(billboard.summary.accentColor),
            )
            .map(({ position, scale, summary }) =>
                createBillboardItem({
                    color: summary.accentColor,
                    height: 1,
                    position: [
                        position[0],
                        position[1] + summary.accentCenterY * scale,
                        position[2] + 0.02 * scale,
                    ],
                    opacity: 0.95,
                    radius: Math.max(summary.canopyWidth * 0.1, 0.07) * scale,
                    swayPosition: position,
                }),
            );
    }, [billboards, level]);
    const midFoliageItems = useMemo(
        () => [
            ...midCanopyPrimaryItems,
            ...midCanopySecondaryItems,
            ...midAccentItems,
        ],
        [midAccentItems, midCanopyPrimaryItems, midCanopySecondaryItems],
    );

    if (billboards.length === 0) {
        return null;
    }

    if (level === 'far') {
        return (
            <BillboardInstanceMesh
                debugName={`${debugName}:far:count:${farItems.length}`}
                geometry={billboardPlaneGeometry}
                items={farItems}
                opacity={0.84}
            />
        );
    }

    return (
        <group name={`${debugName}:mid:count:${billboards.length}`}>
            <BillboardInstanceMesh
                debugName={`${debugName}:mid:stems:${midStemItems.length}`}
                geometry={billboardPlaneGeometry}
                items={midStemItems}
                opacity={0.9}
            />
            {midFoliageItems.length > 0 ? (
                <MidBillboardInstanceMesh
                    debugName={`${debugName}:mid:foliage:${midFoliageItems.length}`}
                    geometry={midBillboardCardGeometry}
                    items={midFoliageItems}
                    swaySeed={`${debugName}:mid`}
                />
            ) : null}
        </group>
    );
}

function MidPlantBillboard({
    animate,
    seed,
    summary,
}: {
    animate: boolean;
    seed: string;
    summary: PlantBillboardSummary;
}) {
    const swayUniforms = usePlantSway(`${seed}:mid-billboard`, {
        amplitude: 0.055,
        enabled: animate,
        speed: 1.1,
    });
    const uniforms = useMemo(
        () => ({
            accent: {
                ...swayUniforms,
                uOpacity: { value: 0.95 },
                uTint: {
                    value: new THREE.Color(summary.accentColor ?? '#ffffff'),
                },
            },
            primary: {
                ...swayUniforms,
                uOpacity: { value: 0.88 },
                uTint: { value: new THREE.Color(summary.foliageColor) },
            },
            secondary: {
                ...swayUniforms,
                uOpacity: { value: 0.78 },
                uTint: { value: new THREE.Color(summary.foliageColor) },
            },
        }),
        [summary.accentColor, summary.foliageColor, swayUniforms],
    );

    return (
        <group>
            <mesh position={[0, summary.height * 0.42, -0.02]}>
                <planeGeometry
                    args={[
                        Math.max(summary.stemWidth, 0.06),
                        Math.max(summary.height * 0.9, 0.2),
                    ]}
                />
                <meshBasicMaterial
                    color={summary.stemColor}
                    transparent
                    opacity={0.9}
                    depthWrite={false}
                />
            </mesh>
            {summary.hasFoliage ? (
                <group>
                    <mesh
                        position={[
                            -summary.canopyWidth * 0.08,
                            summary.canopyCenterY,
                            0,
                        ]}
                    >
                        <planeGeometry
                            args={[
                                Math.max(summary.canopyWidth * 0.28, 0.16) * 2,
                                Math.max(summary.canopyWidth * 0.28, 0.16) * 2,
                            ]}
                        />
                        <CSM
                            baseMaterial={THREE.MeshLambertMaterial}
                            depthWrite={false}
                            fragmentShader={midBillboardFragmentShader}
                            side={THREE.FrontSide}
                            transparent
                            uniforms={uniforms.primary}
                            vertexShader={midBillboardVertexShader}
                        />
                    </mesh>
                    <mesh
                        position={[
                            summary.canopyWidth * 0.1,
                            summary.canopyCenterY + summary.height * 0.06,
                            0.01,
                        ]}
                    >
                        <planeGeometry
                            args={[
                                Math.max(summary.canopyWidth * 0.24, 0.14) * 2,
                                Math.max(summary.canopyWidth * 0.24, 0.14) * 2,
                            ]}
                        />
                        <CSM
                            baseMaterial={THREE.MeshLambertMaterial}
                            depthWrite={false}
                            fragmentShader={midBillboardFragmentShader}
                            side={THREE.FrontSide}
                            transparent
                            uniforms={uniforms.secondary}
                            vertexShader={midBillboardVertexShader}
                        />
                    </mesh>
                </group>
            ) : null}
            {summary.accentColor ? (
                <mesh position={[0, summary.accentCenterY, 0.02]}>
                    <planeGeometry
                        args={[
                            Math.max(summary.canopyWidth * 0.1, 0.07) * 2,
                            Math.max(summary.canopyWidth * 0.1, 0.07) * 2,
                        ]}
                    />
                    <CSM
                        baseMaterial={THREE.MeshLambertMaterial}
                        depthWrite={false}
                        fragmentShader={midBillboardFragmentShader}
                        side={THREE.FrontSide}
                        transparent
                        uniforms={uniforms.accent}
                        vertexShader={midBillboardVertexShader}
                    />
                </mesh>
            ) : null}
        </group>
    );
}

export function PlantBillboard({
    animate = true,
    level,
    seed,
    summary,
}: PlantBillboardProps) {
    const farColor = useMemo(
        () => new THREE.Color(summary.dominantColor),
        [summary.dominantColor],
    );

    return (
        <CameraFacingBillboard>
            {level === 'mid' ? (
                <MidPlantBillboard
                    animate={animate}
                    seed={seed}
                    summary={summary}
                />
            ) : (
                <mesh position={[0, summary.height * 0.5, 0]}>
                    <planeGeometry
                        args={[
                            Math.max(summary.canopyWidth * 0.42, 0.12),
                            Math.max(summary.height * 0.72, 0.18),
                        ]}
                    />
                    <meshBasicMaterial
                        color={farColor}
                        transparent
                        opacity={0.84}
                        depthWrite={false}
                    />
                </mesh>
            )}
        </CameraFacingBillboard>
    );
}
