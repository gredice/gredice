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
import { useGameState } from '../../../useGameState';
import type { PlantLodLevel } from '../lib/plantLod';

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
    level: Exclude<PlantLodLevel, 'near'>;
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
}

interface BillboardInstanceMeshProps {
    debugName: string;
    geometry: THREE.BufferGeometry;
    items: BillboardInstanceItem[];
    opacity: number;
}

const BILLBOARD_IDENTITY_QUATERNION = new THREE.Quaternion();
const billboardPlaneGeometry = new THREE.PlaneGeometry(1, 1);
const billboardCircleGeometry = new THREE.CircleGeometry(1, 18);

const billboardVertexShader = /* glsl */ `
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

const billboardFragmentShader = /* glsl */ `
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
    position,
    radius,
    width,
}: {
    color: string;
    height: number;
    position: readonly [number, number, number];
    radius?: number;
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
    } satisfies BillboardInstanceItem;
}

function BillboardInstanceMesh({
    debugName,
    geometry: sourceGeometry,
    items,
    opacity,
}: BillboardInstanceMeshProps) {
    const meshRef = useRef<THREE.InstancedMesh | null>(null);
    const instanceCapacity = Math.max(items.length, 1);
    const geometry = useMemo(() => sourceGeometry.clone(), [sourceGeometry]);
    const tintAttribute = useMemo(() => {
        const attribute = new THREE.InstancedBufferAttribute(
            new Float32Array(instanceCapacity * 3),
            3,
        );
        attribute.setUsage(THREE.DynamicDrawUsage);
        return attribute;
    }, [instanceCapacity]);
    const uniforms = useMemo(
        () => ({
            uOpacity: { value: opacity },
        }),
        [opacity],
    );

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
        mesh.count = items.length;
        mesh.visible = items.length > 0;
        mesh.instanceMatrix.needsUpdate = true;
        tintAttribute.needsUpdate = true;
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
                    radius: Math.max(summary.canopyWidth * 0.28, 0.16) * scale,
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
                    radius: Math.max(summary.canopyWidth * 0.24, 0.14) * scale,
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
                    radius: Math.max(summary.canopyWidth * 0.1, 0.07) * scale,
                }),
            );
    }, [billboards, level]);

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
            <BillboardInstanceMesh
                debugName={`${debugName}:mid:canopyA:${midCanopyPrimaryItems.length}`}
                geometry={billboardCircleGeometry}
                items={midCanopyPrimaryItems}
                opacity={0.88}
            />
            <BillboardInstanceMesh
                debugName={`${debugName}:mid:canopyB:${midCanopySecondaryItems.length}`}
                geometry={billboardCircleGeometry}
                items={midCanopySecondaryItems}
                opacity={0.78}
            />
            <BillboardInstanceMesh
                debugName={`${debugName}:mid:accents:${midAccentItems.length}`}
                geometry={billboardCircleGeometry}
                items={midAccentItems}
                opacity={0.95}
            />
        </group>
    );
}

export function PlantBillboard({ level, summary }: PlantBillboardProps) {
    const farColor = useMemo(
        () => new THREE.Color(summary.dominantColor),
        [summary.dominantColor],
    );

    return (
        <CameraFacingBillboard>
            {level === 'mid' ? (
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
                                <circleGeometry
                                    args={[
                                        Math.max(
                                            summary.canopyWidth * 0.28,
                                            0.16,
                                        ),
                                        18,
                                    ]}
                                />
                                <meshBasicMaterial
                                    color={summary.foliageColor}
                                    transparent
                                    opacity={0.88}
                                    depthWrite={false}
                                />
                            </mesh>
                            <mesh
                                position={[
                                    summary.canopyWidth * 0.1,
                                    summary.canopyCenterY +
                                        summary.height * 0.06,
                                    0.01,
                                ]}
                            >
                                <circleGeometry
                                    args={[
                                        Math.max(
                                            summary.canopyWidth * 0.24,
                                            0.14,
                                        ),
                                        18,
                                    ]}
                                />
                                <meshBasicMaterial
                                    color={summary.foliageColor}
                                    transparent
                                    opacity={0.78}
                                    depthWrite={false}
                                />
                            </mesh>
                        </group>
                    ) : null}
                    {summary.accentColor ? (
                        <mesh position={[0, summary.accentCenterY, 0.02]}>
                            <circleGeometry
                                args={[
                                    Math.max(summary.canopyWidth * 0.1, 0.07),
                                    16,
                                ]}
                            />
                            <meshBasicMaterial
                                color={summary.accentColor}
                                transparent
                                opacity={0.95}
                                depthWrite={false}
                            />
                        </mesh>
                    ) : null}
                </group>
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
