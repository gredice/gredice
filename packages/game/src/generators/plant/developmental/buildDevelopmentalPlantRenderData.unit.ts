import assert from 'node:assert/strict';
import test from 'node:test';
import { type Matrix4, Vector3 } from 'three';
import type { PlantDefinition } from '../lib/plant-definitions';
import { plantTypes } from '../lib/plant-definitions';
import type { PlantRenderData } from '../lib/plantRenderData';
import { buildDevelopmentalPlantRenderData } from './buildDevelopmentalPlantRenderData';
import {
    buildDevelopmentalPlantGraph,
    type DevelopmentalPlantGraph,
} from './developmentalPlantGraph';

const PLANT_ENTRIES = Object.entries(plantTypes);

function assertFiniteMatrix(matrix: Matrix4) {
    assert.equal(matrix.elements.length, 16);
    assert.ok(
        matrix.elements.every((value) => Number.isFinite(value)),
        'Expected every transform component to be finite',
    );
}

function assertVectorClose(
    actual: Vector3,
    expected: Vector3,
    message: string,
) {
    assert.ok(
        actual.distanceTo(expected) < 1e-7,
        `${message}: expected ${expected.toArray().join(', ')}, received ${actual.toArray().join(', ')}`,
    );
}

function getStemEndpoints(matrix: Matrix4) {
    return {
        end: new Vector3(0, 1, 0).applyMatrix4(matrix),
        start: new Vector3(0, 0, 0).applyMatrix4(matrix),
    };
}

function assertValidRenderData(renderData: PlantRenderData) {
    assert.equal(renderData.leafColors.length, renderData.leaves.length);

    for (const matrix of [
        ...renderData.leaves,
        ...renderData.flowers,
        ...renderData.thorns,
        ...renderData.stemSegments.map((segment) => segment.matrix),
        ...renderData.vegetables.map((vegetable) => vegetable.matrix),
    ]) {
        assertFiniteMatrix(matrix);
    }

    for (const color of renderData.leafColors) {
        assert.ok(Number.isFinite(color.r));
        assert.ok(Number.isFinite(color.g));
        assert.ok(Number.isFinite(color.b));
    }

    for (const segment of renderData.stemSegments) {
        assert.ok(Number.isFinite(segment.startRadius));
        assert.ok(Number.isFinite(segment.endRadius));
        assert.ok(segment.startRadius > 0);
        assert.ok(segment.endRadius > 0);
    }

    for (const vegetable of renderData.vegetables) {
        assert.ok(Number.isFinite(vegetable.color.r));
        assert.ok(Number.isFinite(vegetable.color.g));
        assert.ok(Number.isFinite(vegetable.color.b));
        assert.ok(Number.isFinite(vegetable.growth));
        assert.ok(vegetable.growth > 0);
    }

    const { lodSummary } = renderData;
    for (const value of [
        lodSummary.accentCenterY,
        lodSummary.canopyCenterY,
        lodSummary.canopyWidth,
        lodSummary.height,
        lodSummary.stemWidth,
    ]) {
        assert.ok(Number.isFinite(value));
    }
    assert.ok(lodSummary.canopyWidth > 0);
    assert.ok(lodSummary.height > 0);
    assert.ok(lodSummary.stemWidth > 0);
}

function renderPlant(
    plantDefinition: PlantDefinition,
    generation = 12,
): PlantRenderData {
    const graph = buildDevelopmentalPlantGraph({
        generation,
        plantDefinition,
        seed: `render-${plantDefinition.key}`,
    });

    return buildDevelopmentalPlantRenderData({
        flowerGrowth: 1,
        fruitGrowth: 1,
        graph,
        plantDefinition,
        renderDetailedGeometry: true,
        showFlowers: true,
        showLeaves: true,
        showProduce: true,
    });
}

test('builds finite detailed render data for all 50 plant presets', () => {
    assert.equal(PLANT_ENTRIES.length, 50);

    for (const [plantKey, plantDefinition] of PLANT_ENTRIES) {
        const renderData = renderPlant(plantDefinition);

        assertValidRenderData(renderData);
        assert.ok(renderData.leaves.length > 0, `${plantKey} has no leaves`);
        assert.equal(
            renderData.leaves.length,
            Math.round(plantDefinition.development.foliage.count),
            `${plantKey} rendered an unexpected number of leaves`,
        );
    }
});

test('renders the expected lettuce, tomato, and carrot structures', () => {
    const lettuce = renderPlant(plantTypes.lettuce);
    const tomato = renderPlant(plantTypes.tomato);
    const carrot = renderPlant(plantTypes.carrot);

    assert.equal(lettuce.vegetables.length, 0);
    assert.equal(lettuce.flowers.length, 0);

    assert.ok(tomato.stemSegments.length > 0);
    assert.equal(tomato.vegetables.length, 10);
    assert.deepEqual(
        [...new Set(tomato.vegetables.map((vegetable) => vegetable.type))],
        ['tomato'],
    );

    assert.ok(carrot.stemSegments.length > 0);
    assert.equal(carrot.vegetables.length, 1);
    assert.deepEqual(
        carrot.vegetables.map((vegetable) => vegetable.type),
        ['carrot'],
    );
});

test('keeps child organs attached while parent segments grow', () => {
    const graph: DevelopmentalPlantGraph = {
        architecture: 'upright',
        generation: 1,
        organs: [
            {
                birthGeneration: 0,
                children: ['internode:test'],
                developmentStage: 1,
                health: 1,
                id: 'meristem:root',
                maturityGeneration: 0,
                position: [0, 0, 0],
                type: 'meristem',
            },
            {
                birthGeneration: 0,
                children: ['petiole:test'],
                developmentStage: 0.5,
                end: [0, 1, 0],
                endRadius: 0.01,
                health: 1,
                id: 'internode:test',
                maturityGeneration: 2,
                parentId: 'meristem:root',
                start: [0, 0, 0],
                startRadius: 0.02,
                type: 'internode',
            },
            {
                birthGeneration: 0.5,
                children: ['leaf:test'],
                developmentStage: 0.5,
                end: [1, 1, 0],
                endRadius: 0.005,
                health: 1,
                id: 'petiole:test',
                maturityGeneration: 2.5,
                parentId: 'internode:test',
                start: [0, 1, 0],
                startRadius: 0.01,
                type: 'petiole',
            },
            {
                birthGeneration: 0.5,
                children: [],
                developmentStage: 0.5,
                health: 1,
                id: 'leaf:test',
                maturityGeneration: 2.5,
                parentId: 'petiole:test',
                transform: {
                    position: [1, 1, 0],
                    rotationRadians: [0, 0, 0],
                    scale: [0.1, 0.1, 0.1],
                },
                type: 'leaf',
            },
        ],
        plantKey: plantTypes.tomato.key,
        rootId: 'meristem:root',
        seed: 'growing-child-attachment',
    };
    const renderData = buildDevelopmentalPlantRenderData({
        flowerGrowth: 1,
        fruitGrowth: 1,
        graph,
        plantDefinition: plantTypes.tomato,
        renderDetailedGeometry: true,
    });

    assert.equal(renderData.stemSegments.length, 2);
    assert.equal(renderData.leaves.length, 1);
    const internode = getStemEndpoints(renderData.stemSegments[0]?.matrix);
    const petiole = getStemEndpoints(renderData.stemSegments[1]?.matrix);
    const leafPosition = new Vector3().setFromMatrixPosition(
        renderData.leaves[0],
    );

    assertVectorClose(
        internode.end,
        new Vector3(0, 0.5, 0),
        'Internode should end at its developed length',
    );
    assertVectorClose(
        petiole.start,
        internode.end,
        'Petiole should start at the developed internode endpoint',
    );
    assertVectorClose(
        petiole.end,
        new Vector3(0.5, 0.5, 0),
        'Petiole should grow from its translated start',
    );
    assertVectorClose(
        leafPosition,
        petiole.end,
        'Leaf should stay attached to the developed petiole endpoint',
    );
});

test('orients rosette leaves around the crown azimuth', () => {
    const lettuce = renderPlant(plantTypes.lettuce);
    const occupiedQuadrants = new Set(
        lettuce.leaves.map((matrix) => {
            const direction = new Vector3(0, 1, 0).transformDirection(matrix);
            return `${Math.sign(direction.x)}:${Math.sign(direction.z)}`;
        }),
    );

    assert.ok(
        occupiedQuadrants.size >= 3,
        'Lettuce leaf length axes should fan around the crown',
    );
});

test('renders tomato flowers before their sites transition to produce', () => {
    const floweringTomato = renderPlant(plantTypes.tomato, 7);

    assertValidRenderData(floweringTomato);
    assert.ok(floweringTomato.flowers.length > 0);
    assert.equal(floweringTomato.vegetables.length, 0);
});

test('gradually ripens tomato produce to deep red at maturity', () => {
    const ripeningTomato = renderPlant(plantTypes.tomato, 10);
    const ripeTomato = renderPlant(plantTypes.tomato, 12);
    const ripeningColors = new Set(
        ripeningTomato.vegetables.map((vegetable) =>
            vegetable.color.getHexString(),
        ),
    );
    const ripeColors = new Set(
        ripeTomato.vegetables.map((vegetable) =>
            vegetable.color.getHexString(),
        ),
    );

    assert.ok(ripeningColors.size > 1);
    assert.ok([...ripeningColors].every((color) => color !== 'd62828'));
    assert.notEqual(
        ripeningTomato.lodSummary.accentColor,
        `#${ripeningTomato.vegetables.at(-1)?.color.getHexString()}`,
    );
    assert.deepEqual([...ripeColors], ['d62828']);
    assert.equal(ripeTomato.lodSummary.accentColor, '#d62828');
});

test('keeps existing leaf colors stable as new leaves emerge', () => {
    const plantDefinition = plantTypes.tomato;
    const seed = 'stable-leaf-colors';
    const renderAt = (generation: number) => {
        const graph = buildDevelopmentalPlantGraph({
            generation,
            plantDefinition,
            seed,
        });
        const renderData = buildDevelopmentalPlantRenderData({
            flowerGrowth: 1,
            fruitGrowth: 1,
            graph,
            plantDefinition,
            renderDetailedGeometry: true,
        });
        const visibleLeafIds = graph.organs
            .filter(
                (organ) =>
                    organ.type === 'leaf' && organ.developmentStage > 0.01,
            )
            .map((organ) => organ.id);
        assert.equal(visibleLeafIds.length, renderData.leafColors.length);

        return new Map(
            visibleLeafIds.map((id, index) => [
                id,
                renderData.leafColors[index]?.getHexString(),
            ]),
        );
    };

    const before = renderAt(5);
    const after = renderAt(5.2);
    let comparedLeafCount = 0;

    for (const [id, color] of before) {
        if (!after.has(id)) {
            continue;
        }

        assert.equal(after.get(id), color, `${id} changed color`);
        comparedLeafCount += 1;
    }

    assert.ok(comparedLeafCount > 0);
});

test('renders senescing foliage with declining size and color', () => {
    const definition = structuredClone(plantTypes.lettuce);
    definition.development.phenology.senescenceStart = 8;

    const healthy = renderPlant(definition, 7.5);
    const senescing = renderPlant(definition, 8.75);
    const healthyLeaf = healthy.leaves[0];
    const senescingLeaf = senescing.leaves[0];
    const healthyColor = healthy.leafColors[0];
    const senescingColor = senescing.leafColors[0];

    assert.ok(healthyLeaf);
    assert.ok(senescingLeaf);
    assert.ok(healthyColor);
    assert.ok(senescingColor);
    assert.ok(
        senescingLeaf.getMaxScaleOnAxis() < healthyLeaf.getMaxScaleOnAxis(),
    );
    assert.notEqual(senescingColor.getHex(), healthyColor.getHex());
});
