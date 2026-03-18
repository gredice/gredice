import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { VegetableData } from '../parts/vegetables';
import { vegetableMaterialProps } from '../parts/vegetables';
import type { LSystemSymbol } from './l-system';
import {
    defaultSupportDefinition,
    defaultThornDefinition,
    MAX_PLANT_GENERATION,
    type PlantDefinition,
    type SupportDefinition,
    TERMINAL_LEAF_SYMBOL,
    TERMINAL_STEM_SYMBOL,
} from './plant-definitions';
import { SeededRNG } from './rng';

const RADIAL_SEGMENTS = 5;
const STEM_CURVE_SUBDIVISIONS = 4;
const STEM_UP = new THREE.Vector3(0, 1, 0);
const STEM_PITCH_AXIS = new THREE.Vector3(1, 0, 0);
const STEM_YAW_AXIS = new THREE.Vector3(0, 1, 0);
const STEM_ROLL_AXIS = new THREE.Vector3(0, 0, 1);
const MIN_SEGMENT_LENGTH = 0.001;
const MIN_LEAF_SIZE = 0.01;
const FLOWER_MATURITY_WINDOW = 2;

interface StemPathPoint {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    radius: number;
}

export interface PlantLodSummary {
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

export interface PlantRenderData {
    supportGeometry: THREE.BufferGeometry;
    stemGeometry: THREE.BufferGeometry;
    leaves: THREE.Matrix4[];
    leafColors: THREE.Color[];
    flowers: THREE.Matrix4[];
    vegetables: VegetableData[];
    thorns: THREE.Matrix4[];
    lodSummary: PlantLodSummary;
}

interface BuildPlantRenderDataOptions {
    flowerGrowth: number;
    fruitGrowth: number;
    generation: number;
    lSystemSymbols: LSystemSymbol[];
    plantDefinition: PlantDefinition;
    renderDetailedGeometry: boolean;
    seed: string;
    showFlowers?: boolean;
    showLeaves?: boolean;
    showProduce?: boolean;
}

function createStemTubeGeometry(path: StemPathPoint[]): THREE.BufferGeometry {
    if (path.length < 2) {
        return new THREE.BufferGeometry();
    }

    const curve = new THREE.CatmullRomCurve3(
        path.map((point) => point.position),
        false,
        'centripetal',
    );
    const sampleCount = Math.max(
        (path.length - 1) * STEM_CURVE_SUBDIVISIONS,
        RADIAL_SEGMENTS + 1,
    );
    const sampledPath = Array.from({ length: sampleCount + 1 }, (_, index) => {
        const t = index / sampleCount;
        const pathIndex = t * (path.length - 1);
        const startIndex = Math.floor(pathIndex);
        const endIndex = Math.min(startIndex + 1, path.length - 1);
        const interpolation = pathIndex - startIndex;

        return {
            position: curve.getPointAt(t),
            quaternion: new THREE.Quaternion().setFromUnitVectors(
                STEM_UP,
                curve.getTangentAt(t).normalize(),
            ),
            radius: THREE.MathUtils.lerp(
                path[startIndex].radius,
                path[endIndex].radius,
                interpolation,
            ),
        };
    });

    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let pathIndex = 0; pathIndex < sampledPath.length; pathIndex++) {
        const { position, quaternion, radius } = sampledPath[pathIndex];

        for (
            let radialIndex = 0;
            radialIndex <= RADIAL_SEGMENTS;
            radialIndex++
        ) {
            const angle = (radialIndex / RADIAL_SEGMENTS) * Math.PI * 2;
            const localOffset = new THREE.Vector3(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius,
            );
            localOffset.applyQuaternion(quaternion);

            vertices.push(
                position.x + localOffset.x,
                position.y + localOffset.y,
                position.z + localOffset.z,
            );

            if (radius > 0) {
                const normal = localOffset.normalize();
                normals.push(normal.x, normal.y, normal.z);
            } else {
                const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(
                    quaternion,
                );
                normals.push(forward.x, forward.y, forward.z);
            }
        }
    }

    const ringSize = RADIAL_SEGMENTS + 1;
    for (let pathIndex = 0; pathIndex < sampledPath.length - 1; pathIndex++) {
        for (
            let radialIndex = 0;
            radialIndex < RADIAL_SEGMENTS;
            radialIndex++
        ) {
            const a = pathIndex * ringSize + radialIndex;
            const b = (pathIndex + 1) * ringSize + radialIndex;
            const c = pathIndex * ringSize + radialIndex + 1;
            const d = (pathIndex + 1) * ringSize + radialIndex + 1;

            indices.push(a, b, c);
            indices.push(c, b, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(normals, 3),
    );
    geometry.setIndex(indices);

    return geometry;
}

function createSupportGeometry(
    supportDefinition: SupportDefinition,
): THREE.BufferGeometry {
    if (!supportDefinition.enabled) {
        return new THREE.BufferGeometry();
    }

    if (supportDefinition.mode === 'pole') {
        const poleGeometry = new THREE.CylinderGeometry(
            supportDefinition.radius,
            supportDefinition.radius * 1.08,
            supportDefinition.height,
            10,
        );
        poleGeometry.translate(0, supportDefinition.height / 2, 0);
        return poleGeometry;
    }

    const geometries: THREE.BufferGeometry[] = [];
    const verticalOffsets = [
        -supportDefinition.width * 0.44,
        supportDefinition.width * 0.44,
    ];
    const horizontalOffsets = [0.22, 0.46, 0.7, 0.94]
        .map((offset) => offset * supportDefinition.height)
        .filter((offset) => offset < supportDefinition.height);

    verticalOffsets.forEach((offsetX) => {
        const geometry = new THREE.BoxGeometry(
            supportDefinition.radius * 1.6,
            supportDefinition.height,
            supportDefinition.depth,
        );
        geometry.translate(offsetX, supportDefinition.height / 2, 0);
        geometries.push(geometry);
    });

    horizontalOffsets.forEach((offsetY) => {
        const geometry = new THREE.BoxGeometry(
            supportDefinition.width,
            supportDefinition.radius * 1.4,
            supportDefinition.depth,
        );
        geometry.translate(0, offsetY, 0);
        geometries.push(geometry);
    });

    const topBar = new THREE.BoxGeometry(
        supportDefinition.width * 1.06,
        supportDefinition.radius * 1.8,
        supportDefinition.depth * 1.1,
    );
    topBar.translate(0, supportDefinition.height, 0);
    geometries.push(topBar);

    const mergedGeometry =
        mergeGeometries(geometries) ?? new THREE.BufferGeometry();
    geometries.forEach((geometry) => {
        geometry.dispose();
    });
    return mergedGeometry;
}

function applySupportGuidance(
    startPosition: THREE.Vector3,
    endPosition: THREE.Vector3,
    supportDefinition: SupportDefinition,
) {
    if (!supportDefinition.enabled) {
        return endPosition;
    }

    const supportHeight = Math.max(supportDefinition.height, 0.001);
    const averageHeight = Math.max(0, (startPosition.y + endPosition.y) / 2);
    const climbBlend =
        THREE.MathUtils.smoothstep(averageHeight, 0.04, supportHeight) *
        THREE.MathUtils.clamp(supportDefinition.climbInfluence, 0, 1);

    if (climbBlend <= 0) {
        return endPosition;
    }

    const targetPosition = endPosition.clone();
    if (supportDefinition.mode === 'pole') {
        const spiralAngle =
            (averageHeight / supportHeight) *
            supportDefinition.spiralTurns *
            Math.PI *
            2;
        const radialOffset = supportDefinition.radius * 1.45;
        targetPosition.set(
            Math.cos(spiralAngle) * radialOffset,
            Math.min(
                supportHeight,
                Math.max(endPosition.y, averageHeight + 0.04),
            ),
            Math.sin(spiralAngle) * radialOffset,
        );
    } else {
        const weave =
            Math.sin(
                (averageHeight / supportHeight) *
                    supportDefinition.spiralTurns *
                    Math.PI *
                    2,
            ) *
            supportDefinition.width *
            0.34;
        targetPosition.set(
            THREE.MathUtils.clamp(
                weave,
                -supportDefinition.width * 0.44,
                supportDefinition.width * 0.44,
            ),
            Math.min(
                supportHeight,
                Math.max(endPosition.y, averageHeight + 0.05),
            ),
            -supportDefinition.depth * 0.25,
        );
    }

    const guidedPosition = endPosition.clone().lerp(targetPosition, climbBlend);
    guidedPosition.y = Math.max(guidedPosition.y, startPosition.y + 0.01);
    return guidedPosition;
}

function getLifecycleGrowth(
    generation: number,
    ageStart: number,
    matureAt: number,
) {
    if (generation < ageStart) {
        return 0;
    }

    if (matureAt <= ageStart) {
        return 1;
    }

    const linearProgress = THREE.MathUtils.clamp(
        (generation - ageStart + 1) / (matureAt - ageStart + 1),
        0,
        1,
    );

    return THREE.MathUtils.smoothstep(linearProgress, 0, 1);
}

function getSymbolGrowth(
    generation: number,
    symbolGeneration: number,
    growthStart = 0,
) {
    const linearProgress = THREE.MathUtils.clamp(
        generation - (symbolGeneration - 1),
        0,
        1,
    );

    return THREE.MathUtils.lerp(
        growthStart,
        1,
        THREE.MathUtils.smoothstep(linearProgress, 0, 1),
    );
}

function getSymbolParam(
    symbol: LSystemSymbol,
    index: number,
    fallback: number,
) {
    const value = symbol.params?.[index];
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function createRotationQuaternion(axis: THREE.Vector3, degrees: number) {
    return new THREE.Quaternion().setFromAxisAngle(
        axis,
        THREE.MathUtils.degToRad(degrees),
    );
}

export function getApproximatePlantHeight(
    plantDefinition: PlantDefinition,
    generation: number,
) {
    return Math.max(
        plantDefinition.height * 2.4,
        plantDefinition.stem.length * (Math.ceil(generation) + 2) * 1.1,
        plantDefinition.leaf.size * 5,
        plantDefinition.vegetable.baseSize * 3.2,
        (plantDefinition.support?.height ?? 0) * 1.05,
    );
}

export function buildPlantRenderData({
    flowerGrowth,
    fruitGrowth,
    generation,
    lSystemSymbols,
    plantDefinition,
    renderDetailedGeometry,
    seed,
    showFlowers = true,
    showLeaves = true,
    showProduce = true,
}: BuildPlantRenderDataOptions): PlantRenderData {
    const renderRng = new SeededRNG(seed);
    const thornDefinition = plantDefinition.thorn ?? defaultThornDefinition;
    const supportDefinition =
        plantDefinition.support ?? defaultSupportDefinition;
    const turtleStack: {
        position: THREE.Vector3;
        quaternion: THREE.Quaternion;
    }[] = [];
    const stemPaths: StemPathPoint[][] = [];
    const pathStack: StemPathPoint[][] = [];
    const leavesData: THREE.Matrix4[] = [];
    const leafColorsData: THREE.Color[] = [];
    const flowersData: THREE.Matrix4[] = [];
    const vegetablesData: VegetableData[] = [];
    const thornsData: THREE.Matrix4[] = [];

    let currentPosition = new THREE.Vector3(0, 0, 0);
    let currentQuaternion = new THREE.Quaternion();
    let currentPath: StemPathPoint[] = [];

    const baseAngle = plantDefinition.angle * plantDefinition.branching;
    const baseStemLength = plantDefinition.stem.length * plantDefinition.height;
    const structureGrowthFactor = THREE.MathUtils.smoothstep(
        generation,
        0,
        MAX_PLANT_GENERATION,
    );
    const flowerStageGrowthFactor = getLifecycleGrowth(
        generation,
        plantDefinition.flower.ageStart,
        Math.min(
            MAX_PLANT_GENERATION,
            plantDefinition.flower.ageStart + FLOWER_MATURITY_WINDOW,
        ),
    );
    const vegetableStageGrowthFactor = getLifecycleGrowth(
        generation,
        plantDefinition.vegetable.ageStart,
        MAX_PLANT_GENERATION,
    );

    const calculateRadius = (distance: number) => {
        const distanceDecay = Math.exp(
            -distance * plantDefinition.stem.radiusDecay,
        );
        const baseRadius =
            plantDefinition.stem.radius * structureGrowthFactor * distanceDecay;
        return Math.max(plantDefinition.stem.minRadius, baseRadius);
    };

    const calculateLeafSize = (distance: number) => {
        const distanceDecay = Math.exp(
            -distance * plantDefinition.leaf.sizeDecay,
        );
        return (
            plantDefinition.leaf.size * structureGrowthFactor * distanceDecay
        );
    };

    const baseLeafColor = new THREE.Color(plantDefinition.leaf.color);
    const dominantColor = new THREE.Color(plantDefinition.stem.color);
    let maxHeight = 0;
    let maxHorizontalReach = 0;
    let maxStemRadius = Math.max(
        plantDefinition.stem.minRadius,
        plantDefinition.stem.radius * structureGrowthFactor,
    );
    let foliageSamples = 0;
    let foliageSumY = 0;
    let accentSamples = 0;
    let accentSumY = 0;
    let accentColor: string | undefined;

    const trackPosition = (position: THREE.Vector3, radius = 0) => {
        maxHeight = Math.max(maxHeight, position.y + radius);
        maxHorizontalReach = Math.max(
            maxHorizontalReach,
            Math.hypot(position.x, position.z) + radius,
        );
    };

    trackPosition(currentPosition, calculateRadius(0));

    for (const symbol of lSystemSymbols) {
        const symbolGrowth = getSymbolGrowth(
            generation,
            symbol.generation,
            symbol.growthStart ?? 0,
        );

        switch (symbol.char) {
            case 'F':
            case 'S':
            case TERMINAL_STEM_SYMBOL: {
                const wobble = plantDefinition.directionVariability;
                const segmentLengthVariability = Math.min(wobble, 0.95);
                const segmentLengthMultiplier = Math.max(
                    0,
                    getSymbolParam(symbol, 0, 1),
                );
                const radiusMultiplier = Math.max(
                    0,
                    getSymbolParam(symbol, 1, 1),
                );
                const randomRotation = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(
                        renderRng.nextRange(-wobble, wobble),
                        renderRng.nextRange(-wobble, wobble),
                        renderRng.nextRange(-wobble, wobble),
                    ),
                );
                currentQuaternion.multiply(randomRotation).normalize();

                let segmentLength =
                    baseStemLength *
                    segmentLengthMultiplier *
                    renderRng.nextRange(
                        1 - segmentLengthVariability,
                        1 + segmentLengthVariability,
                    ) *
                    symbolGrowth;
                const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(
                    currentQuaternion,
                );
                let endPosition = currentPosition
                    .clone()
                    .add(direction.clone().multiplyScalar(segmentLength));

                endPosition = applySupportGuidance(
                    currentPosition,
                    endPosition,
                    supportDefinition,
                );
                const guidedDirection = endPosition
                    .clone()
                    .sub(currentPosition);
                if (guidedDirection.lengthSq() > 1e-6) {
                    currentQuaternion =
                        new THREE.Quaternion().setFromUnitVectors(
                            STEM_UP,
                            guidedDirection.normalize(),
                        );
                }

                if (endPosition.y < 0 && currentPosition.y > 0) {
                    const interpolation =
                        currentPosition.y / (currentPosition.y - endPosition.y);
                    segmentLength *= interpolation;
                    endPosition = currentPosition
                        .clone()
                        .add(direction.clone().multiplyScalar(segmentLength));
                }

                if (
                    segmentLength < MIN_SEGMENT_LENGTH ||
                    currentPosition.y < 0
                ) {
                    continue;
                }

                const startRadius =
                    calculateRadius(currentPosition.length()) *
                    radiusMultiplier;
                const endRadius =
                    calculateRadius(endPosition.length()) * radiusMultiplier;

                if (currentPath.length === 0) {
                    currentPath.push({
                        position: currentPosition.clone(),
                        quaternion: currentQuaternion.clone(),
                        radius: startRadius,
                    });
                }

                currentPath.push({
                    position: endPosition.clone(),
                    quaternion: currentQuaternion.clone(),
                    radius: endRadius,
                });

                trackPosition(currentPosition, startRadius);
                trackPosition(endPosition, endRadius);
                maxStemRadius = Math.max(maxStemRadius, startRadius, endRadius);
                currentPosition = endPosition;
                break;
            }
            case 'L':
            case TERMINAL_LEAF_SYMBOL: {
                if (currentPosition.y < 0 || symbolGrowth <= 0.01) {
                    continue;
                }

                for (
                    let index = 0;
                    index < plantDefinition.leaf.density;
                    index++
                ) {
                    const leafSize =
                        calculateLeafSize(currentPosition.length()) *
                        Math.max(0, getSymbolParam(symbol, 0, 1)) *
                        renderRng.nextRange(0.8, 1.2);
                    if (leafSize < MIN_LEAF_SIZE) {
                        continue;
                    }

                    const unfurlGrowth = THREE.MathUtils.smoothstep(
                        symbolGrowth,
                        0,
                        1,
                    );
                    const leafScale = new THREE.Vector3(
                        leafSize * THREE.MathUtils.lerp(0.18, 1, unfurlGrowth),
                        leafSize * unfurlGrowth,
                        leafSize,
                    );
                    const baseHangRad = THREE.MathUtils.degToRad(
                        plantDefinition.leaf.hangAngle,
                    );
                    const randomHangRad = THREE.MathUtils.degToRad(
                        renderRng.nextRange(
                            -plantDefinition.leaf.hangAngleRandomness,
                            plantDefinition.leaf.hangAngleRandomness,
                        ),
                    );
                    const totalHangRad = baseHangRad + randomHangRad;
                    const leafQuaternion = currentQuaternion
                        .clone()
                        .multiply(
                            new THREE.Quaternion().setFromAxisAngle(
                                new THREE.Vector3(1, 0, 0),
                                Math.PI / 2,
                            ),
                        )
                        .multiply(
                            new THREE.Quaternion().setFromAxisAngle(
                                new THREE.Vector3(0, 1, 0),
                                renderRng.nextRange(0, Math.PI * 2),
                            ),
                        )
                        .multiply(
                            new THREE.Quaternion().setFromAxisAngle(
                                new THREE.Vector3(1, 0, 0),
                                totalHangRad,
                            ),
                        );
                    const leafColor = baseLeafColor
                        .clone()
                        .offsetHSL(
                            renderRng.nextRange(-0.03, 0.03),
                            renderRng.nextRange(-0.08, 0.05),
                            renderRng.nextRange(-0.04, 0.03),
                        );

                    if (!showLeaves) {
                        continue;
                    }

                    foliageSamples += 1;
                    foliageSumY += currentPosition.y;
                    trackPosition(currentPosition, leafSize * 0.55);

                    if (renderDetailedGeometry) {
                        leavesData.push(
                            new THREE.Matrix4().compose(
                                currentPosition,
                                leafQuaternion,
                                leafScale,
                            ),
                        );
                        leafColorsData.push(leafColor);
                    }
                }
                break;
            }
            case 'P':
            case 'R': {
                const isRoot = symbol.char === 'R';
                const producePosition = isRoot
                    ? new THREE.Vector3(
                          0,
                          -plantDefinition.vegetable.baseSize * 0.4,
                          0,
                      )
                    : currentPosition;
                if (producePosition.y < 0 && !isRoot) {
                    continue;
                }

                const produceQuaternion = isRoot
                    ? new THREE.Quaternion().setFromAxisAngle(
                          new THREE.Vector3(1, 0, 0),
                          Math.PI,
                      )
                    : currentQuaternion;
                const hasFlower =
                    plantDefinition.flower.enabled &&
                    generation >= plantDefinition.flower.ageStart;
                const hasVegetable =
                    plantDefinition.vegetable.enabled &&
                    generation >= plantDefinition.vegetable.ageStart;

                if (
                    hasVegetable &&
                    (isRoot ||
                        renderRng.nextFloat() < plantDefinition.vegetable.yield)
                ) {
                    const produceGrowth =
                        fruitGrowth * vegetableStageGrowthFactor * symbolGrowth;
                    if (produceGrowth <= 0.01) {
                        continue;
                    }

                    const vegetableScale = new THREE.Vector3().setScalar(
                        plantDefinition.vegetable.baseSize *
                            Math.max(0, getSymbolParam(symbol, 0, 1)),
                    );
                    const vegetableMatrix = new THREE.Matrix4().compose(
                        producePosition,
                        produceQuaternion,
                        vegetableScale,
                    );

                    if (!showProduce) {
                        continue;
                    }

                    accentSamples += 1;
                    accentSumY += Math.max(
                        producePosition.y,
                        plantDefinition.vegetable.baseSize * 0.35,
                    );
                    trackPosition(
                        producePosition,
                        vegetableScale.x * produceGrowth,
                    );
                    accentColor =
                        vegetableMaterialProps[plantDefinition.vegetable.type]
                            .color;

                    if (renderDetailedGeometry) {
                        vegetablesData.push({
                            growth: produceGrowth,
                            matrix: vegetableMatrix,
                            type: plantDefinition.vegetable.type,
                        });
                    }
                } else if (hasFlower && !isRoot) {
                    const bloomGrowth =
                        flowerGrowth * flowerStageGrowthFactor * symbolGrowth;
                    if (bloomGrowth <= 0.01) {
                        continue;
                    }

                    const flowerScale = new THREE.Vector3().setScalar(
                        plantDefinition.flower.size *
                            Math.max(0, getSymbolParam(symbol, 0, 1)) *
                            bloomGrowth,
                    );
                    const flowerMatrix = new THREE.Matrix4().compose(
                        producePosition,
                        produceQuaternion,
                        flowerScale,
                    );

                    if (!showFlowers) {
                        continue;
                    }

                    accentSamples += 1;
                    accentSumY += producePosition.y;
                    trackPosition(producePosition, flowerScale.x);
                    accentColor = plantDefinition.flower.color;

                    if (renderDetailedGeometry) {
                        flowersData.push(flowerMatrix);
                    }
                }
                break;
            }
            case 'T': {
                if (
                    !thornDefinition.enabled ||
                    currentPosition.y < 0 ||
                    symbolGrowth <= 0.01
                ) {
                    continue;
                }

                for (let index = 0; index < thornDefinition.density; index++) {
                    const thornSize =
                        thornDefinition.size *
                        Math.max(0, getSymbolParam(symbol, 0, 1)) *
                        renderRng.nextRange(0.8, 1.15) *
                        symbolGrowth;
                    const thornAngle = renderRng.nextRange(0, Math.PI * 2);
                    const thornDirection = new THREE.Vector3(
                        Math.cos(thornAngle),
                        renderRng.nextRange(0.18, 0.5),
                        Math.sin(thornAngle),
                    )
                        .normalize()
                        .applyQuaternion(currentQuaternion);
                    const thornQuaternion =
                        new THREE.Quaternion().setFromUnitVectors(
                            STEM_UP,
                            thornDirection,
                        );
                    const thornPosition = currentPosition
                        .clone()
                        .add(
                            thornDirection
                                .clone()
                                .multiplyScalar(
                                    calculateRadius(currentPosition.length()) *
                                        0.9,
                                ),
                        );
                    const thornScale = new THREE.Vector3(
                        thornSize * 0.18,
                        thornSize,
                        thornSize * 0.18,
                    );

                    if (renderDetailedGeometry) {
                        thornsData.push(
                            new THREE.Matrix4().compose(
                                thornPosition,
                                thornQuaternion,
                                thornScale,
                            ),
                        );
                    }
                }
                break;
            }
            case '[':
                turtleStack.push({
                    position: currentPosition.clone(),
                    quaternion: currentQuaternion.clone(),
                });
                pathStack.push(currentPath);
                currentPath = [];
                break;
            case ']': {
                const poppedState = turtleStack.pop();
                if (poppedState) {
                    currentPosition = poppedState.position;
                    currentQuaternion = poppedState.quaternion;
                }

                if (currentPath.length >= 2) {
                    stemPaths.push(currentPath);
                }
                currentPath = pathStack.pop() ?? [];
                break;
            }
            case '+':
                currentQuaternion.multiply(
                    createRotationQuaternion(
                        STEM_YAW_AXIS,
                        -getSymbolParam(symbol, 0, baseAngle),
                    ),
                );
                break;
            case '-':
                currentQuaternion.multiply(
                    createRotationQuaternion(
                        STEM_YAW_AXIS,
                        getSymbolParam(symbol, 0, baseAngle),
                    ),
                );
                break;
            case '&':
                currentQuaternion.multiply(
                    createRotationQuaternion(
                        STEM_PITCH_AXIS,
                        -getSymbolParam(symbol, 0, baseAngle),
                    ),
                );
                break;
            case '^':
                currentQuaternion.multiply(
                    createRotationQuaternion(
                        STEM_PITCH_AXIS,
                        getSymbolParam(symbol, 0, baseAngle),
                    ),
                );
                break;
            case '/':
                currentQuaternion.multiply(
                    createRotationQuaternion(
                        STEM_ROLL_AXIS,
                        -getSymbolParam(symbol, 0, baseAngle),
                    ),
                );
                break;
            case '\\':
                currentQuaternion.multiply(
                    createRotationQuaternion(
                        STEM_ROLL_AXIS,
                        getSymbolParam(symbol, 0, baseAngle),
                    ),
                );
                break;
        }
    }

    if (currentPath.length >= 2) {
        stemPaths.push(currentPath);
    }

    for (const path of stemPaths) {
        const last = path[path.length - 1];
        const previous = path[path.length - 2];
        const direction = last.position.clone().sub(previous.position);
        const length = direction.length();
        if (length <= 0) {
            continue;
        }

        direction.normalize();
        path.push({
            position: last.position
                .clone()
                .add(direction.clone().multiplyScalar(last.radius * 1.5)),
            quaternion: last.quaternion.clone(),
            radius: 0,
        });
    }

    const stemGeometry = renderDetailedGeometry
        ? (() => {
              const stemTubeGeometries = stemPaths.map(createStemTubeGeometry);
              const mergedStemGeometry = stemTubeGeometries.length
                  ? mergeGeometries(stemTubeGeometries)
                  : new THREE.BufferGeometry();
              stemTubeGeometries.forEach((geometry) => {
                  geometry.dispose();
              });
              return mergedStemGeometry;
          })()
        : new THREE.BufferGeometry();
    const supportGeometry =
        renderDetailedGeometry && supportDefinition.enabled
            ? createSupportGeometry(supportDefinition)
            : new THREE.BufferGeometry();

    if (showLeaves) {
        dominantColor.lerp(baseLeafColor, 0.68);
    } else {
        dominantColor.lerp(baseLeafColor, 0.2);
    }
    if (accentColor) {
        dominantColor.lerp(new THREE.Color(accentColor), 0.16);
    }

    const canopyWidth =
        showLeaves && foliageSamples > 0
            ? Math.max(
                  maxHorizontalReach * 2,
                  plantDefinition.leaf.size * 1.6,
                  0.22,
              )
            : Math.max(maxHorizontalReach * 1.15, maxStemRadius * 5, 0.12);
    const height = Math.max(
        maxHeight,
        plantDefinition.height * 0.55,
        plantDefinition.vegetable.baseSize * 1.6,
        supportDefinition.enabled ? supportDefinition.height : 0,
        0.24,
    );

    return {
        flowers: flowersData,
        leafColors: leafColorsData,
        leaves: leavesData,
        lodSummary: {
            accentCenterY:
                accentSamples > 0
                    ? Math.max(0.08, accentSumY / accentSamples)
                    : Math.max(height * 0.7, 0.12),
            accentColor,
            canopyCenterY:
                showLeaves && foliageSamples > 0
                    ? foliageSumY / foliageSamples
                    : Math.max(height * 0.66, 0.16),
            canopyWidth,
            dominantColor: `#${dominantColor.getHexString()}`,
            foliageColor: plantDefinition.leaf.color,
            hasFoliage: showLeaves && foliageSamples > 0,
            height,
            stemColor: plantDefinition.stem.color,
            stemWidth: Math.max(maxStemRadius * 4.5, 0.05),
        },
        supportGeometry,
        stemGeometry,
        thorns: thornsData,
        vegetables: vegetablesData,
    };
}
