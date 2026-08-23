'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { blockInteractionPassthroughUserDataKey } from '../controls/BlockInteractionResolver';
import {
    RaisedBedGeneratedPlantBatch,
    type RaisedBedGeneratedPlantBatchInstance,
} from '../entities/raisedBed/RaisedBedGeneratedPlantBatch';
import {
    getInGamePlantInstanceScale,
    type ResolvedInGamePlantPreset,
    resolveInGamePlantPreset,
} from '../generators/plant/lib/inGamePlantPresets';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../generators/plant/lib/plant-definitions';
import { useBlockData } from '../hooks/useBlockData';
import type { OutletOfferData } from '../hooks/useOutletOffers';
import { getStackHeight } from '../utils/getStackHeight';
import { outletOfferIdFromBlockId } from './outletGardenLayout';
import {
    normalizePublicGardenStacks,
    type PublicGardenDetail,
    publicGardenStacksFromResponse,
} from './PublicGardenViewer';

const fallbackLeafColors = [
    '#4f8f3a',
    '#6f9f3b',
    '#3f7f35',
    '#7a9f45',
    '#3f8d58',
] as const;

type OutletGardenSeedlingStage = {
    generation: number;
    showFlowers: boolean;
    showProduce: boolean;
};

export function getOutletGardenSeedlingStage(
    status: string,
    definition: PlantDefinition,
): OutletGardenSeedlingStage {
    const { phenology, reproduction } = definition.development;
    const emergence = phenology.emergenceStart;
    const flowerStart = reproduction.flowerStart;
    const fruitStart = reproduction.fruitStart ?? flowerStart + 1.8;
    const sproutedGeneration = Math.min(
        flowerStart - 0.8,
        emergence + Math.max(1.8, (flowerStart - emergence) * 0.58),
    );
    const transplantReadyGeneration = Math.min(
        flowerStart - 0.35,
        emergence + Math.max(2.1, (flowerStart - emergence) * 0.78),
    );

    switch (status) {
        case 'sowed':
        case 'pendingVerification':
            return {
                generation: Math.max(0, emergence - 0.05),
                showFlowers: false,
                showProduce: false,
            };
        case 'firstFlowers':
            return {
                generation: Math.min(MAX_PLANT_GENERATION, flowerStart + 0.45),
                showFlowers: true,
                showProduce: false,
            };
        case 'firstFruitSet':
            return {
                generation: Math.min(
                    MAX_PLANT_GENERATION,
                    Math.max(flowerStart + 0.8, fruitStart + 0.35),
                ),
                showFlowers: true,
                showProduce: true,
            };
        case 'ready':
            return {
                generation: Math.max(
                    sproutedGeneration,
                    transplantReadyGeneration,
                ),
                showFlowers: false,
                showProduce: false,
            };
        default:
            return {
                generation: sproutedGeneration,
                showFlowers: false,
                showProduce: false,
            };
    }
}

export function outletGardenPlantSeed(plantSortId: number) {
    return `outlet-sort:${plantSortId.toString()}`;
}

export function outletGardenPlantBatchKey({
    plantType,
    showFlowers,
    showProduce,
}: {
    plantType: string;
    showFlowers: boolean;
    showProduce: boolean;
}) {
    return `${plantType}:${showFlowers ? 'flowers' : 'no-flowers'}:${showProduce ? 'produce' : 'no-produce'}`;
}

function resolveOutletGardenPlantPreset(offer: OutletOfferData) {
    return resolveInGamePlantPreset([
        offer.plantSort.name,
        offer.plantSort.plant?.name,
    ]);
}

type OutletGardenSeedlingMarker = {
    blockId: string;
    fallbackColor: string;
    generation: number;
    highlightPosition: THREE.Vector3;
    offerId: number;
    position: THREE.Vector3;
    preset: ResolvedInGamePlantPreset | null;
    rotation: number;
    scale: number;
    seed: string;
    showFlowers: boolean;
    showProduce: boolean;
};

type OutletGardenGeneratedBatch = {
    definition: PlantDefinition;
    instances: RaisedBedGeneratedPlantBatchInstance[];
    key: string;
    showFlowers: boolean;
    showProduce: boolean;
};

function OutletGardenSeedlingHighlight({
    marker,
}: {
    marker: OutletGardenSeedlingMarker;
}) {
    return (
        <group
            name={`OutletGardenSeedlingHighlight:${marker.blockId}`}
            position={marker.highlightPosition}
        >
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.32, 0.4, 32]} />
                <meshBasicMaterial
                    color="#eab308"
                    depthTest
                    depthWrite={false}
                    opacity={0.78}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                    side={THREE.DoubleSide}
                    toneMapped={false}
                    transparent
                />
            </mesh>
        </group>
    );
}

function OutletGardenFallbackSeedling({
    marker,
}: {
    marker: OutletGardenSeedlingMarker;
}) {
    return (
        <group
            name={`OutletGardenFallbackSeedling:${marker.blockId}`}
            position={marker.position}
            rotation={[0, marker.rotation, 0]}
            scale={0.78}
        >
            <mesh castShadow position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.02, 0.028, 0.4, 6]} />
                <meshStandardMaterial color="#3d7a32" roughness={0.9} />
            </mesh>
            <mesh
                castShadow
                position={[0.08, 0.34, 0]}
                rotation={[0, 0, -0.45]}
                scale={[1, 0.3, 0.55]}
            >
                <sphereGeometry args={[0.12, 8, 6]} />
                <meshStandardMaterial
                    color={marker.fallbackColor}
                    roughness={0.86}
                />
            </mesh>
            <mesh
                castShadow
                position={[-0.08, 0.43, 0.02]}
                rotation={[0, 0, 0.45]}
                scale={[1, 0.3, 0.55]}
            >
                <sphereGeometry args={[0.12, 8, 6]} />
                <meshStandardMaterial
                    color={marker.fallbackColor}
                    roughness={0.86}
                />
            </mesh>
        </group>
    );
}

export function OutletGardenSeedlingMarkers({
    highlightedOfferId,
    offers,
    stacks,
}: {
    highlightedOfferId?: number | null;
    offers: readonly OutletOfferData[];
    stacks: PublicGardenDetail['stacks'];
}) {
    const { data: blockData } = useBlockData();
    const markers = useMemo(() => {
        const offersById = new Map(offers.map((offer) => [offer.id, offer]));
        const normalizedStacks = normalizePublicGardenStacks(
            publicGardenStacksFromResponse(stacks),
        );

        return normalizedStacks.flatMap((stack) =>
            stack.blocks.flatMap((block) => {
                const offerId = outletOfferIdFromBlockId(block.id);
                if (offerId === null) {
                    return [];
                }
                const offer = offersById.get(offerId);
                if (!offer) {
                    return [];
                }
                const plantVisualId =
                    offer.plantSort.plant?.id ?? offer.plantSort.id;
                const preset = resolveOutletGardenPlantPreset(offer);
                const stage = preset
                    ? getOutletGardenSeedlingStage(
                          offer.initialPlantStatus,
                          preset.definition,
                      )
                    : {
                          generation: 3.2,
                          showFlowers: false,
                          showProduce: false,
                      };
                const scale = preset
                    ? getInGamePlantInstanceScale(preset, 1) * 1.12
                    : 0.78;

                return [
                    {
                        blockId: block.id,
                        fallbackColor:
                            fallbackLeafColors[
                                Math.abs(plantVisualId) %
                                    fallbackLeafColors.length
                            ] ?? fallbackLeafColors[0],
                        generation: stage.generation,
                        highlightPosition: stack.position
                            .clone()
                            .setY(getStackHeight(blockData, stack, block)),
                        offerId,
                        position: stack.position
                            .clone()
                            .setY(getStackHeight(blockData, stack) + 0.02),
                        preset,
                        rotation: block.rotation * (Math.PI / 2),
                        scale,
                        seed: outletGardenPlantSeed(offer.plantSort.id),
                        showFlowers: stage.showFlowers,
                        showProduce: stage.showProduce,
                    } satisfies OutletGardenSeedlingMarker,
                ];
            }),
        );
    }, [blockData, offers, stacks]);
    const { batches, fallbackMarkers } = useMemo(() => {
        const batchesByKey = new Map<string, OutletGardenGeneratedBatch>();
        const fallback: OutletGardenSeedlingMarker[] = [];

        for (const marker of markers) {
            if (!marker.preset) {
                fallback.push(marker);
                continue;
            }

            const key = outletGardenPlantBatchKey({
                plantType: marker.preset.plantType,
                showFlowers: marker.showFlowers,
                showProduce: marker.showProduce,
            });
            const batch = batchesByKey.get(key) ?? {
                definition: marker.preset.definition,
                instances: [],
                key,
                showFlowers: marker.showFlowers,
                showProduce: marker.showProduce,
            };
            batch.instances.push({
                generation: marker.generation,
                position: marker.position.toArray(),
                scale: marker.scale,
                seed: marker.seed,
                yawRadians: marker.rotation,
            });
            batchesByKey.set(key, batch);
        }

        return {
            batches: Array.from(batchesByKey.values()).sort((left, right) =>
                left.key.localeCompare(right.key),
            ),
            fallbackMarkers: fallback,
        };
    }, [markers]);
    return (
        <group
            name="OutletGardenSeedlingMarkers"
            userData={{ [blockInteractionPassthroughUserDataKey]: true }}
        >
            {batches.map((batch) => (
                <RaisedBedGeneratedPlantBatch
                    definition={batch.definition}
                    flowerGrowth={batch.showFlowers ? 0.65 : 0}
                    fruitGrowth={batch.showProduce ? 0.45 : 0}
                    instances={batch.instances}
                    key={batch.key}
                    showProduce={batch.showProduce}
                    taskPriority="normal"
                />
            ))}
            {fallbackMarkers.map((marker) => (
                <OutletGardenFallbackSeedling
                    key={marker.blockId}
                    marker={marker}
                />
            ))}
            {markers
                .filter((marker) => marker.offerId === highlightedOfferId)
                .map((marker) => (
                    <OutletGardenSeedlingHighlight
                        key={marker.blockId}
                        marker={marker}
                    />
                ))}
        </group>
    );
}
