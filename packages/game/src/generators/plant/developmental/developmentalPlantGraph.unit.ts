import assert from 'node:assert/strict';
import test from 'node:test';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../lib/plant-definition-types';
import { plantTypes } from '../lib/plant-definitions';
import {
    buildDevelopmentalPlantGraph,
    type DevelopmentalPlantGraph,
    type PlantOrgan,
} from './developmentalPlantGraph';

const PLANT_ENTRIES = Object.entries(plantTypes);
const LIFECYCLE_GENERATIONS = [0, 0.5, 1, 3, 5, 7, 9, 12];

function buildGraph(
    plantDefinition: PlantDefinition,
    generation = MAX_PLANT_GENERATION,
    seed = `test-${plantDefinition.key}`,
) {
    return buildDevelopmentalPlantGraph({
        generation,
        plantDefinition,
        seed,
    });
}

function getOrgan(graph: DevelopmentalPlantGraph, id: string): PlantOrgan {
    const organ = graph.organs.find((candidate) => candidate.id === id);
    assert.ok(organ, `Expected ${graph.plantKey} graph to contain ${id}`);
    return organ;
}

function assertFiniteVector(values: readonly number[], message: string) {
    assert.ok(
        values.every((value) => Number.isFinite(value)),
        message,
    );
}

function assertFiniteOrgan(organ: PlantOrgan) {
    assert.ok(Number.isFinite(organ.birthGeneration));
    assert.ok(Number.isFinite(organ.maturityGeneration));
    assert.ok(Number.isFinite(organ.developmentStage));
    assert.ok(Number.isFinite(organ.health));
    if (organ.deathGeneration !== undefined) {
        assert.ok(Number.isFinite(organ.deathGeneration));
    }

    switch (organ.type) {
        case 'branch':
        case 'internode':
        case 'petiole':
        case 'runner':
        case 'tendril':
            assertFiniteVector(
                organ.start,
                `${organ.id} has a non-finite start`,
            );
            assertFiniteVector(organ.end, `${organ.id} has a non-finite end`);
            assert.ok(Number.isFinite(organ.startRadius));
            assert.ok(Number.isFinite(organ.endRadius));
            assert.ok(organ.startRadius > 0);
            assert.ok(organ.endRadius > 0);
            break;
        case 'flower':
        case 'fruit':
        case 'leaf':
        case 'root':
        case 'thorn':
            assertFiniteVector(
                organ.transform.position,
                `${organ.id} has a non-finite position`,
            );
            assertFiniteVector(
                organ.transform.rotationRadians,
                `${organ.id} has a non-finite rotation`,
            );
            assertFiniteVector(
                organ.transform.scale,
                `${organ.id} has a non-finite scale`,
            );
            break;
        case 'meristem':
            assertFiniteVector(
                organ.position,
                `${organ.id} has a non-finite position`,
            );
            break;
    }
}

function assertGraphIntegrity(graph: DevelopmentalPlantGraph) {
    const organById = new Map(graph.organs.map((organ) => [organ.id, organ]));
    assert.equal(
        organById.size,
        graph.organs.length,
        `${graph.plantKey} organ identifiers must be unique`,
    );

    const root = organById.get(graph.rootId);
    assert.ok(root, `${graph.plantKey} graph root must exist`);
    assert.equal(root.parentId, undefined, 'The root cannot have a parent');

    for (const organ of graph.organs) {
        assertFiniteOrgan(organ);
        assert.ok(
            organ.birthGeneration <= graph.generation,
            `${organ.id} emerged before its birth generation`,
        );
        assert.ok(
            organ.deathGeneration === undefined ||
                graph.generation < organ.deathGeneration,
            `${organ.id} remained after its death generation`,
        );
        assert.ok(organ.developmentStage >= 0);
        assert.ok(organ.developmentStage <= 1);
        assert.equal(
            new Set(organ.children).size,
            organ.children.length,
            `${organ.id} has duplicate child references`,
        );

        if (organ.parentId === undefined) {
            assert.equal(organ.id, graph.rootId);
        } else {
            const parent = organById.get(organ.parentId);
            assert.ok(parent, `${organ.id} has an orphaned parent`);
            assert.ok(
                parent.children.includes(organ.id),
                `${organ.id} is absent from its parent's children`,
            );
        }

        for (const childId of organ.children) {
            const child = organById.get(childId);
            assert.ok(child, `${organ.id} references missing child ${childId}`);
            assert.equal(child.parentId, organ.id);
        }
    }

    const visited = new Set<string>();
    const pending = [graph.rootId];
    while (pending.length > 0) {
        const id = pending.pop();
        assert.ok(id);
        if (visited.has(id)) {
            continue;
        }

        visited.add(id);
        const organ = organById.get(id);
        assert.ok(organ);
        pending.push(...organ.children);
    }

    assert.equal(
        visited.size,
        graph.organs.length,
        `${graph.plantKey} graph contains unreachable organs`,
    );
}

function assertStableOrganTraits(
    previous: PlantOrgan,
    current: PlantOrgan,
    plantKey: string,
) {
    const context = `${plantKey}:${previous.id}`;
    assert.equal(current.type, previous.type, `${context} changed type`);
    assert.equal(
        current.parentId,
        previous.parentId,
        `${context} changed parent`,
    );
    assert.equal(
        current.birthGeneration,
        previous.birthGeneration,
        `${context} changed birth generation`,
    );
    assert.equal(
        current.maturityGeneration,
        previous.maturityGeneration,
        `${context} changed maturity generation`,
    );
    assert.equal(
        current.deathGeneration,
        previous.deathGeneration,
        `${context} changed death generation`,
    );
    assert.equal(current.health, previous.health, `${context} changed health`);

    if (previous.type !== current.type) {
        return;
    }

    switch (previous.type) {
        case 'branch':
        case 'internode':
        case 'petiole':
        case 'runner':
        case 'tendril':
            assert.ok('start' in current);
            assert.deepEqual(current.start, previous.start);
            assert.deepEqual(current.end, previous.end);
            assert.equal(current.startRadius, previous.startRadius);
            assert.equal(current.endRadius, previous.endRadius);
            break;
        case 'flower':
        case 'leaf':
        case 'thorn':
            assert.ok('transform' in current);
            assert.deepEqual(
                current.transform.position,
                previous.transform.position,
            );
            assert.deepEqual(
                current.transform.rotationRadians,
                previous.transform.rotationRadians,
            );
            break;
        case 'fruit':
        case 'root':
            assert.ok(current.type === 'fruit' || current.type === 'root');
            assert.equal(current.produceType, previous.produceType);
            assert.deepEqual(current.transform, previous.transform);
            break;
        case 'meristem':
            assert.equal(current.type, 'meristem');
            assert.deepEqual(current.position, previous.position);
            break;
    }
}

test('defines exactly 50 deterministic developmental plant presets', () => {
    assert.equal(PLANT_ENTRIES.length, 50);

    for (const [plantKey, plantDefinition] of PLANT_ENTRIES) {
        const options = {
            generation: 8.375,
            plantDefinition,
            seed: `deterministic-${plantKey}`,
        };
        const first = buildDevelopmentalPlantGraph(options);
        const second = buildDevelopmentalPlantGraph(options);

        assert.equal(first.plantKey, plantKey);
        assert.equal(
            first.architecture,
            plantDefinition.development.architecture,
        );
        assert.deepEqual(second, first);
        assertGraphIntegrity(first);
    }
});

test('keeps every plant graph valid throughout its lifecycle', () => {
    for (const [plantKey, plantDefinition] of PLANT_ENTRIES) {
        const snapshots = LIFECYCLE_GENERATIONS.map((generation) =>
            buildGraph(plantDefinition, generation, `lifecycle-${plantKey}`),
        );

        for (const snapshot of snapshots) {
            assertGraphIntegrity(snapshot);
        }

        for (let index = 1; index < snapshots.length; index += 1) {
            const previous = snapshots[index - 1];
            const current = snapshots[index];
            assert.ok(previous);
            assert.ok(current);
            const currentById = new Map(
                current.organs.map((organ) => [organ.id, organ]),
            );

            for (const organ of previous.organs) {
                const later = currentById.get(organ.id);
                if (
                    organ.deathGeneration !== undefined &&
                    current.generation >= organ.deathGeneration
                ) {
                    assert.equal(
                        later,
                        undefined,
                        `${plantKey}:${organ.id} remained after death`,
                    );
                    continue;
                }

                assert.ok(
                    later,
                    `${plantKey}:${organ.id} disappeared before death`,
                );
                assert.ok(
                    later.developmentStage >= organ.developmentStage,
                    `${plantKey}:${organ.id} regressed between generations`,
                );
                assertStableOrganTraits(organ, later, plantKey);
            }
        }
    }
});

test('senesces and removes foliage when a definition enables leaf aging', () => {
    const definition = structuredClone(plantTypes.lettuce);
    definition.development.phenology.senescenceStart = 8;

    const healthyLeaves = buildGraph(
        definition,
        7.5,
        'senescence',
    ).organs.filter((organ) => organ.type === 'leaf');
    const senescingLeaves = buildGraph(
        definition,
        8.75,
        'senescence',
    ).organs.filter((organ) => organ.type === 'leaf');
    const spentLeaves = buildGraph(definition, 11, 'senescence').organs.filter(
        (organ) => organ.type === 'leaf',
    );

    assert.ok(healthyLeaves.length > 0);
    assert.ok(healthyLeaves.every((organ) => organ.health === 1));
    assert.ok(
        senescingLeaves.some((organ) => organ.health > 0 && organ.health < 1),
    );
    assert.equal(spentLeaves.length, 0);
});

test('honors every mature preset organ count', () => {
    for (const [plantKey, plantDefinition] of PLANT_ENTRIES) {
        const graph = buildGraph(
            plantDefinition,
            MAX_PLANT_GENERATION,
            `mature-counts-${plantKey}`,
        );
        const { development } = plantDefinition;
        const requestedFlowerCount = plantDefinition.flower.enabled
            ? Math.max(
                  0,
                  Math.round(
                      development.reproduction.siteCount *
                          development.reproduction.flowersPerSite,
                  ),
              )
            : 0;
        const requestedFruitCount =
            plantDefinition.vegetable.enabled &&
            development.reproduction.fruitStart !== undefined
                ? Math.max(0, Math.round(development.reproduction.produceCount))
                : 0;
        const expectedFlowerCount = Math.max(
            0,
            requestedFlowerCount - requestedFruitCount,
        );

        assert.equal(
            graph.organs.filter((organ) => organ.type === 'leaf').length,
            Math.max(0, Math.round(development.foliage.count)),
            `${plantKey} leaf count`,
        );
        assert.equal(
            graph.organs.filter((organ) => organ.type === 'flower').length,
            expectedFlowerCount,
            `${plantKey} flower count`,
        );
        assert.equal(
            graph.organs.filter((organ) => organ.type === 'fruit').length,
            requestedFruitCount,
            `${plantKey} fruit count`,
        );
        assert.equal(
            graph.organs.filter((organ) => organ.type === 'root').length,
            plantDefinition.vegetable.enabled && development.storage ? 1 : 0,
            `${plantKey} storage-organ count`,
        );
        assert.equal(
            graph.organs.filter((organ) => organ.type === 'runner').length,
            Math.max(0, Math.round(development.special?.runnerCount ?? 0)),
            `${plantKey} runner count`,
        );
        assert.equal(
            graph.organs.filter((organ) => organ.type === 'tendril').length,
            Math.max(0, Math.round(development.special?.tendrilCount ?? 0)),
            `${plantKey} tendril count`,
        );
        assert.equal(
            graph.organs.filter((organ) => organ.type === 'thorn').length,
            Math.max(0, Math.round(development.special?.thornCount ?? 0)),
            `${plantKey} thorn count`,
        );
    }
});

test('builds lettuce as a leaf-only rosette', () => {
    const graph = buildGraph(plantTypes.lettuce, 12, 'mature-lettuce');
    const leaves = graph.organs.filter((organ) => organ.type === 'leaf');
    const petioles = graph.organs.filter((organ) => organ.type === 'petiole');
    const reproductiveOrgans = graph.organs.filter(
        (organ) =>
            organ.type === 'flower' ||
            organ.type === 'fruit' ||
            organ.type === 'root',
    );

    assert.equal(graph.architecture, 'rosette');
    assert.equal(leaves.length, 20);
    assert.equal(petioles.length, 20);
    assert.equal(reproductiveOrgans.length, 0);
    assert.ok(
        leaves.every((leaf) =>
            petioles.some((petiole) => petiole.id === leaf.parentId),
        ),
    );
});

test('builds tomato phytomers and transitions flowers into fruit', () => {
    const mature = buildGraph(plantTypes.tomato, 12, 'tomato-phytomers');

    for (let index = 0; index < 10; index += 1) {
        const internode = getOrgan(mature, `internode:0:${index.toString()}`);
        const petiole = getOrgan(mature, `petiole:${index.toString()}`);
        const leaf = getOrgan(mature, `leaf:${index.toString()}`);

        assert.equal(
            internode.parentId,
            index === 0
                ? mature.rootId
                : `internode:0:${(index - 1).toString()}`,
        );
        assert.equal(petiole.parentId, internode.id);
        assert.equal(leaf.parentId, petiole.id);
    }

    const flowering = buildGraph(plantTypes.tomato, 7.99, 'tomato-transition');
    const fruiting = buildGraph(plantTypes.tomato, 8.01, 'tomato-transition');
    const flower = getOrgan(flowering, 'flower:0');
    const fruit = getOrgan(fruiting, 'fruit:0');

    assert.equal(flower.type, 'flower');
    assert.equal(fruit.type, 'fruit');
    if (flower.type !== 'flower' || fruit.type !== 'fruit') {
        return;
    }
    assert.equal(flower.deathGeneration, fruit.birthGeneration);
    assert.equal(fruit.parentId, flower.parentId);
    assert.equal(
        fruiting.organs.some((organ) => organ.id === flower.id),
        false,
    );
    assert.equal(fruit.produceType, 'tomato');
    assert.ok(fruit.transform.position[1] < flower.transform.position[1]);
});

test('supported main stems keep their height while reducing horizontal lean', () => {
    const supportedTomato = structuredClone(plantTypes.tomato);
    supportedTomato.development.axes.mainStemHorizontalScale = 0.04;
    const freeGraph = buildGraph(plantTypes.tomato, 12, 'supported-stem');
    const supportedGraph = buildGraph(supportedTomato, 12, 'supported-stem');
    const freeTop = getOrgan(freeGraph, 'internode:0:9');
    const supportedTop = getOrgan(supportedGraph, 'internode:0:9');

    assert.equal(freeTop.type, 'internode');
    assert.equal(supportedTop.type, 'internode');
    assert.equal(supportedTop.end[1], freeTop.end[1]);
    assert.ok(
        Math.hypot(supportedTop.end[0], supportedTop.end[2]) <
            Math.hypot(freeTop.end[0], freeTop.end[2]) * 0.5,
    );
});

test('builds carrot with one below-soil storage root and crown leaves', () => {
    const graph = buildGraph(plantTypes.carrot, 12, 'mature-carrot');
    const roots = graph.organs.filter((organ) => organ.type === 'root');
    const petioles = graph.organs.filter((organ) => organ.type === 'petiole');
    const leaves = graph.organs.filter((organ) => organ.type === 'leaf');

    assert.equal(graph.architecture, 'rosette');
    assert.equal(roots.length, 1);
    assert.equal(petioles.length, 15);
    assert.equal(leaves.length, 15);

    const storageRoot = roots[0];
    assert.ok(storageRoot);
    assert.equal(storageRoot.type, 'root');
    if (storageRoot.type !== 'root') {
        return;
    }
    assert.equal(storageRoot.id, 'storage-organ');
    assert.equal(storageRoot.parentId, graph.rootId);
    assert.equal(storageRoot.produceType, 'carrot');
    assert.ok(storageRoot.transform.position[1] < 0);
    assert.ok(petioles.every((petiole) => petiole.parentId === graph.rootId));
    assert.ok(
        leaves.every((leaf) =>
            petioles.some((petiole) => petiole.id === leaf.parentId),
        ),
    );
});
