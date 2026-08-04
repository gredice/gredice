import {
    MAX_PLANT_GENERATION,
    type PlantArchitecture,
    type PlantDefinition,
    type VegetableType,
} from '../lib/plant-definition-types';
import { SeededRNG } from '../lib/rng';

export type PlantVector3 = readonly [number, number, number];

export interface PlantOrganTransform {
    position: PlantVector3;
    rotationRadians: PlantVector3;
    scale: PlantVector3;
}

interface PlantOrganBase {
    birthGeneration: number;
    children: string[];
    deathGeneration?: number;
    developmentStage: number;
    health: number;
    id: string;
    maturityGeneration: number;
    parentId?: string;
}

export interface PlantMeristemOrgan extends PlantOrganBase {
    position: PlantVector3;
    type: 'meristem';
}

export interface PlantSegmentOrgan extends PlantOrganBase {
    end: PlantVector3;
    endRadius: number;
    start: PlantVector3;
    startRadius: number;
    type: 'branch' | 'internode' | 'petiole' | 'runner' | 'tendril';
}

export interface PlantLeafOrgan extends PlantOrganBase {
    transform: PlantOrganTransform;
    type: 'leaf';
}

export interface PlantFlowerOrgan extends PlantOrganBase {
    transform: PlantOrganTransform;
    type: 'flower';
}

export interface PlantProduceOrgan extends PlantOrganBase {
    produceType: VegetableType;
    transform: PlantOrganTransform;
    type: 'fruit' | 'root';
}

export interface PlantThornOrgan extends PlantOrganBase {
    transform: PlantOrganTransform;
    type: 'thorn';
}

export type PlantOrgan =
    | PlantFlowerOrgan
    | PlantLeafOrgan
    | PlantMeristemOrgan
    | PlantProduceOrgan
    | PlantSegmentOrgan
    | PlantThornOrgan;

export interface DevelopmentalPlantGraph {
    architecture: PlantArchitecture;
    generation: number;
    organs: PlantOrgan[];
    plantKey: string;
    rootId: string;
    seed: string;
}

interface BuildDevelopmentalPlantGraphOptions {
    generation: number;
    plantDefinition: PlantDefinition;
    seed: string;
}

interface OrganSite {
    azimuth: number;
    birthGeneration: number;
    id: string;
    position: PlantVector3;
}

function vector3(x: number, y: number, z: number): PlantVector3 {
    return [x, y, z];
}

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start: number, end: number, progress: number) {
    return start + (end - start) * progress;
}

function smoothstep(progress: number) {
    const bounded = clamp(progress, 0, 1);
    return bounded * bounded * (3 - 2 * bounded);
}

function getDevelopmentStage(
    generation: number,
    birthGeneration: number,
    maturityGeneration: number,
) {
    if (maturityGeneration <= birthGeneration) {
        return generation >= birthGeneration ? 1 : 0;
    }

    return smoothstep(
        (generation - birthGeneration) / (maturityGeneration - birthGeneration),
    );
}

function degreesToRadians(degrees: number) {
    return (degrees / 180) * Math.PI;
}

function add(left: PlantVector3, right: PlantVector3): PlantVector3 {
    return vector3(left[0] + right[0], left[1] + right[1], left[2] + right[2]);
}

function radial(angle: number, length: number, y = 0): PlantVector3 {
    return vector3(Math.sin(angle) * length, y, Math.cos(angle) * length);
}

function createOrganRng(seed: string, plantKey: string, organId: string) {
    return new SeededRNG(`${seed}:${plantKey}:developmental-graph:${organId}`);
}

function createBaseOrgan({
    birthGeneration,
    deathGeneration,
    generation,
    health = 1,
    id,
    maturityGeneration,
    parentId,
}: {
    birthGeneration: number;
    deathGeneration?: number;
    generation: number;
    health?: number;
    id: string;
    maturityGeneration: number;
    parentId?: string;
}): PlantOrganBase {
    return {
        birthGeneration,
        children: [],
        deathGeneration,
        developmentStage: getDevelopmentStage(
            generation,
            birthGeneration,
            maturityGeneration,
        ),
        health: clamp(health, 0, 1),
        id,
        maturityGeneration,
        parentId,
    };
}

function createGraphBuilder(
    generation: number,
    plantDefinition: PlantDefinition,
    seed: string,
) {
    const organs: PlantOrgan[] = [];
    const organById = new Map<string, PlantOrgan>();

    const addOrgan = (organ: PlantOrgan) => {
        if (
            generation < organ.birthGeneration ||
            (organ.deathGeneration !== undefined &&
                generation >= organ.deathGeneration)
        ) {
            return false;
        }

        const parent = organ.parentId
            ? organById.get(organ.parentId)
            : undefined;
        if (organ.parentId && !parent) {
            return false;
        }

        organs.push(organ);
        organById.set(organ.id, organ);
        parent?.children.push(organ.id);
        return true;
    };

    return {
        addOrgan,
        createOrganRng(id: string) {
            return createOrganRng(seed, plantDefinition.key, id);
        },
        finish(rootId: string): DevelopmentalPlantGraph {
            return {
                architecture: plantDefinition.development.architecture,
                generation,
                organs,
                plantKey: plantDefinition.key,
                rootId,
                seed,
            };
        },
        hasOrgan(id: string) {
            return organById.has(id);
        },
    };
}

function getEmergenceGeneration(
    emergenceStart: number,
    emergenceInterval: number,
    maturityGeneration: number,
    maturityDuration: number,
    index: number,
    count: number,
) {
    if (count <= 1) {
        return emergenceStart;
    }

    const availableSpan = Math.max(
        0,
        maturityGeneration - emergenceStart - maturityDuration * 0.35,
    );
    const boundedInterval = Math.min(
        emergenceInterval,
        availableSpan / (count - 1),
    );
    return emergenceStart + index * boundedInterval;
}

function addRootMeristem(
    graph: ReturnType<typeof createGraphBuilder>,
    generation: number,
    crownHeight: number,
) {
    const rootId = 'meristem:root';
    graph.addOrgan({
        ...createBaseOrgan({
            birthGeneration: 0,
            generation,
            id: rootId,
            maturityGeneration: 0.4,
        }),
        position: vector3(0, crownHeight, 0),
        type: 'meristem',
    });
    return rootId;
}

function buildBasalSites({
    graph,
    plantDefinition,
    rootId,
}: {
    graph: ReturnType<typeof createGraphBuilder>;
    plantDefinition: PlantDefinition;
    rootId: string;
}) {
    const { development } = plantDefinition;
    const crownHeight = Math.max(0.018, plantDefinition.height * 0.035);
    const siteCount = Math.max(development.foliage.count, 1);
    const sites: OrganSite[] = [];

    for (let index = 0; index < siteCount; index += 1) {
        const id = `site:basal:${index.toString()}`;
        const rng = graph.createOrganRng(id);
        const azimuth = degreesToRadians(
            index * development.foliage.phyllotaxisDegrees +
                rng.nextRange(-5, 5),
        );
        const position = add(
            vector3(0, crownHeight, 0),
            radial(
                azimuth,
                plantDefinition.leaf.size *
                    development.axes.spread *
                    rng.nextRange(0.035, 0.11),
            ),
        );
        sites.push({
            azimuth,
            birthGeneration: development.phenology.emergenceStart,
            id: rootId,
            position,
        });
    }

    return sites;
}

function getAxisStep(
    plantDefinition: PlantDefinition,
    azimuth: number,
    index: number,
    nodeCount: number,
    rng: SeededRNG,
) {
    const { axes } = plantDefinition.development;
    const baseLength =
        (plantDefinition.height * axes.internodeLengthScale) /
        Math.max(nodeCount, 1);
    const segmentLength = baseLength * rng.nextRange(0.92, 1.08);
    const alternating = index % 2 === 0 ? 1 : -1;

    switch (axes.habit) {
        case 'prostrate':
            return radial(
                azimuth + alternating * 0.05,
                segmentLength * 0.95,
                segmentLength * 0.16,
            );
        case 'climbing':
            return radial(
                azimuth + alternating * 0.08,
                segmentLength * 0.28,
                segmentLength * 0.9,
            );
        case 'woody':
            return radial(
                azimuth + alternating * 0.08,
                segmentLength * 0.1,
                segmentLength * 0.98,
            );
        case 'upright':
            return radial(
                azimuth + alternating * 0.11,
                segmentLength * 0.12,
                segmentLength * 0.98,
            );
        case 'basal':
            return radial(azimuth, segmentLength * 0.76, segmentLength * 0.42);
    }
}

function buildAxisSites({
    generation,
    graph,
    plantDefinition,
    rootId,
}: {
    generation: number;
    graph: ReturnType<typeof createGraphBuilder>;
    plantDefinition: PlantDefinition;
    rootId: string;
}) {
    const { axes, phenology } = plantDefinition.development;
    const axisCount = Math.max(1, Math.round(axes.axisCount));
    const nodeCount = Math.max(1, Math.round(axes.nodeCount));
    const sites: OrganSite[] = [];
    const axisSites: OrganSite[][] = [];

    for (let axisIndex = 0; axisIndex < axisCount; axisIndex += 1) {
        const axisAzimuth =
            (axisIndex / axisCount) * Math.PI * 2 +
            degreesToRadians(axisIndex * 11);
        let parentId = rootId;
        let position =
            axisCount === 1
                ? vector3(0, 0, 0)
                : radial(axisAzimuth, plantDefinition.stem.radius * 0.6, 0);
        const currentAxisSites: OrganSite[] = [];

        for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
            const id = `internode:${axisIndex.toString()}:${nodeIndex.toString()}`;
            const rng = graph.createOrganRng(id);
            const birthGeneration = getEmergenceGeneration(
                phenology.emergenceStart,
                (phenology.maturityGeneration - phenology.emergenceStart) /
                    Math.max(nodeCount, 1),
                phenology.maturityGeneration,
                1.3,
                nodeIndex,
                nodeCount,
            );
            const maturityGeneration = birthGeneration + 1.35;
            const end = add(
                position,
                getAxisStep(
                    plantDefinition,
                    axisAzimuth,
                    nodeIndex,
                    nodeCount,
                    rng,
                ),
            );
            const rank = nodeIndex / Math.max(1, nodeCount - 1);
            const startRadius = Math.max(
                plantDefinition.stem.minRadius,
                plantDefinition.stem.radius *
                    Math.exp(-rank * plantDefinition.stem.radiusDecay),
            );
            const added = graph.addOrgan({
                ...createBaseOrgan({
                    birthGeneration,
                    generation,
                    id,
                    maturityGeneration,
                    parentId,
                }),
                end,
                endRadius: Math.max(
                    plantDefinition.stem.minRadius,
                    startRadius * 0.82,
                ),
                start: position,
                startRadius,
                type: 'internode',
            });
            const site = {
                azimuth:
                    axisAzimuth +
                    degreesToRadians(
                        nodeIndex *
                            plantDefinition.development.foliage
                                .phyllotaxisDegrees,
                    ),
                birthGeneration,
                id,
                position: end,
            };
            sites.push(site);
            currentAxisSites.push(site);
            if (!added && generation >= birthGeneration) {
                throw new Error(`Unable to attach ${id} to ${parentId}`);
            }
            parentId = id;
            position = end;
        }
        axisSites.push(currentAxisSites);
    }

    const branchCount = Math.max(0, Math.round(axes.branchCount));
    const branchNodeCount = Math.max(1, Math.round(axes.branchNodeCount));
    for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
        const sourceAxis = axisSites[branchIndex % axisSites.length];
        const matureSourceIndex = Math.min(
            nodeCount - 1,
            Math.floor(((branchIndex + 1) / (branchCount + 1)) * nodeCount),
        );
        const source = sourceAxis?.[matureSourceIndex];
        if (!source) {
            continue;
        }

        const branchAzimuth =
            source.azimuth +
            (branchIndex % 2 === 0 ? Math.PI * 0.55 : -Math.PI * 0.55);
        let parentId = source.id;
        let position = source.position;
        for (let nodeIndex = 0; nodeIndex < branchNodeCount; nodeIndex += 1) {
            const id = `branch:${branchIndex.toString()}:${nodeIndex.toString()}`;
            const birthGeneration =
                source.birthGeneration + 0.55 + nodeIndex * 0.38;
            const maturityGeneration = birthGeneration + 1.3;
            const length =
                (plantDefinition.height * axes.branchLengthScale) /
                branchNodeCount;
            const pitch = degreesToRadians(axes.branchPitchDegrees);
            const end = add(
                position,
                radial(
                    branchAzimuth + nodeIndex * 0.08,
                    length * Math.sin(pitch),
                    length * Math.cos(pitch),
                ),
            );
            const radius = Math.max(
                plantDefinition.stem.minRadius,
                plantDefinition.stem.radius * 0.55 * (1 - nodeIndex * 0.16),
            );
            const added = graph.addOrgan({
                ...createBaseOrgan({
                    birthGeneration,
                    generation,
                    id,
                    maturityGeneration,
                    parentId,
                }),
                end,
                endRadius: Math.max(
                    plantDefinition.stem.minRadius,
                    radius * 0.78,
                ),
                start: position,
                startRadius: radius,
                type: 'branch',
            });
            sites.push({
                azimuth: branchAzimuth,
                birthGeneration,
                id,
                position: end,
            });
            if (
                !added &&
                generation >= birthGeneration &&
                graph.hasOrgan(source.id)
            ) {
                throw new Error(`Unable to attach ${id} to ${parentId}`);
            }
            parentId = id;
            position = end;
        }
    }

    return sites;
}

function addFoliage({
    generation,
    graph,
    plantDefinition,
    rootId,
    sites,
}: {
    generation: number;
    graph: ReturnType<typeof createGraphBuilder>;
    plantDefinition: PlantDefinition;
    rootId: string;
    sites: OrganSite[];
}) {
    const { foliage, phenology, variability } = plantDefinition.development;
    const count = Math.max(0, Math.round(foliage.count));
    for (let index = 0; index < count; index += 1) {
        const leafId = `leaf:${index.toString()}`;
        const rng = graph.createOrganRng(leafId);
        const source = sites[index % Math.max(1, sites.length)] ?? {
            azimuth: degreesToRadians(index * foliage.phyllotaxisDegrees),
            birthGeneration: phenology.emergenceStart,
            id: rootId,
            position: vector3(0, 0.025, 0),
        };
        const scheduledBirth = getEmergenceGeneration(
            phenology.emergenceStart,
            foliage.emergenceInterval,
            phenology.maturityGeneration,
            foliage.maturityDuration,
            index,
            count,
        );
        const birthGeneration = Math.max(
            scheduledBirth,
            source.birthGeneration + 0.08,
        );
        const maturityGeneration = birthGeneration + foliage.maturityDuration;
        const developmentStage = getDevelopmentStage(
            generation,
            birthGeneration,
            maturityGeneration,
        );
        const rank = count <= 1 ? 0 : index / (count - 1);
        const senescenceStart =
            phenology.senescenceStart === undefined
                ? undefined
                : Math.max(
                      birthGeneration,
                      phenology.senescenceStart + rank * 0.8,
                  );
        const senescenceDuration = Math.max(
            0.75,
            foliage.maturityDuration * 0.75,
        );
        const deathGeneration =
            senescenceStart === undefined
                ? undefined
                : senescenceStart + senescenceDuration;
        const health =
            senescenceStart === undefined
                ? 1
                : 1 -
                  smoothstep(
                      (generation - senescenceStart) / senescenceDuration,
                  );
        const sizeMultiplier =
            lerp(foliage.sizeRange[0], foliage.sizeRange[1], 1 - rank * 0.45) *
            rng.nextRange(1 - variability, 1 + variability);
        const matureSize = plantDefinition.leaf.size * sizeMultiplier;
        const azimuth =
            foliage.arrangement === 'opposite'
                ? source.azimuth + (index % 2) * Math.PI
                : source.azimuth + rng.nextRange(-0.09, 0.09);
        const petioleLength =
            matureSize *
            foliage.petioleLengthScale *
            rng.nextRange(1 - variability, 1 + variability);
        const pitchDegrees = lerp(
            foliage.pitchRangeDegrees[0],
            foliage.pitchRangeDegrees[1],
            foliage.arrangement === 'rosette' ? rank : rng.nextFloat(),
        );
        const pitch = degreesToRadians(pitchDegrees);
        const petioleEnd = add(
            source.position,
            radial(
                azimuth,
                petioleLength * Math.sin(pitch),
                petioleLength * Math.cos(pitch),
            ),
        );
        let parentId = source.id;
        if (petioleLength > 0.002) {
            const petioleId = `petiole:${index.toString()}`;
            const petioleAdded = graph.addOrgan({
                ...createBaseOrgan({
                    birthGeneration,
                    deathGeneration,
                    generation,
                    health,
                    id: petioleId,
                    maturityGeneration,
                    parentId,
                }),
                end: petioleEnd,
                endRadius: Math.max(
                    plantDefinition.stem.minRadius * 0.42,
                    0.0015,
                ),
                start: source.position,
                startRadius: Math.max(
                    plantDefinition.stem.minRadius * 0.7,
                    0.0025,
                ),
                type: 'petiole',
            });
            if (!petioleAdded) {
                continue;
            }
            parentId = petioleId;
        }

        graph.addOrgan({
            ...createBaseOrgan({
                birthGeneration,
                deathGeneration,
                generation,
                health,
                id: leafId,
                maturityGeneration,
                parentId,
            }),
            transform: {
                position: petioleEnd,
                rotationRadians: vector3(
                    pitch,
                    azimuth,
                    rng.nextRange(-0.12, 0.12),
                ),
                scale: vector3(
                    matureSize * 0.64 * lerp(0.18, 1, developmentStage),
                    matureSize * developmentStage,
                    matureSize * developmentStage,
                ),
            },
            type: 'leaf',
        });
    }
}

function resolveReproductiveSite(
    sites: OrganSite[],
    rootId: string,
    index: number,
): OrganSite {
    if (sites.length === 0) {
        return {
            azimuth: (index / Math.max(1, sites.length)) * Math.PI * 2,
            birthGeneration: 0,
            id: rootId,
            position: vector3(0, 0.05, 0),
        };
    }

    const scaledIndex = Math.floor(
        ((index + 1) / Math.max(index + 2, 2)) * sites.length,
    );
    return sites[Math.min(sites.length - 1, scaledIndex)] ?? sites[0];
}

function addReproduction({
    generation,
    graph,
    plantDefinition,
    rootId,
    sites,
}: {
    generation: number;
    graph: ReturnType<typeof createGraphBuilder>;
    plantDefinition: PlantDefinition;
    rootId: string;
    sites: OrganSite[];
}) {
    const { reproduction } = plantDefinition.development;
    const flowerCount = plantDefinition.flower.enabled
        ? Math.max(
              0,
              Math.round(reproduction.siteCount * reproduction.flowersPerSite),
          )
        : 0;
    const produceCount = plantDefinition.vegetable.enabled
        ? Math.max(0, Math.round(reproduction.produceCount))
        : 0;
    const totalSites = Math.max(flowerCount, produceCount);

    for (let index = 0; index < totalSites; index += 1) {
        const source = resolveReproductiveSite(sites, rootId, index);
        const siteId = `reproductive-site:${index.toString()}`;
        const rng = graph.createOrganRng(siteId);
        const groupIndex = Math.floor(
            index / Math.max(1, reproduction.flowersPerSite),
        );
        const azimuth =
            source.azimuth +
            (index % Math.max(1, reproduction.flowersPerSite)) * 0.72;
        const spread =
            plantDefinition.flower.size *
            (0.7 + (index % Math.max(1, reproduction.flowersPerSite)) * 0.28);
        const sitePosition = add(
            source.position,
            radial(
                azimuth,
                spread,
                reproduction.site === 'terminal' ||
                    reproduction.site === 'umbel' ||
                    reproduction.site === 'spike'
                    ? spread * (1.2 + groupIndex * 0.1)
                    : -spread * 0.15,
            ),
        );
        const flowerBirth = reproduction.flowerStart + groupIndex * 0.22;
        const fruitBirth =
            reproduction.fruitStart === undefined
                ? undefined
                : reproduction.fruitStart + index * 0.07;
        const isFruitSite = index < produceCount && fruitBirth !== undefined;

        if (index < flowerCount) {
            const flowerStage = getDevelopmentStage(
                generation,
                flowerBirth,
                flowerBirth + 1.2,
            );
            graph.addOrgan({
                ...createBaseOrgan({
                    birthGeneration: flowerBirth,
                    deathGeneration: isFruitSite ? fruitBirth : undefined,
                    generation,
                    id: `flower:${index.toString()}`,
                    maturityGeneration: flowerBirth + 1.2,
                    parentId: source.id,
                }),
                transform: {
                    position: sitePosition,
                    rotationRadians: vector3(Math.PI / 2, azimuth, 0),
                    scale: vector3(
                        plantDefinition.flower.size * flowerStage,
                        plantDefinition.flower.size * flowerStage,
                        plantDefinition.flower.size * flowerStage,
                    ),
                },
                type: 'flower',
            });
        }

        if (!isFruitSite || fruitBirth === undefined) {
            continue;
        }

        graph.addOrgan({
            ...createBaseOrgan({
                birthGeneration: fruitBirth,
                generation,
                id: `fruit:${index.toString()}`,
                maturityGeneration: fruitBirth + 2.2,
                parentId: source.id,
            }),
            produceType: plantDefinition.vegetable.type,
            transform: {
                position: add(
                    sitePosition,
                    vector3(0, -plantDefinition.vegetable.baseSize * 0.18, 0),
                ),
                rotationRadians: vector3(
                    Math.PI,
                    azimuth,
                    rng.nextRange(-0.1, 0.1),
                ),
                scale: vector3(
                    plantDefinition.vegetable.baseSize,
                    plantDefinition.vegetable.baseSize,
                    plantDefinition.vegetable.baseSize,
                ),
            },
            type: 'fruit',
        });
    }
}

function addStorageOrgan({
    generation,
    graph,
    plantDefinition,
    rootId,
}: {
    generation: number;
    graph: ReturnType<typeof createGraphBuilder>;
    plantDefinition: PlantDefinition;
    rootId: string;
}) {
    const storage = plantDefinition.development.storage;
    if (!storage || !plantDefinition.vegetable.enabled) {
        return;
    }

    const size = plantDefinition.vegetable.baseSize * storage.sizeScale;
    graph.addOrgan({
        ...createBaseOrgan({
            birthGeneration: storage.birthGeneration,
            generation,
            id: 'storage-organ',
            maturityGeneration: storage.matureGeneration,
            parentId: rootId,
        }),
        produceType: plantDefinition.vegetable.type,
        transform: {
            position: vector3(0, size * (storage.aboveSoilFraction - 0.5), 0),
            rotationRadians: vector3(Math.PI, 0, 0),
            scale: vector3(size, size, size),
        },
        type: 'root',
    });
}

function addSpecialOrgans({
    generation,
    graph,
    plantDefinition,
    rootId,
    sites,
}: {
    generation: number;
    graph: ReturnType<typeof createGraphBuilder>;
    plantDefinition: PlantDefinition;
    rootId: string;
    sites: OrganSite[];
}) {
    const special = plantDefinition.development.special;
    if (!special) {
        return;
    }

    const runnerCount = Math.max(0, Math.round(special.runnerCount ?? 0));
    for (let index = 0; index < runnerCount; index += 1) {
        const id = `runner:${index.toString()}`;
        const birthGeneration = 6.5 + index * 0.35;
        const angle = (index / Math.max(1, runnerCount)) * Math.PI * 2;
        const start = vector3(0, 0.03, 0);
        const end = add(
            start,
            radial(angle, plantDefinition.height * 0.72, -0.012),
        );
        graph.addOrgan({
            ...createBaseOrgan({
                birthGeneration,
                generation,
                id,
                maturityGeneration: birthGeneration + 1.8,
                parentId: rootId,
            }),
            end,
            endRadius: Math.max(0.0015, plantDefinition.stem.minRadius * 0.4),
            start,
            startRadius: Math.max(0.002, plantDefinition.stem.minRadius * 0.7),
            type: 'runner',
        });
    }

    const tendrilCount = Math.max(0, Math.round(special.tendrilCount ?? 0));
    for (let index = 0; index < tendrilCount; index += 1) {
        const source = sites[index % sites.length];
        if (!source) {
            continue;
        }
        const id = `tendril:${index.toString()}`;
        const birthGeneration = Math.max(
            4.5 + index * 0.25,
            source.birthGeneration,
        );
        const length = Math.max(0.035, plantDefinition.leaf.size * 0.52);
        const end = add(
            source.position,
            radial(source.azimuth + Math.PI / 2, length, length * 0.38),
        );
        graph.addOrgan({
            ...createBaseOrgan({
                birthGeneration,
                generation,
                id,
                maturityGeneration: birthGeneration + 1.2,
                parentId: source.id,
            }),
            end,
            endRadius: 0.0012,
            start: source.position,
            startRadius: 0.0018,
            type: 'tendril',
        });
    }

    const thornCount = Math.max(0, Math.round(special.thornCount ?? 0));
    for (let index = 0; index < thornCount; index += 1) {
        const source = sites[index % sites.length];
        if (!source) {
            continue;
        }
        const id = `thorn:${index.toString()}`;
        const birthGeneration = Math.max(
            3.5 + index * 0.12,
            source.birthGeneration,
        );
        const stage = getDevelopmentStage(
            generation,
            birthGeneration,
            birthGeneration + 0.8,
        );
        graph.addOrgan({
            ...createBaseOrgan({
                birthGeneration,
                generation,
                id,
                maturityGeneration: birthGeneration + 0.8,
                parentId: source.id,
            }),
            transform: {
                position: source.position,
                rotationRadians: vector3(
                    Math.PI / 2,
                    source.azimuth + (index % 2 === 0 ? 0.4 : -0.4),
                    0,
                ),
                scale: vector3(
                    (plantDefinition.thorn?.size ?? 0.04) * stage,
                    (plantDefinition.thorn?.size ?? 0.04) * stage,
                    (plantDefinition.thorn?.size ?? 0.04) * stage,
                ),
            },
            type: 'thorn',
        });
    }
}

export function buildDevelopmentalPlantGraph({
    generation,
    plantDefinition,
    seed,
}: BuildDevelopmentalPlantGraphOptions): DevelopmentalPlantGraph {
    const boundedGeneration = clamp(generation, 0, MAX_PLANT_GENERATION);
    const graph = createGraphBuilder(boundedGeneration, plantDefinition, seed);
    const crownHeight =
        plantDefinition.development.architecture === 'tree'
            ? 0
            : Math.max(0.018, plantDefinition.height * 0.035);
    const rootId = addRootMeristem(graph, boundedGeneration, crownHeight);
    const sites =
        plantDefinition.development.architecture === 'rosette' ||
        plantDefinition.development.architecture === 'clump'
            ? buildBasalSites({
                  graph,
                  plantDefinition,
                  rootId,
              })
            : buildAxisSites({
                  generation: boundedGeneration,
                  graph,
                  plantDefinition,
                  rootId,
              });

    addFoliage({
        generation: boundedGeneration,
        graph,
        plantDefinition,
        rootId,
        sites,
    });
    addReproduction({
        generation: boundedGeneration,
        graph,
        plantDefinition,
        rootId,
        sites,
    });
    addStorageOrgan({
        generation: boundedGeneration,
        graph,
        plantDefinition,
        rootId,
    });
    addSpecialOrgans({
        generation: boundedGeneration,
        graph,
        plantDefinition,
        rootId,
        sites,
    });

    return graph.finish(rootId);
}
