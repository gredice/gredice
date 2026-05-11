'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
    CanvasTexture,
    ClampToEdgeWrapping,
    DoubleSide,
    LinearFilter,
    MathUtils,
    type Mesh,
    type MeshBasicMaterial,
    type OrthographicCamera,
} from 'three';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';

const MAX_CLOUDS = 8;
const CLOUD_ALPHA_TEST = 0.025;
const CLOUD_MARGIN = 12;
const CLOUD_WORLD_ALTITUDE = 10;
const CLOUD_ALTITUDE_VARIATION = 4;
const CLOUD_TRAVEL_MARGIN = 18;
const CLOUD_SPAWN_HALF_WIDTH_FACTOR = 1.05;
const CLOUD_SPAWN_HALF_HEIGHT_FACTOR = 1.35;
const CLOUD_DESPAWN_MULTIPLIER = 2.4;
const CLOUD_FADE_IN_DURATION = 2.4;
const CLOUD_FADE_OUT_DURATION = 1.25;
const CLOUD_BASE_SCALE = 0.72;
const CLOUD_SCALE_RANGE = 0.28;
const CLOUD_MIN_COVERAGE_SCALE = 0.62;
const CLOUD_MAX_COVERAGE_SCALE = 1.14;
const CLOUD_BASE_DRIFT_SPEED = 0.35;
const CLOUD_WIND_DRIFT_SPEED = 0.5;

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function seededRandom(seed: number) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}

function wrapValue(value: number, min: number, max: number) {
    const range = max - min;
    return MathUtils.euclideanModulo(value - min, range) + min;
}

function createCloudAlphaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }

    context.fillStyle = 'rgb(0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < 8; index += 1) {
        const seed = 11.7 + index * 23.1;
        const x = MathUtils.lerp(54, 202, seededRandom(seed));
        const y = MathUtils.lerp(72, 184, seededRandom(seed + 1));
        const radius = MathUtils.lerp(34, 72, seededRandom(seed + 2));
        const gradient = context.createRadialGradient(
            x,
            y,
            radius * 0.18,
            x,
            y,
            radius,
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.94)');
        gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.74)');
        gradient.addColorStop(0.68, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.88, 'rgba(255, 255, 255, 0.08)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }

    const texture = new CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
}

function getCloudBounds(stacks: Stack[] | undefined) {
    if (!stacks?.length) {
        return {
            centerX: 0,
            centerZ: 0,
            maxX: 18,
            maxZ: 18,
            minX: -18,
            minZ: -18,
            spanX: 36,
            spanZ: 36,
        };
    }

    const xs = stacks.map((stack) => stack.position.x);
    const zs = stacks.map((stack) => stack.position.z);
    const minX = Math.min(...xs) - CLOUD_MARGIN;
    const maxX = Math.max(...xs) + CLOUD_MARGIN;
    const minZ = Math.min(...zs) - CLOUD_MARGIN;
    const maxZ = Math.max(...zs) + CLOUD_MARGIN;

    return {
        centerX: (minX + maxX) / 2,
        centerZ: (minZ + maxZ) / 2,
        maxX,
        maxZ,
        minX,
        minZ,
        spanX: maxX - minX,
        spanZ: maxZ - minZ,
    };
}

type CloudLayerProps = {
    cloudy: number;
    foggy: number;
    shadowStrength: number;
    stacks: Stack[] | undefined;
    timeOfDay: number;
    windDirection: number;
    windSpeed: number;
};

type CloudDefinition = {
    altitude: number;
    driftScale: number;
    id: string;
    laneX: number;
    laneZ: number;
    opacityScale: number;
    phase: number;
    sizeScale: number;
    tint: string;
    wanderScale: number;
    width: number;
    height: number;
};

type CloudSlot = {
    active: boolean;
    baseX: number;
    baseZ: number;
    cooldownUntil: number;
    targetVisibility: number;
    visibility: number;
};

function createCloudSlot(index: number): CloudSlot {
    return {
        active: false,
        baseX: 0,
        baseZ: 0,
        cooldownUntil: index * 0.28,
        targetVisibility: 0,
        visibility: 0,
    };
}

function spawnCloud(
    slot: CloudSlot,
    cloud: CloudDefinition,
    focusX: number,
    focusZ: number,
    spawnHalfX: number,
    spawnHalfZ: number,
) {
    const jitterX = MathUtils.lerp(
        -spawnHalfX * 0.35,
        spawnHalfX * 0.35,
        Math.random(),
    );
    const jitterZ = MathUtils.lerp(
        -spawnHalfZ * 0.35,
        spawnHalfZ * 0.35,
        Math.random(),
    );
    slot.active = true;
    slot.baseX = MathUtils.clamp(
        focusX + cloud.laneX * spawnHalfX * 0.65 + jitterX,
        focusX - spawnHalfX,
        focusX + spawnHalfX,
    );
    slot.baseZ = MathUtils.clamp(
        focusZ + cloud.laneZ * spawnHalfZ * 0.65 + jitterZ,
        focusZ - spawnHalfZ,
        focusZ + spawnHalfZ,
    );
    slot.targetVisibility = 1;
    slot.visibility = 0;
}

export function CloudLayer({
    cloudy,
    foggy,
    shadowStrength,
    stacks,
    timeOfDay,
    windDirection,
    windSpeed,
}: CloudLayerProps) {
    const cloudRefs = useRef<Array<Mesh | null>>([]);
    const materialRefs = useRef<Array<MeshBasicMaterial | null>>([]);
    const cloudSlotsRef = useRef<Array<CloudSlot>>([]);
    const orbitControls = useGameState((state) => state.orbitControls);
    const cloudAlphaTexture = useMemo(
        () =>
            typeof document === 'undefined' ? null : createCloudAlphaTexture(),
        [],
    );

    useEffect(() => {
        return () => {
            cloudAlphaTexture?.dispose();
        };
    }, [cloudAlphaTexture]);

    const bounds = useMemo(() => getCloudBounds(stacks), [stacks]);
    const effectiveCloudiness = Math.min(1, cloudy + foggy * 0.35);
    const daylightVisibility = Math.min(
        smoothstep(0.18, 0.28, timeOfDay),
        1 - smoothstep(0.72, 0.82, timeOfDay),
    );
    const visibleCloudiness = daylightVisibility * effectiveCloudiness;

    const visibleCloudCount =
        visibleCloudiness < 0.04
            ? 0
            : visibleCloudiness < 0.1
              ? 2
              : visibleCloudiness < 0.18
                ? 3
                : visibleCloudiness < 0.3
                  ? 4
                  : visibleCloudiness < 0.45
                    ? 6
                    : visibleCloudiness < 0.62
                      ? 7
                      : MAX_CLOUDS;
    const coverageScale = MathUtils.lerp(
        CLOUD_MIN_COVERAGE_SCALE,
        CLOUD_MAX_COVERAGE_SCALE,
        smoothstep(0.08, 0.78, visibleCloudiness),
    );
    const shadowCasterCount = Math.min(
        visibleCloudCount,
        Math.round(visibleCloudCount * Math.max(0, shadowStrength)),
    );
    const visibleOpacity =
        daylightVisibility * (0.2 + effectiveCloudiness * 0.26 + foggy * 0.035);
    const windStrength = Math.min(1.4, Math.max(0, windSpeed / 12));

    const cloudDefinitions = useMemo<Array<CloudDefinition>>(
        () =>
            Array.from({ length: MAX_CLOUDS }, (_, index) => {
                const seed = (stacks?.length ?? 0) * 0.61 + index * 19.37 + 3.1;
                return {
                    altitude:
                        CLOUD_WORLD_ALTITUDE +
                        (seededRandom(seed) - 0.5) * CLOUD_ALTITUDE_VARIATION,
                    driftScale: 0.55 + seededRandom(seed + 1) * 0.45,
                    id: `cloud-slot-${index}-${seed.toFixed(3)}`,
                    laneX: MathUtils.lerp(-0.72, 0.72, seededRandom(seed + 2)),
                    laneZ: MathUtils.lerp(-0.68, 0.68, seededRandom(seed + 3)),
                    opacityScale: 1.05 + seededRandom(seed + 4) * 0.4,
                    phase: seededRandom(seed + 5) * Math.PI * 2,
                    sizeScale: 0.78 + seededRandom(seed + 5.5) * 0.34,
                    tint: seededRandom(seed + 6) > 0.5 ? '#edf2f7' : '#c9d5e0',
                    wanderScale: 0.55 + seededRandom(seed + 7) * 0.7,
                    width: 11 + seededRandom(seed + 8) * 9,
                    height: 6.2 + seededRandom(seed + 9) * 4,
                };
            }),
        [stacks],
    );

    if (cloudSlotsRef.current.length !== MAX_CLOUDS) {
        cloudSlotsRef.current = Array.from(
            { length: MAX_CLOUDS },
            (_, index) =>
                cloudSlotsRef.current[index] ?? createCloudSlot(index),
        );
    }

    useFrame(({ camera, clock }, delta) => {
        const orthographic = camera as OrthographicCamera;
        if (!orthographic.isOrthographicCamera) {
            return;
        }

        const elapsed = clock.elapsedTime;
        const focusX = orbitControls?.target.x ?? bounds.centerX;
        const focusZ = orbitControls?.target.z ?? bounds.centerZ;
        const viewportWidth =
            (orthographic.right - orthographic.left) / orthographic.zoom;
        const viewportHeight =
            (orthographic.top - orthographic.bottom) / orthographic.zoom;
        const spawnHalfX = Math.max(
            10,
            viewportWidth * CLOUD_SPAWN_HALF_WIDTH_FACTOR,
        );
        const spawnHalfZ = Math.max(
            8,
            viewportHeight * CLOUD_SPAWN_HALF_HEIGHT_FACTOR,
        );
        const despawnHalfX = spawnHalfX * CLOUD_DESPAWN_MULTIPLIER;
        const despawnHalfZ = spawnHalfZ * CLOUD_DESPAWN_MULTIPLIER;

        const windDirectionRadians = (windDirection * Math.PI) / 180;
        const windX = Math.sin(windDirectionRadians);
        const windZ = -Math.cos(windDirectionRadians);
        const crossX = -windZ;
        const crossZ = windX;
        const driftSpeed =
            (CLOUD_BASE_DRIFT_SPEED + windStrength * CLOUD_WIND_DRIFT_SPEED) *
            0.5;
        const travelRangeX = Math.max(
            28,
            bounds.spanX + CLOUD_TRAVEL_MARGIN * 2,
        );
        const travelRangeZ = Math.max(
            24,
            bounds.spanZ + CLOUD_TRAVEL_MARGIN * 2,
        );
        const wrapMinX = bounds.centerX - travelRangeX;
        const wrapMaxX = bounds.centerX + travelRangeX;
        const wrapMinZ = bounds.centerZ - travelRangeZ;
        const wrapMaxZ = bounds.centerZ + travelRangeZ;
        for (let index = 0; index < MAX_CLOUDS; index += 1) {
            const mesh = cloudRefs.current[index];
            const material = materialRefs.current[index];
            const cloud = cloudDefinitions[index];
            const slot = cloudSlotsRef.current[index];
            const shouldBeVisible = index < visibleCloudCount;
            if (
                shouldBeVisible &&
                !slot.active &&
                elapsed >= slot.cooldownUntil
            ) {
                spawnCloud(slot, cloud, focusX, focusZ, spawnHalfX, spawnHalfZ);
            }

            if (
                slot.active &&
                shouldBeVisible &&
                (Math.abs(slot.baseX - focusX) > despawnHalfX ||
                    Math.abs(slot.baseZ - focusZ) > despawnHalfZ)
            ) {
                slot.targetVisibility = 0;
            } else if (slot.active) {
                slot.targetVisibility = shouldBeVisible ? 1 : 0;
            }

            if (!slot.active) {
                if (mesh) {
                    mesh.visible = false;
                }
                if (material) {
                    material.opacity = 0;
                }
                continue;
            }

            const fadeDuration =
                slot.targetVisibility > slot.visibility
                    ? CLOUD_FADE_IN_DURATION
                    : CLOUD_FADE_OUT_DURATION;
            const fadeStep = fadeDuration > 0 ? 1 / fadeDuration : 1;
            if (slot.targetVisibility > slot.visibility) {
                slot.visibility = Math.min(
                    1,
                    slot.visibility + delta * fadeStep,
                );
            } else if (slot.targetVisibility < slot.visibility) {
                slot.visibility = Math.max(
                    0,
                    slot.visibility - delta * fadeStep,
                );
            }

            if (slot.targetVisibility <= 0 && slot.visibility <= 0.001) {
                slot.active = false;
                slot.cooldownUntil = elapsed + 0.3 + Math.random() * 0.6;
                if (mesh) {
                    mesh.visible = false;
                }
                if (material) {
                    material.opacity = 0;
                }
                continue;
            }

            slot.baseX = wrapValue(
                slot.baseX + windX * driftSpeed * cloud.driftScale * delta,
                wrapMinX,
                wrapMaxX,
            );
            slot.baseZ = wrapValue(
                slot.baseZ + windZ * driftSpeed * cloud.driftScale * delta,
                wrapMinZ,
                wrapMaxZ,
            );
            const wander =
                Math.sin(elapsed * (0.06 + windStrength * 0.08) + cloud.phase) *
                cloud.wanderScale *
                (0.12 + windStrength * 0.22);

            const x = wrapValue(
                slot.baseX +
                    crossX * wander +
                    Math.sin(elapsed * 0.035 + cloud.phase) *
                        cloud.wanderScale *
                        0.2,
                wrapMinX,
                wrapMaxX,
            );
            const z = wrapValue(
                slot.baseZ +
                    crossZ * wander +
                    Math.cos(elapsed * 0.032 + cloud.phase) *
                        cloud.wanderScale *
                        0.18,
                wrapMinZ,
                wrapMaxZ,
            );
            const y =
                cloud.altitude +
                Math.sin(elapsed * 0.12 + cloud.phase) *
                    (0.04 + windStrength * 0.04);

            if (mesh) {
                mesh.visible = true;
                mesh.position.set(x, y, z);
                mesh.quaternion.copy(camera.quaternion);
                const scale =
                    (CLOUD_BASE_SCALE + slot.visibility * CLOUD_SCALE_RANGE) *
                    cloud.sizeScale *
                    coverageScale;
                mesh.scale.setScalar(scale);
            }
            if (material) {
                material.opacity =
                    visibleOpacity * cloud.opacityScale * slot.visibility;
            }
        }
    });

    if (!cloudAlphaTexture || visibleOpacity <= 0.005) {
        return null;
    }

    return (
        <>
            {cloudDefinitions.map((cloud, index) => (
                <mesh
                    key={cloud.id}
                    castShadow={index < shadowCasterCount}
                    frustumCulled={false}
                    ref={(mesh) => {
                        cloudRefs.current[index] = mesh;
                    }}
                >
                    <planeGeometry args={[cloud.width, cloud.height]} />
                    <meshDepthMaterial attach="customDepthMaterial" alphaHash />
                    <meshBasicMaterial
                        alphaMap={cloudAlphaTexture}
                        alphaTest={CLOUD_ALPHA_TEST}
                        color={cloud.tint}
                        depthWrite={false}
                        fog={false}
                        opacity={0}
                        ref={(material) => {
                            materialRefs.current[index] = material;
                        }}
                        side={DoubleSide}
                        toneMapped={false}
                        transparent
                    />
                </mesh>
            ))}
        </>
    );
}
