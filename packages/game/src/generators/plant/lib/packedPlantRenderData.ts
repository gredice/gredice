import type { PlantLodSummary, PlantRenderData } from './buildPlantRenderData';
import type { VegetableType } from './plant-definitions';

export const PACKED_PLANT_RENDER_DATA_VERSION = 1 as const;

export interface PackedPlantMatrixInstances {
    count: number;
    matrices: Float32Array;
    swayPhases: Float32Array;
}

export interface PackedPlantStemInstances extends PackedPlantMatrixInstances {
    radii: Float32Array;
}

export interface PackedPlantLeafInstances extends PackedPlantMatrixInstances {
    colors: Float32Array;
}

export interface PackedPlantVegetableInstances
    extends PackedPlantMatrixInstances {
    growth: Float32Array;
    type: VegetableType;
}

export interface PackedPlantBounds {
    boxMax: readonly [number, number, number];
    boxMin: readonly [number, number, number];
    sphereCenter: readonly [number, number, number];
    sphereRadius: number;
}

/**
 * Structured-clone-safe plant data. The large, per-instance payloads are
 * contiguous typed arrays so a worker can transfer their backing buffers.
 */
export interface PackedPlantRenderData {
    bounds: PackedPlantBounds;
    flowers: PackedPlantMatrixInstances;
    leaves: PackedPlantLeafInstances;
    lodSummary: PlantLodSummary;
    stems: PackedPlantStemInstances;
    thorns: PackedPlantMatrixInstances;
    vegetables: PackedPlantVegetableInstances[];
    version: typeof PACKED_PLANT_RENDER_DATA_VERSION;
}

export interface PackedPlantRootTransform {
    leafColorMultiplier?: readonly [number, number, number];
    swayPhaseRadians?: number;
    translation: readonly [number, number, number];
    uniformScale: number;
    yawRadians?: number;
}

export interface PackedPlantTemplateInstance {
    template: PackedPlantRenderData;
    transform: PackedPlantRootTransform;
}

interface ResolvedPackedPlantRootTransform {
    cosine: number;
    leafColorBlueMultiplier: number;
    leafColorGreenMultiplier: number;
    leafColorRedMultiplier: number;
    sine: number;
    swayPhaseRadians: number;
    translationX: number;
    translationY: number;
    translationZ: number;
    uniformScale: number;
}

const FLOWER_LOCAL_BOUND_RADIUS = 2.2;
const LEAF_LOCAL_BOUND_RADIUS = 2.4;
const THORN_LOCAL_BOUND_RADIUS = 0.95;
const VEGETABLE_LOCAL_BOUND_RADIUS = 2;

type PackedBoundsAccumulator = {
    boxMax: [number, number, number];
    boxMin: [number, number, number];
};

function expandPackedBoundsByMatrixSphere({
    accumulator,
    localCenter = [0, 0, 0],
    localRadius,
    matrices,
    matrixIndex,
}: {
    accumulator: PackedBoundsAccumulator;
    localCenter?: readonly [number, number, number];
    localRadius: number;
    matrices: Float32Array;
    matrixIndex: number;
}) {
    const offset = matrixIndex * 16;
    const centerX =
        matrices[offset] * localCenter[0] +
        matrices[offset + 4] * localCenter[1] +
        matrices[offset + 8] * localCenter[2] +
        matrices[offset + 12];
    const centerY =
        matrices[offset + 1] * localCenter[0] +
        matrices[offset + 5] * localCenter[1] +
        matrices[offset + 9] * localCenter[2] +
        matrices[offset + 13];
    const centerZ =
        matrices[offset + 2] * localCenter[0] +
        matrices[offset + 6] * localCenter[1] +
        matrices[offset + 10] * localCenter[2] +
        matrices[offset + 14];
    const maximumScale = Math.max(
        Math.hypot(
            matrices[offset],
            matrices[offset + 1],
            matrices[offset + 2],
        ),
        Math.hypot(
            matrices[offset + 4],
            matrices[offset + 5],
            matrices[offset + 6],
        ),
        Math.hypot(
            matrices[offset + 8],
            matrices[offset + 9],
            matrices[offset + 10],
        ),
    );
    const radius = localRadius * maximumScale;

    accumulator.boxMin[0] = Math.min(accumulator.boxMin[0], centerX - radius);
    accumulator.boxMin[1] = Math.min(accumulator.boxMin[1], centerY - radius);
    accumulator.boxMin[2] = Math.min(accumulator.boxMin[2], centerZ - radius);
    accumulator.boxMax[0] = Math.max(accumulator.boxMax[0], centerX + radius);
    accumulator.boxMax[1] = Math.max(accumulator.boxMax[1], centerY + radius);
    accumulator.boxMax[2] = Math.max(accumulator.boxMax[2], centerZ + radius);
}

function createPackedPlantBounds({
    flowers,
    leaves,
    lodSummary,
    stems,
    thorns,
    vegetables,
}: Omit<PackedPlantRenderData, 'bounds' | 'version'>): PackedPlantBounds {
    const accumulator: PackedBoundsAccumulator = {
        boxMax: [-Infinity, -Infinity, -Infinity],
        boxMin: [Infinity, Infinity, Infinity],
    };

    for (let index = 0; index < stems.count; index += 1) {
        const radiusOffset = index * 2;
        const stemRadius = Math.max(
            stems.radii[radiusOffset] ?? 0,
            stems.radii[radiusOffset + 1] ?? 0,
        );
        expandPackedBoundsByMatrixSphere({
            accumulator,
            localCenter: [0, 0.5, 0],
            localRadius: Math.hypot(stemRadius + 0.45, 0.5),
            matrices: stems.matrices,
            matrixIndex: index,
        });
    }
    for (let index = 0; index < leaves.count; index += 1) {
        expandPackedBoundsByMatrixSphere({
            accumulator,
            localRadius: LEAF_LOCAL_BOUND_RADIUS,
            matrices: leaves.matrices,
            matrixIndex: index,
        });
    }
    for (let index = 0; index < flowers.count; index += 1) {
        expandPackedBoundsByMatrixSphere({
            accumulator,
            localRadius: FLOWER_LOCAL_BOUND_RADIUS,
            matrices: flowers.matrices,
            matrixIndex: index,
        });
    }
    for (let index = 0; index < thorns.count; index += 1) {
        expandPackedBoundsByMatrixSphere({
            accumulator,
            localCenter: [0, 0.5, 0],
            localRadius: THORN_LOCAL_BOUND_RADIUS,
            matrices: thorns.matrices,
            matrixIndex: index,
        });
    }
    for (const vegetable of vegetables) {
        for (let index = 0; index < vegetable.count; index += 1) {
            expandPackedBoundsByMatrixSphere({
                accumulator,
                localRadius:
                    VEGETABLE_LOCAL_BOUND_RADIUS *
                    (vegetable.growth[index] ?? 1),
                matrices: vegetable.matrices,
                matrixIndex: index,
            });
        }
    }

    if (!accumulator.boxMin.every(Number.isFinite)) {
        const halfWidth = Math.max(
            lodSummary.canopyWidth / 2,
            lodSummary.stemWidth / 2,
            0.001,
        );
        const height = Math.max(lodSummary.height, 0.001);
        accumulator.boxMin = [-halfWidth, 0, -halfWidth];
        accumulator.boxMax = [halfWidth, height, halfWidth];
    }

    const sphereCenter: readonly [number, number, number] = [
        (accumulator.boxMin[0] + accumulator.boxMax[0]) / 2,
        (accumulator.boxMin[1] + accumulator.boxMax[1]) / 2,
        (accumulator.boxMin[2] + accumulator.boxMax[2]) / 2,
    ];

    return {
        boxMax: accumulator.boxMax,
        boxMin: accumulator.boxMin,
        sphereCenter,
        sphereRadius: Math.hypot(
            accumulator.boxMax[0] - sphereCenter[0],
            accumulator.boxMax[1] - sphereCenter[1],
            accumulator.boxMax[2] - sphereCenter[2],
        ),
    };
}

function assertPackedPlantBounds(bounds: PackedPlantBounds) {
    if (
        !bounds.boxMin.every(Number.isFinite) ||
        !bounds.boxMax.every(Number.isFinite) ||
        !bounds.sphereCenter.every(Number.isFinite) ||
        !Number.isFinite(bounds.sphereRadius) ||
        bounds.sphereRadius < 0 ||
        bounds.boxMin.some(
            (component, index) => component > bounds.boxMax[index],
        )
    ) {
        throw new RangeError('Packed plant bounds must be finite and ordered');
    }
}

function packMatrices(
    matrices: readonly { elements: ArrayLike<number> }[],
): Float32Array {
    const packed = new Float32Array(matrices.length * 16);

    matrices.forEach((matrix, index) => {
        packed.set(matrix.elements, index * 16);
    });

    return packed;
}

function assertMatchingCount({
    actual,
    expected,
    label,
}: {
    actual: number;
    expected: number;
    label: string;
}) {
    if (actual !== expected) {
        throw new RangeError(
            `Expected ${expected} ${label} values, received ${actual}`,
        );
    }
}

function assertInstanceCount(count: number, label: string) {
    if (!Number.isInteger(count) || count < 0) {
        throw new RangeError(`${label} count must be a non-negative integer`);
    }
}

function assertPackedMatrixInstances(
    instances: PackedPlantMatrixInstances,
    label: string,
) {
    assertInstanceCount(instances.count, label);
    assertMatchingCount({
        actual: instances.matrices.length,
        expected: instances.count * 16,
        label: `${label} matrix component`,
    });
    assertMatchingCount({
        actual: instances.swayPhases.length,
        expected: instances.count,
        label: `${label} sway phase`,
    });
}

function assertPackedPlantRenderData(packed: PackedPlantRenderData) {
    if (packed.version !== PACKED_PLANT_RENDER_DATA_VERSION) {
        throw new RangeError(
            `Unsupported packed plant render data version ${packed.version}`,
        );
    }

    assertPackedPlantBounds(packed.bounds);
    assertPackedMatrixInstances(packed.stems, 'stem');
    assertMatchingCount({
        actual: packed.stems.radii.length,
        expected: packed.stems.count * 2,
        label: 'stem radius',
    });
    assertPackedMatrixInstances(packed.leaves, 'leaf');
    assertMatchingCount({
        actual: packed.leaves.colors.length,
        expected: packed.leaves.count * 3,
        label: 'leaf color component',
    });
    assertPackedMatrixInstances(packed.flowers, 'flower');
    assertPackedMatrixInstances(packed.thorns, 'thorn');

    for (const vegetable of packed.vegetables) {
        assertPackedMatrixInstances(vegetable, `${vegetable.type} vegetable`);
        assertMatchingCount({
            actual: vegetable.growth.length,
            expected: vegetable.count,
            label: `${vegetable.type} vegetable growth`,
        });
    }
}

function resolvePackedPlantRootTransform({
    leafColorMultiplier = [1, 1, 1],
    swayPhaseRadians = 0,
    translation,
    uniformScale,
    yawRadians = 0,
}: PackedPlantRootTransform): ResolvedPackedPlantRootTransform {
    if (
        !translation.every((component) => Number.isFinite(component)) ||
        !leafColorMultiplier.every(
            (component) => Number.isFinite(component) && component >= 0,
        ) ||
        !Number.isFinite(uniformScale) ||
        uniformScale < 0 ||
        !Number.isFinite(yawRadians) ||
        !Number.isFinite(swayPhaseRadians)
    ) {
        throw new RangeError(
            'Packed plant root transforms require finite translation/yaw/color and non-negative finite scale/color multipliers',
        );
    }

    return {
        cosine: Math.cos(yawRadians),
        leafColorBlueMultiplier: leafColorMultiplier[2],
        leafColorGreenMultiplier: leafColorMultiplier[1],
        leafColorRedMultiplier: leafColorMultiplier[0],
        sine: Math.sin(yawRadians),
        swayPhaseRadians,
        translationX: translation[0],
        translationY: translation[1],
        translationZ: translation[2],
        uniformScale,
    };
}

function transformPackedMatricesInto({
    growth,
    source,
    target,
    targetMatrixOffset,
    transform,
}: {
    growth?: Float32Array;
    source: Float32Array;
    target: Float32Array;
    targetMatrixOffset: number;
    transform: ResolvedPackedPlantRootTransform;
}) {
    const matrixCount = source.length / 16;
    if (growth) {
        assertMatchingCount({
            actual: growth.length,
            expected: matrixCount,
            label: 'matrix growth',
        });
    }

    for (let matrixIndex = 0; matrixIndex < matrixCount; matrixIndex += 1) {
        const sourceOffset = matrixIndex * 16;
        const targetOffset = (targetMatrixOffset + matrixIndex) * 16;
        const growthScale = growth?.[matrixIndex] ?? 1;
        if (!Number.isFinite(growthScale) || growthScale < 0) {
            throw new RangeError(
                'Packed plant matrix growth must be finite and non-negative',
            );
        }

        for (let column = 0; column < 4; column += 1) {
            const sourceColumnOffset = sourceOffset + column * 4;
            const targetColumnOffset = targetOffset + column * 4;
            const sourceX = source[sourceColumnOffset];
            const sourceY = source[sourceColumnOffset + 1];
            const sourceZ = source[sourceColumnOffset + 2];
            const sourceW = source[sourceColumnOffset + 3];
            const columnScale = column < 3 ? growthScale : 1;

            target[targetColumnOffset] =
                (transform.uniformScale *
                    (transform.cosine * sourceX + transform.sine * sourceZ) +
                    transform.translationX * sourceW) *
                columnScale;
            target[targetColumnOffset + 1] =
                (transform.uniformScale * sourceY +
                    transform.translationY * sourceW) *
                columnScale;
            target[targetColumnOffset + 2] =
                (transform.uniformScale *
                    (-transform.sine * sourceX + transform.cosine * sourceZ) +
                    transform.translationZ * sourceW) *
                columnScale;
            target[targetColumnOffset + 3] = sourceW * columnScale;
        }
    }
}

export function packPlantRenderData(
    renderData: PlantRenderData,
): PackedPlantRenderData {
    assertMatchingCount({
        actual: renderData.leafColors.length,
        expected: renderData.leaves.length,
        label: 'leaf color',
    });

    const stemMatrices = packMatrices(
        renderData.stemSegments.map((segment) => segment.matrix),
    );
    const stemRadii = new Float32Array(renderData.stemSegments.length * 2);
    renderData.stemSegments.forEach((segment, index) => {
        stemRadii[index * 2] = segment.startRadius;
        stemRadii[index * 2 + 1] = segment.endRadius;
    });

    const leafColors = new Float32Array(renderData.leafColors.length * 3);
    renderData.leafColors.forEach((color, index) => {
        leafColors[index * 3] = color.r;
        leafColors[index * 3 + 1] = color.g;
        leafColors[index * 3 + 2] = color.b;
    });

    const vegetablesByType = new Map<
        VegetableType,
        PlantRenderData['vegetables']
    >();
    for (const vegetable of renderData.vegetables) {
        const grouped = vegetablesByType.get(vegetable.type);
        if (grouped) {
            grouped.push(vegetable);
        } else {
            vegetablesByType.set(vegetable.type, [vegetable]);
        }
    }

    const vegetables = Array.from(
        vegetablesByType,
        ([type, groupedVegetables]) => ({
            count: groupedVegetables.length,
            growth: Float32Array.from(
                groupedVegetables,
                (vegetable) => vegetable.growth,
            ),
            matrices: packMatrices(
                groupedVegetables.map((vegetable) => vegetable.matrix),
            ),
            swayPhases: new Float32Array(groupedVegetables.length),
            type,
        }),
    );
    const flowers: PackedPlantMatrixInstances = {
        count: renderData.flowers.length,
        matrices: packMatrices(renderData.flowers),
        swayPhases: new Float32Array(renderData.flowers.length),
    };
    const leaves: PackedPlantLeafInstances = {
        colors: leafColors,
        count: renderData.leaves.length,
        matrices: packMatrices(renderData.leaves),
        swayPhases: new Float32Array(renderData.leaves.length),
    };
    const lodSummary = { ...renderData.lodSummary };
    const stems: PackedPlantStemInstances = {
        count: renderData.stemSegments.length,
        matrices: stemMatrices,
        radii: stemRadii,
        swayPhases: new Float32Array(renderData.stemSegments.length),
    };
    const thorns: PackedPlantMatrixInstances = {
        count: renderData.thorns.length,
        matrices: packMatrices(renderData.thorns),
        swayPhases: new Float32Array(renderData.thorns.length),
    };

    return {
        bounds: createPackedPlantBounds({
            flowers,
            leaves,
            lodSummary,
            stems,
            thorns,
            vegetables,
        }),
        flowers,
        leaves,
        lodSummary,
        stems,
        thorns,
        vegetables,
        version: PACKED_PLANT_RENDER_DATA_VERSION,
    };
}

/**
 * Applies an instance root transform and returns exact packed batch data.
 * Vegetable growth is baked into its matrices and normalized to one.
 */
export function composePackedPlantRenderDataInstance(
    template: PackedPlantRenderData,
    transform: PackedPlantRootTransform,
) {
    return mergePackedPlantRenderDataInstances([{ template, transform }]);
}

function concatenatePackedFloat32Arrays(arrays: readonly Float32Array[]) {
    const result = new Float32Array(
        arrays.reduce((total, array) => total + array.length, 0),
    );
    let offset = 0;

    for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
    }

    return result;
}

export function mergePackedPlantRenderDataBatches(
    batches: readonly PackedPlantRenderData[],
) {
    if (batches.length === 0) {
        throw new RangeError(
            'At least one packed plant render batch is required',
        );
    }
    if (batches.length === 1) {
        const [batch] = batches;
        if (batch) {
            assertPackedPlantRenderData(batch);
            return batch;
        }
    }

    batches.forEach(assertPackedPlantRenderData);
    const firstBatch = batches[0];
    if (!firstBatch) {
        throw new RangeError(
            'At least one packed plant render batch is required',
        );
    }
    const boxMin: [number, number, number] = [Infinity, Infinity, Infinity];
    const boxMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const batch of batches) {
        for (let axis = 0; axis < 3; axis += 1) {
            boxMin[axis] = Math.min(boxMin[axis], batch.bounds.boxMin[axis]);
            boxMax[axis] = Math.max(boxMax[axis], batch.bounds.boxMax[axis]);
        }
    }
    const sphereCenter: readonly [number, number, number] = [
        (boxMin[0] + boxMax[0]) / 2,
        (boxMin[1] + boxMax[1]) / 2,
        (boxMin[2] + boxMax[2]) / 2,
    ];
    const vegetableBatches = new Map<
        VegetableType,
        PackedPlantVegetableInstances[]
    >();
    for (const batch of batches) {
        for (const vegetable of batch.vegetables) {
            const grouped = vegetableBatches.get(vegetable.type);
            if (grouped) {
                grouped.push(vegetable);
            } else {
                vegetableBatches.set(vegetable.type, [vegetable]);
            }
        }
    }

    return {
        bounds: {
            boxMax,
            boxMin,
            sphereCenter,
            sphereRadius: Math.hypot(
                boxMax[0] - sphereCenter[0],
                boxMax[1] - sphereCenter[1],
                boxMax[2] - sphereCenter[2],
            ),
        },
        flowers: {
            count: batches.reduce(
                (total, batch) => total + batch.flowers.count,
                0,
            ),
            matrices: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.flowers.matrices),
            ),
            swayPhases: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.flowers.swayPhases),
            ),
        },
        leaves: {
            colors: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.leaves.colors),
            ),
            count: batches.reduce(
                (total, batch) => total + batch.leaves.count,
                0,
            ),
            matrices: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.leaves.matrices),
            ),
            swayPhases: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.leaves.swayPhases),
            ),
        },
        lodSummary: { ...firstBatch.lodSummary },
        stems: {
            count: batches.reduce(
                (total, batch) => total + batch.stems.count,
                0,
            ),
            matrices: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.stems.matrices),
            ),
            radii: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.stems.radii),
            ),
            swayPhases: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.stems.swayPhases),
            ),
        },
        thorns: {
            count: batches.reduce(
                (total, batch) => total + batch.thorns.count,
                0,
            ),
            matrices: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.thorns.matrices),
            ),
            swayPhases: concatenatePackedFloat32Arrays(
                batches.map((batch) => batch.thorns.swayPhases),
            ),
        },
        vegetables: Array.from(vegetableBatches, ([type, grouped]) => ({
            count: grouped.reduce(
                (total, vegetable) => total + vegetable.count,
                0,
            ),
            growth: concatenatePackedFloat32Arrays(
                grouped.map((vegetable) => vegetable.growth),
            ),
            matrices: concatenatePackedFloat32Arrays(
                grouped.map((vegetable) => vegetable.matrices),
            ),
            swayPhases: concatenatePackedFloat32Arrays(
                grouped.map((vegetable) => vegetable.swayPhases),
            ),
            type,
        })),
        version: PACKED_PLANT_RENDER_DATA_VERSION,
    };
}

/**
 * Builds one exact packed batch without allocating Three.js math objects.
 *
 * Large channels retain template/instance order. Vegetable groups are merged
 * by first-seen type. The first template's LOD summary is retained for schema
 * compatibility; exact batch rendering must use per-instance billboard
 * summaries rather than treating it as an aggregate bound.
 */
export function mergePackedPlantRenderDataInstances(
    instances: readonly PackedPlantTemplateInstance[],
): PackedPlantRenderData {
    if (instances.length === 0) {
        throw new RangeError(
            'At least one packed plant template instance is required',
        );
    }

    const resolvedInstances = instances.map((instance) => {
        assertPackedPlantRenderData(instance.template);
        return {
            template: instance.template,
            transform: resolvePackedPlantRootTransform(instance.transform),
        };
    });
    const transformedBounds = resolvedInstances.map(
        ({ template, transform }) => {
            const sourceCenter = template.bounds.sphereCenter;
            const centerX =
                transform.uniformScale *
                    (transform.cosine * sourceCenter[0] +
                        transform.sine * sourceCenter[2]) +
                transform.translationX;
            const centerY =
                transform.uniformScale * sourceCenter[1] +
                transform.translationY;
            const centerZ =
                transform.uniformScale *
                    (-transform.sine * sourceCenter[0] +
                        transform.cosine * sourceCenter[2]) +
                transform.translationZ;
            return {
                center: [centerX, centerY, centerZ] as const,
                radius: template.bounds.sphereRadius * transform.uniformScale,
            };
        },
    );
    const boundsBoxMin: [number, number, number] = [
        Infinity,
        Infinity,
        Infinity,
    ];
    const boundsBoxMax: [number, number, number] = [
        -Infinity,
        -Infinity,
        -Infinity,
    ];
    for (const bounds of transformedBounds) {
        for (let axis = 0; axis < 3; axis += 1) {
            boundsBoxMin[axis] = Math.min(
                boundsBoxMin[axis],
                bounds.center[axis] - bounds.radius,
            );
            boundsBoxMax[axis] = Math.max(
                boundsBoxMax[axis],
                bounds.center[axis] + bounds.radius,
            );
        }
    }
    const boundsSphereCenter: readonly [number, number, number] = [
        (boundsBoxMin[0] + boundsBoxMax[0]) / 2,
        (boundsBoxMin[1] + boundsBoxMax[1]) / 2,
        (boundsBoxMin[2] + boundsBoxMax[2]) / 2,
    ];
    const boundsSphereRadius = transformedBounds.reduce(
        (radius, bounds) =>
            Math.max(
                radius,
                Math.hypot(
                    bounds.center[0] - boundsSphereCenter[0],
                    bounds.center[1] - boundsSphereCenter[1],
                    bounds.center[2] - boundsSphereCenter[2],
                ) + bounds.radius,
            ),
        0,
    );
    const stemCount = resolvedInstances.reduce(
        (total, instance) => total + instance.template.stems.count,
        0,
    );
    const leafCount = resolvedInstances.reduce(
        (total, instance) => total + instance.template.leaves.count,
        0,
    );
    const flowerCount = resolvedInstances.reduce(
        (total, instance) => total + instance.template.flowers.count,
        0,
    );
    const thornCount = resolvedInstances.reduce(
        (total, instance) => total + instance.template.thorns.count,
        0,
    );
    const vegetableCounts = new Map<VegetableType, number>();
    for (const instance of resolvedInstances) {
        for (const vegetable of instance.template.vegetables) {
            vegetableCounts.set(
                vegetable.type,
                (vegetableCounts.get(vegetable.type) ?? 0) + vegetable.count,
            );
        }
    }

    const stems: PackedPlantStemInstances = {
        count: stemCount,
        matrices: new Float32Array(stemCount * 16),
        radii: new Float32Array(stemCount * 2),
        swayPhases: new Float32Array(stemCount),
    };
    const leaves: PackedPlantLeafInstances = {
        colors: new Float32Array(leafCount * 3),
        count: leafCount,
        matrices: new Float32Array(leafCount * 16),
        swayPhases: new Float32Array(leafCount),
    };
    const flowers: PackedPlantMatrixInstances = {
        count: flowerCount,
        matrices: new Float32Array(flowerCount * 16),
        swayPhases: new Float32Array(flowerCount),
    };
    const thorns: PackedPlantMatrixInstances = {
        count: thornCount,
        matrices: new Float32Array(thornCount * 16),
        swayPhases: new Float32Array(thornCount),
    };
    const vegetableTargets = new Map<
        VegetableType,
        {
            data: PackedPlantVegetableInstances;
            matrixOffset: number;
        }
    >();
    for (const [type, count] of vegetableCounts) {
        vegetableTargets.set(type, {
            data: {
                count,
                growth: new Float32Array(count),
                matrices: new Float32Array(count * 16),
                swayPhases: new Float32Array(count),
                type,
            },
            matrixOffset: 0,
        });
    }

    let stemOffset = 0;
    let leafOffset = 0;
    let flowerOffset = 0;
    let thornOffset = 0;
    for (const instance of resolvedInstances) {
        const { template, transform } = instance;
        transformPackedMatricesInto({
            source: template.stems.matrices,
            target: stems.matrices,
            targetMatrixOffset: stemOffset,
            transform,
        });
        stems.radii.set(template.stems.radii, stemOffset * 2);
        stems.swayPhases.fill(
            transform.swayPhaseRadians,
            stemOffset,
            stemOffset + template.stems.count,
        );
        stemOffset += template.stems.count;

        transformPackedMatricesInto({
            source: template.leaves.matrices,
            target: leaves.matrices,
            targetMatrixOffset: leafOffset,
            transform,
        });
        for (
            let colorIndex = 0;
            colorIndex < template.leaves.colors.length;
            colorIndex += 3
        ) {
            const targetIndex = leafOffset * 3 + colorIndex;
            leaves.colors[targetIndex] = Math.min(
                1,
                template.leaves.colors[colorIndex] *
                    transform.leafColorRedMultiplier,
            );
            leaves.colors[targetIndex + 1] = Math.min(
                1,
                template.leaves.colors[colorIndex + 1] *
                    transform.leafColorGreenMultiplier,
            );
            leaves.colors[targetIndex + 2] = Math.min(
                1,
                template.leaves.colors[colorIndex + 2] *
                    transform.leafColorBlueMultiplier,
            );
        }
        leaves.swayPhases.fill(
            transform.swayPhaseRadians,
            leafOffset,
            leafOffset + template.leaves.count,
        );
        leafOffset += template.leaves.count;

        transformPackedMatricesInto({
            source: template.flowers.matrices,
            target: flowers.matrices,
            targetMatrixOffset: flowerOffset,
            transform,
        });
        flowers.swayPhases.fill(
            transform.swayPhaseRadians,
            flowerOffset,
            flowerOffset + template.flowers.count,
        );
        flowerOffset += template.flowers.count;

        transformPackedMatricesInto({
            source: template.thorns.matrices,
            target: thorns.matrices,
            targetMatrixOffset: thornOffset,
            transform,
        });
        thorns.swayPhases.fill(
            transform.swayPhaseRadians,
            thornOffset,
            thornOffset + template.thorns.count,
        );
        thornOffset += template.thorns.count;

        for (const vegetable of template.vegetables) {
            const target = vegetableTargets.get(vegetable.type);
            if (!target) {
                throw new Error(
                    `Missing packed vegetable target for ${vegetable.type}`,
                );
            }

            transformPackedMatricesInto({
                growth: vegetable.growth,
                source: vegetable.matrices,
                target: target.data.matrices,
                targetMatrixOffset: target.matrixOffset,
                transform,
            });
            target.data.growth.fill(
                1,
                target.matrixOffset,
                target.matrixOffset + vegetable.count,
            );
            target.data.swayPhases.fill(
                transform.swayPhaseRadians,
                target.matrixOffset,
                target.matrixOffset + vegetable.count,
            );
            target.matrixOffset += vegetable.count;
        }
    }

    return {
        bounds: {
            boxMax: boundsBoxMax,
            boxMin: boundsBoxMin,
            sphereCenter: boundsSphereCenter,
            sphereRadius: boundsSphereRadius,
        },
        flowers,
        leaves,
        lodSummary: { ...resolvedInstances[0].template.lodSummary },
        stems,
        thorns,
        vegetables: Array.from(
            vegetableTargets.values(),
            (target) => target.data,
        ),
        version: PACKED_PLANT_RENDER_DATA_VERSION,
    };
}

function getPackedPlantRenderDataViews(
    packed: PackedPlantRenderData,
): Float32Array[] {
    return [
        packed.stems.matrices,
        packed.stems.radii,
        packed.stems.swayPhases,
        packed.leaves.matrices,
        packed.leaves.colors,
        packed.leaves.swayPhases,
        packed.flowers.matrices,
        packed.flowers.swayPhases,
        packed.thorns.matrices,
        packed.thorns.swayPhases,
        ...packed.vegetables.flatMap((vegetable) => [
            vegetable.matrices,
            vegetable.growth,
            vegetable.swayPhases,
        ]),
    ];
}

/**
 * Returns each transferable backing buffer once, including when future packed
 * views share a buffer.
 */
export function getPackedPlantRenderDataTransferables(
    packed: PackedPlantRenderData,
): ArrayBuffer[] {
    const transferables: ArrayBuffer[] = [];
    const seen = new Set<ArrayBuffer>();

    for (const view of getPackedPlantRenderDataViews(packed)) {
        if (!(view.buffer instanceof ArrayBuffer)) {
            throw new TypeError(
                'Packed plant render data must use transferable ArrayBuffer storage',
            );
        }
        if (seen.has(view.buffer)) {
            continue;
        }

        seen.add(view.buffer);
        transferables.push(view.buffer);
    }

    return transferables;
}

/**
 * Counts bytes that will change ownership when the packed payload is posted
 * with getPackedPlantRenderDataTransferables().
 */
export function getPackedPlantRenderDataTransferByteLength(
    packed: PackedPlantRenderData,
) {
    return getPackedPlantRenderDataTransferables(packed).reduce(
        (total, buffer) => total + buffer.byteLength,
        0,
    );
}
