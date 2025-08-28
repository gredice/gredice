'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { LSystemSymbol } from './lib/l-system';
import type { PlantDefinition } from './lib/plant-definitions';
import { SeededRNG } from './lib/rng';
import { Flowers } from './parts/flowers';
import { Leaves } from './parts/leaves';
import { type VegetableData, Vegetables } from './parts/vegetables';

interface PlantGeneratorProps {
    plantDefinition: PlantDefinition;
    lSystemSymbols: LSystemSymbol[];
    generation: number;
    seed: string;
    flowerGrowth: number;
    fruitGrowth: number;
    showLeaves?: boolean;
    showFlowers?: boolean;
    showProduce?: boolean;
}

const MAX_GROWTH_GENERATION = 8; // Generation at which stems/leaves reach their max potential size
const MIN_SEGMENT_LENGTH = 0.001;
const MIN_LEAF_SIZE = 0.01;

export function PlantGenerator({
    plantDefinition,
    lSystemSymbols,
    generation,
    seed,
    flowerGrowth,
    fruitGrowth,
    showLeaves = true,
    showFlowers = true,
    showProduce = true,
}: PlantGeneratorProps) {
    const { stemGeometry, leaves, flowers, vegetables } = useMemo(() => {
        const renderRng = new SeededRNG(seed);

        const turtleStack: {
            position: THREE.Vector3;
            quaternion: THREE.Quaternion;
        }[] = [];
        let currentPosition = new THREE.Vector3(0, 0, 0);
        let currentQuaternion = new THREE.Quaternion();

        const stemGeometries: THREE.BufferGeometry[] = [];
        const leavesData: THREE.Matrix4[] = [];
        const flowersData: THREE.Matrix4[] = [];
        const vegetablesData: VegetableData[] = [];

        const baseAngle = plantDefinition.angle * plantDefinition.branching;
        const angleRad = THREE.MathUtils.degToRad(baseAngle);
        const yawRight = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            -angleRad,
        );
        const yawLeft = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            angleRad,
        );
        const pitchUp = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            angleRad,
        );
        const pitchDown = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -angleRad,
        );
        const rollRight = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            -angleRad,
        );
        const rollLeft = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            angleRad,
        );

        const generationGrowthFactor = Math.min(
            1,
            generation / MAX_GROWTH_GENERATION,
        );

        const calculateRadius = (distance: number) => {
            const distanceDecay = Math.exp(
                -distance * plantDefinition.stem.radiusDecay,
            );
            const baseRadius =
                plantDefinition.stem.radius *
                generationGrowthFactor *
                distanceDecay;
            return Math.max(plantDefinition.stem.minRadius, baseRadius);
        };

        const calculateLeafSize = (distance: number) => {
            const distanceDecay = Math.exp(
                -distance * plantDefinition.leaf.sizeDecay,
            );
            return (
                plantDefinition.leaf.size *
                generationGrowthFactor *
                distanceDecay
            );
        };

        for (const symbol of lSystemSymbols) {
            switch (symbol.char) {
                case 'F':
                case 'S': {
                    const wobble = plantDefinition.directionVariability;
                    const randomRotation = new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(
                            renderRng.nextRange(-wobble, wobble),
                            renderRng.nextRange(-wobble, wobble),
                            renderRng.nextRange(-wobble, wobble),
                        ),
                    );
                    currentQuaternion.multiply(randomRotation).normalize();

                    let segmentLength =
                        plantDefinition.stem.length *
                        plantDefinition.height *
                        renderRng.nextRange(0.8, 1.2);
                    const direction = new THREE.Vector3(
                        0,
                        1,
                        0,
                    ).applyQuaternion(currentQuaternion);
                    let endPosition = currentPosition
                        .clone()
                        .add(direction.clone().multiplyScalar(segmentLength));

                    if (endPosition.y < 0 && currentPosition.y > 0) {
                        const t =
                            currentPosition.y /
                            (currentPosition.y - endPosition.y);
                        segmentLength *= t;
                        endPosition = currentPosition
                            .clone()
                            .add(
                                direction.clone().multiplyScalar(segmentLength),
                            );
                    }

                    if (
                        segmentLength < MIN_SEGMENT_LENGTH ||
                        currentPosition.y < 0
                    )
                        continue;

                    const radiusBottom = calculateRadius(
                        currentPosition.length(),
                    );
                    const radiusTop = calculateRadius(endPosition.length());

                    const segmentGeo = new THREE.CylinderGeometry(
                        radiusTop,
                        radiusBottom,
                        segmentLength,
                        5,
                    );
                    const midPosition = currentPosition
                        .clone()
                        .add(
                            direction.clone().multiplyScalar(segmentLength / 2),
                        );
                    const matrix = new THREE.Matrix4().compose(
                        midPosition,
                        currentQuaternion,
                        new THREE.Vector3(1, 1, 1),
                    );
                    segmentGeo.applyMatrix4(matrix);
                    stemGeometries.push(segmentGeo);
                    currentPosition = endPosition;
                    break;
                }
                case 'L': {
                    if (currentPosition.y < 0) continue;
                    for (let i = 0; i < plantDefinition.leaf.density; i++) {
                        const leafSize =
                            calculateLeafSize(currentPosition.length()) *
                            renderRng.nextRange(0.8, 1.2);
                        if (leafSize < MIN_LEAF_SIZE) continue;
                        const leafScale = new THREE.Vector3(
                            leafSize,
                            leafSize,
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
                        const leafMatrix = new THREE.Matrix4().compose(
                            currentPosition,
                            leafQuaternion,
                            leafScale,
                        );
                        leavesData.push(leafMatrix);
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
                    if (producePosition.y < 0 && !isRoot) continue;

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
                            renderRng.nextFloat() <
                                plantDefinition.vegetable.yield)
                    ) {
                        if (fruitGrowth > 0.01) {
                            const vegScale = new THREE.Vector3().setScalar(
                                plantDefinition.vegetable.baseSize,
                            );
                            const vegMatrix = new THREE.Matrix4().compose(
                                producePosition,
                                produceQuaternion,
                                vegScale,
                            );
                            vegetablesData.push({
                                matrix: vegMatrix,
                                type: plantDefinition.vegetable.type,
                                growth: fruitGrowth,
                            });
                        }
                    } else if (hasFlower && !isRoot) {
                        if (flowerGrowth > 0.01) {
                            const flowerScale = new THREE.Vector3().setScalar(
                                plantDefinition.flower.size * flowerGrowth,
                            );
                            const flowerMatrix = new THREE.Matrix4().compose(
                                producePosition,
                                produceQuaternion,
                                flowerScale,
                            );
                            flowersData.push(flowerMatrix);
                        }
                    }
                    break;
                }
                case '[':
                    turtleStack.push({
                        position: currentPosition.clone(),
                        quaternion: currentQuaternion.clone(),
                    });
                    break;
                case ']': {
                    const poppedState = turtleStack.pop();
                    if (poppedState) {
                        currentPosition = poppedState.position;
                        currentQuaternion = poppedState.quaternion;
                    }
                    break;
                }
                case '+':
                    currentQuaternion.multiply(yawRight);
                    break;
                case '-':
                    currentQuaternion.multiply(yawLeft);
                    break;
                case '&':
                    currentQuaternion.multiply(pitchDown);
                    break;
                case '^':
                    currentQuaternion.multiply(pitchUp);
                    break;
                case '/':
                    currentQuaternion.multiply(rollRight);
                    break;
                case '\\':
                    currentQuaternion.multiply(rollLeft);
                    break;
            }
        }

        const mergedStemGeometry = stemGeometries.length
            ? mergeGeometries(stemGeometries)
            : new THREE.BufferGeometry();
        stemGeometries.forEach((g) => {
            g.dispose();
        });

        return {
            stemGeometry: mergedStemGeometry,
            leaves: leavesData,
            flowers: flowersData,
            vegetables: vegetablesData,
        };
    }, [
        plantDefinition,
        lSystemSymbols,
        generation,
        seed,
        flowerGrowth,
        fruitGrowth,
    ]);

    const stemMaterial = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                color: plantDefinition.stem.color,
                roughness: 0.8,
                metalness: 0.2,
            }),
        [plantDefinition.stem.color],
    );

    return (
        <group>
            <mesh geometry={stemGeometry} material={stemMaterial} castShadow />
            {showLeaves && (
                <Leaves
                    matrices={leaves}
                    color={plantDefinition.leaf.color}
                    type={plantDefinition.leaf.type}
                />
            )}
            {showFlowers && plantDefinition.flower.enabled && (
                <Flowers
                    matrices={flowers}
                    color={plantDefinition.flower.color}
                />
            )}
            {showProduce && plantDefinition.vegetable.enabled && (
                <Vegetables vegetables={vegetables} />
            )}
        </group>
    );
}
