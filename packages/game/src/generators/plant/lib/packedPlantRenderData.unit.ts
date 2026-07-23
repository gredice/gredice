import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
    buildPlantRenderData,
    type PlantRenderData,
} from './buildPlantRenderData';
import { generateLSystemStringWithGenerations } from './l-system';
import {
    composePackedPlantRenderDataInstance,
    getPackedPlantRenderDataTransferables,
    getPackedPlantRenderDataTransferByteLength,
    mergePackedPlantRenderDataBatches,
    mergePackedPlantRenderDataInstances,
    PACKED_PLANT_RENDER_DATA_VERSION,
    type PackedPlantRenderData,
    type PackedPlantRootTransform,
    packPlantRenderData,
} from './packedPlantRenderData';
import {
    type PlantDefinition,
    plantTypes,
    type VegetableType,
} from './plant-definitions';
import { SeededRNG } from './rng';

const fixtures = [
    { generation: 9, plantType: 'tomato' },
    { generation: 6, plantType: 'carrot' },
    { generation: 6, plantType: 'lettuce' },
    { generation: 7, plantType: 'youngappletree' },
    { generation: 8, plantType: 'raspberry' },
] as const;

const floweringDefinition: PlantDefinition = {
    ...plantTypes.tomato,
    axiom: 'F[L][P]',
    flower: {
        ...plantTypes.tomato.flower,
        ageStart: 0,
        enabled: true,
    },
    rules: {},
    vegetable: {
        ...plantTypes.tomato.vegetable,
        enabled: false,
    },
};

function buildExactRenderData({
    definition,
    generation,
    seed,
}: {
    definition: PlantDefinition;
    generation: number;
    seed: string;
}) {
    const symbols = generateLSystemStringWithGenerations(
        definition.axiom,
        definition.rules,
        generation,
        new SeededRNG(seed),
    );

    return buildPlantRenderData({
        flowerGrowth: 1,
        fruitGrowth: 1,
        generation,
        lSystemSymbols: symbols,
        plantDefinition: definition,
        renderDetailedGeometry: true,
        seed,
    });
}

function createRootMatrix({
    translation,
    uniformScale,
    yawRadians = 0,
}: PackedPlantRootTransform) {
    return new THREE.Matrix4().compose(
        new THREE.Vector3(...translation),
        new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yawRadians,
        ),
        new THREE.Vector3().setScalar(uniformScale),
    );
}

function applyReferenceRootTransform(
    matrices: readonly THREE.Matrix4[],
    transform: PackedPlantRootTransform,
) {
    const rootMatrix = createRootMatrix(transform);
    return matrices.map((matrix) => matrix.clone().premultiply(rootMatrix));
}

function bakeReferenceVegetableGrowth(
    vegetable: PlantRenderData['vegetables'][number],
    transform: PackedPlantRootTransform,
) {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const rooted = vegetable.matrix
        .clone()
        .premultiply(createRootMatrix(transform));
    rooted.decompose(position, quaternion, scale);
    scale.multiplyScalar(vegetable.growth);
    return new THREE.Matrix4().compose(position, quaternion, scale);
}

function assertPackedMatricesEqual(
    actual: Float32Array,
    expected: readonly { elements: ArrayLike<number> }[],
    label: string,
) {
    assert.equal(actual.length, expected.length * 16, `${label} length`);

    expected.forEach((matrix, matrixIndex) => {
        for (let elementIndex = 0; elementIndex < 16; elementIndex += 1) {
            assert.equal(
                actual[matrixIndex * 16 + elementIndex],
                Math.fround(matrix.elements[elementIndex]),
                `${label} matrix ${matrixIndex} element ${elementIndex}`,
            );
        }
    });
}

function assertPackedMatricesClose(
    actual: Float32Array,
    expected: readonly THREE.Matrix4[],
    label: string,
) {
    assert.equal(actual.length, expected.length * 16, `${label} length`);

    expected.forEach((matrix, matrixIndex) => {
        for (let elementIndex = 0; elementIndex < 16; elementIndex += 1) {
            const actualValue = actual[matrixIndex * 16 + elementIndex];
            const expectedValue = matrix.elements[elementIndex];
            assert.ok(
                Math.abs(actualValue - expectedValue) <= 0.000_01,
                `${label} matrix ${matrixIndex} element ${elementIndex}: expected ${expectedValue}, received ${actualValue}`,
            );
        }
    });
}

function assertPackedValuesEqual(
    actual: Float32Array,
    expected: readonly number[],
    label: string,
) {
    assert.equal(actual.length, expected.length, `${label} length`);
    expected.forEach((value, index) => {
        assert.equal(actual[index], Math.fround(value), `${label} ${index}`);
    });
}

function assertPackedRenderDataEqual(
    packed: PackedPlantRenderData,
    exact: PlantRenderData,
) {
    assert.equal(packed.version, PACKED_PLANT_RENDER_DATA_VERSION);
    assert.deepEqual(packed.lodSummary, exact.lodSummary);
    assert.notEqual(packed.lodSummary, exact.lodSummary);

    assert.equal(packed.stems.count, exact.stemSegments.length);
    assertPackedMatricesEqual(
        packed.stems.matrices,
        exact.stemSegments.map((segment) => segment.matrix),
        'stem',
    );
    assertPackedValuesEqual(
        packed.stems.radii,
        exact.stemSegments.flatMap((segment) => [
            segment.startRadius,
            segment.endRadius,
        ]),
        'stem radius',
    );
    assert.ok(packed.stems.swayPhases.every((phase) => phase === 0));

    assert.equal(packed.leaves.count, exact.leaves.length);
    assertPackedMatricesEqual(packed.leaves.matrices, exact.leaves, 'leaf');
    assertPackedValuesEqual(
        packed.leaves.colors,
        exact.leafColors.flatMap((color) => [color.r, color.g, color.b]),
        'leaf color',
    );
    assert.ok(packed.leaves.swayPhases.every((phase) => phase === 0));

    assert.equal(packed.flowers.count, exact.flowers.length);
    assertPackedMatricesEqual(packed.flowers.matrices, exact.flowers, 'flower');
    assert.ok(packed.flowers.swayPhases.every((phase) => phase === 0));
    assert.equal(packed.thorns.count, exact.thorns.length);
    assertPackedMatricesEqual(packed.thorns.matrices, exact.thorns, 'thorn');
    assert.ok(packed.thorns.swayPhases.every((phase) => phase === 0));

    const expectedVegetables = new Map<
        VegetableType,
        PlantRenderData['vegetables']
    >();
    for (const vegetable of exact.vegetables) {
        const grouped = expectedVegetables.get(vegetable.type);
        if (grouped) {
            grouped.push(vegetable);
        } else {
            expectedVegetables.set(vegetable.type, [vegetable]);
        }
    }

    assert.deepEqual(
        packed.vegetables.map((vegetable) => vegetable.type),
        Array.from(expectedVegetables.keys()),
    );
    for (const vegetableGroup of packed.vegetables) {
        const expected = expectedVegetables.get(vegetableGroup.type);
        assert.ok(expected);
        assert.equal(vegetableGroup.count, expected.length);
        assertPackedMatricesEqual(
            vegetableGroup.matrices,
            expected.map((vegetable) => vegetable.matrix),
            `${vegetableGroup.type} vegetable`,
        );
        assertPackedValuesEqual(
            vegetableGroup.growth,
            expected.map((vegetable) => vegetable.growth),
            `${vegetableGroup.type} growth`,
        );
        assert.ok(vegetableGroup.swayPhases.every((phase) => phase === 0));
    }
}

function getExpectedTransferByteLength(packed: PackedPlantRenderData) {
    return (
        packed.stems.matrices.byteLength +
        packed.stems.radii.byteLength +
        packed.stems.swayPhases.byteLength +
        packed.leaves.matrices.byteLength +
        packed.leaves.colors.byteLength +
        packed.leaves.swayPhases.byteLength +
        packed.flowers.matrices.byteLength +
        packed.flowers.swayPhases.byteLength +
        packed.thorns.matrices.byteLength +
        packed.thorns.swayPhases.byteLength +
        packed.vegetables.reduce(
            (total, vegetable) =>
                total +
                vegetable.matrices.byteLength +
                vegetable.growth.byteLength +
                vegetable.swayPhases.byteLength,
            0,
        )
    );
}

test('packs representative exact plant render data without changing GPU-visible values', () => {
    const covered = {
        flowers: 0,
        leaves: 0,
        stems: 0,
        thorns: 0,
        vegetables: 0,
    };

    for (const fixture of fixtures) {
        const definition = plantTypes[fixture.plantType];
        const exact = buildExactRenderData({
            definition,
            generation: fixture.generation,
            seed: `${fixture.plantType}:packed-golden`,
        });
        const packed = packPlantRenderData(exact);

        assertPackedRenderDataEqual(packed, exact);
        covered.flowers += exact.flowers.length;
        covered.leaves += exact.leaves.length;
        covered.stems += exact.stemSegments.length;
        covered.thorns += exact.thorns.length;
        covered.vegetables += exact.vegetables.length;
    }

    const exactFlowers = buildExactRenderData({
        definition: floweringDefinition,
        generation: 1,
        seed: 'flower:packed-golden',
    });
    assertPackedRenderDataEqual(
        packPlantRenderData(exactFlowers),
        exactFlowers,
    );
    covered.flowers += exactFlowers.flowers.length;

    assert.ok(covered.stems > 0);
    assert.ok(covered.leaves > 0);
    assert.ok(covered.flowers > 0);
    assert.ok(covered.vegetables > 0);
    assert.ok(covered.thorns > 0);
});

test('collects unique transferable buffers and reports their exact byte cost', () => {
    const exact = buildExactRenderData({
        definition: plantTypes.tomato,
        generation: 9,
        seed: 'tomato:packed-transfer',
    });
    const packed = packPlantRenderData(exact);
    const transferables = getPackedPlantRenderDataTransferables(packed);
    const expectedBytes = getExpectedTransferByteLength(packed);

    assert.equal(new Set(transferables).size, transferables.length);
    assert.equal(
        getPackedPlantRenderDataTransferByteLength(packed),
        expectedBytes,
    );
    assert.equal(
        transferables.reduce(
            (total, transferable) => total + transferable.byteLength,
            0,
        ),
        expectedBytes,
    );

    const nonEmptyTransferables = transferables.filter(
        (transferable) => transferable.byteLength > 0,
    );
    const cloned = structuredClone(packed, { transfer: transferables });

    assert.ok(
        nonEmptyTransferables.every(
            (transferable) => transferable.byteLength === 0,
        ),
    );
    assert.equal(
        getPackedPlantRenderDataTransferByteLength(cloned),
        expectedBytes,
    );
    assertPackedRenderDataEqual(cloned, exact);
});

test('packed bounds contain underground produce and all box corners', () => {
    const packed = packPlantRenderData(
        buildExactRenderData({
            definition: plantTypes.carrot,
            generation: 6,
            seed: 'carrot:packed-bounds',
        }),
    );
    const carrots = packed.vegetables.find(
        (vegetable) => vegetable.type === 'carrot',
    );
    assert.ok(carrots);
    assert.ok(carrots.count > 0);

    let lowestProduceExtent = Infinity;
    for (let index = 0; index < carrots.count; index += 1) {
        const offset = index * 16;
        const maximumScale = Math.max(
            Math.hypot(
                carrots.matrices[offset],
                carrots.matrices[offset + 1],
                carrots.matrices[offset + 2],
            ),
            Math.hypot(
                carrots.matrices[offset + 4],
                carrots.matrices[offset + 5],
                carrots.matrices[offset + 6],
            ),
            Math.hypot(
                carrots.matrices[offset + 8],
                carrots.matrices[offset + 9],
                carrots.matrices[offset + 10],
            ),
        );
        lowestProduceExtent = Math.min(
            lowestProduceExtent,
            carrots.matrices[offset + 13] -
                maximumScale * (carrots.growth[index] ?? 1),
        );
    }

    assert.ok(lowestProduceExtent < 0);
    assert.ok(packed.bounds.boxMin[1] <= lowestProduceExtent);
    for (const x of [packed.bounds.boxMin[0], packed.bounds.boxMax[0]]) {
        for (const y of [packed.bounds.boxMin[1], packed.bounds.boxMax[1]]) {
            for (const z of [
                packed.bounds.boxMin[2],
                packed.bounds.boxMax[2],
            ]) {
                assert.ok(
                    Math.hypot(
                        x - packed.bounds.sphereCenter[0],
                        y - packed.bounds.sphereCenter[1],
                        z - packed.bounds.sphereCenter[2],
                    ) <=
                        packed.bounds.sphereRadius + 0.000_01,
                );
            }
        }
    }
});

test('composes root transforms and bakes vegetable growth like the current renderer', () => {
    const exact = buildExactRenderData({
        definition: plantTypes.tomato,
        generation: 9,
        seed: 'tomato:packed',
    });
    assert.ok(exact.vegetables.length > 0);
    const packed = packPlantRenderData(exact);
    const transform: PackedPlantRootTransform = {
        swayPhaseRadians: 2.4,
        translation: [1.25, -0.4, 2.75],
        uniformScale: 0.72,
        yawRadians: 0.63,
    };
    const composed = composePackedPlantRenderDataInstance(packed, transform);

    assert.equal(composed.stems.count, packed.stems.count);
    assertPackedMatricesClose(
        composed.stems.matrices,
        applyReferenceRootTransform(
            exact.stemSegments.map((segment) => segment.matrix),
            transform,
        ),
        'composed stem',
    );
    assert.deepEqual(composed.stems.radii, packed.stems.radii);
    assert.ok(
        composed.stems.swayPhases.every((phase) => phase === Math.fround(2.4)),
    );
    assertPackedMatricesClose(
        composed.leaves.matrices,
        applyReferenceRootTransform(exact.leaves, transform),
        'composed leaf',
    );
    assert.deepEqual(composed.leaves.colors, packed.leaves.colors);
    assert.ok(
        composed.leaves.swayPhases.every((phase) => phase === Math.fround(2.4)),
    );
    assertPackedMatricesClose(
        composed.flowers.matrices,
        applyReferenceRootTransform(exact.flowers, transform),
        'composed flower',
    );
    assertPackedMatricesClose(
        composed.thorns.matrices,
        applyReferenceRootTransform(exact.thorns, transform),
        'composed thorn',
    );

    assert.deepEqual(
        composed.vegetables.map((vegetable) => vegetable.type),
        ['tomato'],
    );
    const composedTomatoes = composed.vegetables[0];
    assert.ok(composedTomatoes);
    assert.ok(
        composedTomatoes.swayPhases.every(
            (phase) => phase === Math.fround(2.4),
        ),
    );
    assertPackedMatricesClose(
        composedTomatoes.matrices,
        exact.vegetables.map((vegetable) =>
            bakeReferenceVegetableGrowth(vegetable, transform),
        ),
        'composed tomato',
    );
    assert.deepEqual(
        Array.from(composedTomatoes.growth),
        Array.from({ length: composedTomatoes.count }, () => 1),
    );
    assert.ok(
        packed.vegetables.some((vegetable) =>
            Array.from(vegetable.growth).some((growth) => growth !== 1),
        ),
    );
    assert.deepEqual(composed.lodSummary, packed.lodSummary);
    assert.notEqual(composed.lodSummary, packed.lodSummary);
});

test('merges exact template instances while preserving channel and produce order', () => {
    const tomatoExact = buildExactRenderData({
        definition: plantTypes.tomato,
        generation: 9,
        seed: 'tomato:packed',
    });
    const carrotExact = buildExactRenderData({
        definition: plantTypes.carrot,
        generation: 6,
        seed: 'carrot:packed-merge',
    });
    const raspberryExact = buildExactRenderData({
        definition: plantTypes.raspberry,
        generation: 8,
        seed: 'raspberry:packed-golden',
    });
    const flowerExact = buildExactRenderData({
        definition: floweringDefinition,
        generation: 1,
        seed: 'flower:packed-golden',
    });
    const tomatoTemplate = packPlantRenderData(tomatoExact);
    const sources: {
        exact: PlantRenderData;
        template: PackedPlantRenderData;
        transform: PackedPlantRootTransform;
    }[] = [
        {
            exact: tomatoExact,
            template: tomatoTemplate,
            transform: {
                swayPhaseRadians: 0.2,
                translation: [0.4, -0.75, -0.2],
                uniformScale: 0.66,
                yawRadians: -0.35,
            },
        },
        {
            exact: carrotExact,
            template: packPlantRenderData(carrotExact),
            transform: {
                swayPhaseRadians: 0.4,
                translation: [-0.1, -0.75, 0.25],
                uniformScale: 0.82,
                yawRadians: 1.1,
            },
        },
        {
            exact: raspberryExact,
            template: packPlantRenderData(raspberryExact),
            transform: {
                swayPhaseRadians: 0.6,
                translation: [0.12, -0.75, 0.36],
                uniformScale: 0.7,
            },
        },
        {
            exact: flowerExact,
            template: packPlantRenderData(flowerExact),
            transform: {
                swayPhaseRadians: 0.8,
                translation: [-0.32, -0.75, -0.4],
                uniformScale: 0.58,
                yawRadians: 2.2,
            },
        },
        {
            exact: tomatoExact,
            template: tomatoTemplate,
            transform: {
                swayPhaseRadians: 1,
                translation: [0.3, -0.75, 0.42],
                uniformScale: 0.61,
                yawRadians: 0.9,
            },
        },
    ];
    const merged = mergePackedPlantRenderDataInstances(
        sources.map(({ template, transform }) => ({ template, transform })),
    );

    assert.equal(
        merged.stems.count,
        sources.reduce(
            (total, source) => total + source.exact.stemSegments.length,
            0,
        ),
    );
    assert.equal(
        merged.leaves.count,
        sources.reduce(
            (total, source) => total + source.exact.leaves.length,
            0,
        ),
    );
    assert.equal(
        merged.flowers.count,
        sources.reduce(
            (total, source) => total + source.exact.flowers.length,
            0,
        ),
    );
    assert.equal(
        merged.thorns.count,
        sources.reduce(
            (total, source) => total + source.exact.thorns.length,
            0,
        ),
    );
    assert.ok(merged.flowers.count > 0);
    assert.ok(merged.thorns.count > 0);

    assertPackedMatricesClose(
        merged.stems.matrices,
        sources.flatMap((source) =>
            applyReferenceRootTransform(
                source.exact.stemSegments.map((segment) => segment.matrix),
                source.transform,
            ),
        ),
        'merged stem',
    );
    assertPackedMatricesClose(
        merged.leaves.matrices,
        sources.flatMap((source) =>
            applyReferenceRootTransform(source.exact.leaves, source.transform),
        ),
        'merged leaf',
    );
    assertPackedMatricesClose(
        merged.flowers.matrices,
        sources.flatMap((source) =>
            applyReferenceRootTransform(source.exact.flowers, source.transform),
        ),
        'merged flower',
    );
    assertPackedMatricesClose(
        merged.thorns.matrices,
        sources.flatMap((source) =>
            applyReferenceRootTransform(source.exact.thorns, source.transform),
        ),
        'merged thorn',
    );
    assert.deepEqual(
        Array.from(merged.stems.radii),
        sources.flatMap((source) => Array.from(source.template.stems.radii)),
    );
    assert.deepEqual(
        Array.from(merged.leaves.colors),
        sources.flatMap((source) => Array.from(source.template.leaves.colors)),
    );
    assert.deepEqual(
        Array.from(merged.stems.swayPhases),
        sources.flatMap((source) =>
            Array.from({ length: source.template.stems.count }, () =>
                Math.fround(source.transform.swayPhaseRadians ?? 0),
            ),
        ),
    );

    const expectedVegetables = new Map<VegetableType, THREE.Matrix4[]>();
    for (const source of sources) {
        for (const vegetable of source.exact.vegetables) {
            const matrices = expectedVegetables.get(vegetable.type);
            const matrix = bakeReferenceVegetableGrowth(
                vegetable,
                source.transform,
            );
            if (matrices) {
                matrices.push(matrix);
            } else {
                expectedVegetables.set(vegetable.type, [matrix]);
            }
        }
    }
    assert.deepEqual(
        merged.vegetables.map((vegetable) => vegetable.type),
        Array.from(expectedVegetables.keys()),
    );
    for (const vegetable of merged.vegetables) {
        const expected = expectedVegetables.get(vegetable.type);
        assert.ok(expected);
        assert.equal(vegetable.count, expected.length);
        assertPackedMatricesClose(
            vegetable.matrices,
            expected,
            `merged ${vegetable.type}`,
        );
        assert.ok(Array.from(vegetable.growth).every((growth) => growth === 1));
    }

    assert.deepEqual(merged.lodSummary, tomatoTemplate.lodSummary);
    assert.notEqual(merged.lodSummary, tomatoTemplate.lodSummary);
});

test('consolidates rooted packed chunks without changing their values', () => {
    const packed = packPlantRenderData(
        buildExactRenderData({
            definition: plantTypes.tomato,
            generation: 8,
            seed: 'rooted-chunk',
        }),
    );
    const first = composePackedPlantRenderDataInstance(packed, {
        swayPhaseRadians: 0.5,
        translation: [1, 0, 0],
        uniformScale: 0.8,
    });
    const second = composePackedPlantRenderDataInstance(packed, {
        swayPhaseRadians: 1.5,
        translation: [-1, 0, 0],
        uniformScale: 0.6,
        yawRadians: 1.2,
    });
    const consolidated = mergePackedPlantRenderDataBatches([first, second]);

    assert.equal(consolidated.stems.count, first.stems.count * 2);
    assert.deepEqual(Array.from(consolidated.stems.matrices), [
        ...first.stems.matrices,
        ...second.stems.matrices,
    ]);
    assert.deepEqual(Array.from(consolidated.leaves.colors), [
        ...first.leaves.colors,
        ...second.leaves.colors,
    ]);
    assert.deepEqual(Array.from(consolidated.stems.swayPhases), [
        ...first.stems.swayPhases,
        ...second.stems.swayPhases,
    ]);
});

test('rejects empty batches and invalid root transforms', () => {
    const exact = buildExactRenderData({
        definition: plantTypes.lettuce,
        generation: 6,
        seed: 'lettuce:packed-transform-invalid',
    });
    const packed = packPlantRenderData(exact);

    assert.throws(
        () => mergePackedPlantRenderDataInstances([]),
        /At least one packed plant template instance/,
    );
    assert.throws(
        () =>
            composePackedPlantRenderDataInstance(packed, {
                translation: [0, 0, 0],
                uniformScale: -1,
            }),
        /non-negative finite scale/,
    );
});

test('rejects render data with mismatched leaf matrices and colors', () => {
    const exact = buildExactRenderData({
        definition: plantTypes.lettuce,
        generation: 6,
        seed: 'lettuce:packed-invalid',
    });

    assert.throws(
        () =>
            packPlantRenderData({
                ...exact,
                leafColors: exact.leafColors.slice(1),
            }),
        /Expected .* leaf color values/,
    );
});
