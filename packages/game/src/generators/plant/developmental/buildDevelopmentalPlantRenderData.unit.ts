import assert from 'node:assert/strict';
import test from 'node:test';
import { type Matrix4, Vector3 } from 'three';
import type { PlantDefinition } from '../lib/plant-definitions';
import { plantTypes } from '../lib/plant-definitions';
import type { PlantRenderData } from '../lib/plantRenderData';
import { buildDevelopmentalPlantRenderData } from './buildDevelopmentalPlantRenderData';
import { buildDevelopmentalPlantGraph } from './developmentalPlantGraph';

const PLANT_ENTRIES = Object.entries(plantTypes);

function assertFiniteMatrix(matrix: Matrix4) {
    assert.equal(matrix.elements.length, 16);
    assert.ok(
        matrix.elements.every((value) => Number.isFinite(value)),
        'Expected every transform component to be finite',
    );
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
