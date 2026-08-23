import { performance } from 'node:perf_hooks';
import {
    buildGeneratedPlantRenderData,
    generatePlantTopology,
} from '../src/generators/plant/lib/generatedPlantRenderData';
import {
    generatedPlantTemplateVariantCount,
    getGeneratedPlantTemplateSeed,
} from '../src/generators/plant/lib/generatedPlantTemplates';
import {
    getPackedPlantRenderDataTransferables,
    packPlantRenderData,
} from '../src/generators/plant/lib/packedPlantRenderData';
import { plantTypes } from '../src/generators/plant/lib/plant-definitions';

const generations = [4, 8, 12] as const;
const warmupCount = 6;
const sampleCount = 24;

const legacyByGeneration = {
    4: { instances: 8_777, packedBytes: 675_720 },
    8: { instances: 15_129, packedBytes: 1_166_900 },
    12: { instances: 21_258, packedBytes: 1_640_616 },
} as const;

function percentile(values: number[], fraction: number) {
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil(sorted.length * fraction) - 1),
    );
    return sorted[index] ?? 0;
}

function formatMilliseconds(value: number) {
    return value.toFixed(4);
}

function formatChange(current: number, legacy: number) {
    return `${(((current - legacy) / legacy) * 100).toFixed(1)}%`;
}

function getPackedBytes(packed: ReturnType<typeof packPlantRenderData>) {
    return getPackedPlantRenderDataTransferables(packed).reduce(
        (total, buffer) => total + buffer.byteLength,
        0,
    );
}

function getInstanceCount(packed: ReturnType<typeof packPlantRenderData>) {
    return (
        packed.stems.count +
        packed.leaves.count +
        packed.flowers.count +
        packed.thorns.count +
        packed.vegetables.reduce(
            (total, vegetable) => total + vegetable.count,
            0,
        )
    );
}

interface PhaseSamples {
    packing: number[];
    render: number[];
    topology: number[];
    total: number[];
}

const phaseSamplesByGeneration = new Map<number, PhaseSamples>();
const currentByGeneration = new Map<
    number,
    { instances: number; organs: number; packedBytes: number }
>();

for (const generation of generations) {
    const aggregate = { instances: 0, organs: 0, packedBytes: 0 };
    const phaseSamples: PhaseSamples = {
        packing: [],
        render: [],
        topology: [],
        total: [],
    };
    phaseSamplesByGeneration.set(generation, phaseSamples);

    for (const definition of Object.values(plantTypes)) {
        for (
            let variant = 0;
            variant < generatedPlantTemplateVariantCount;
            variant += 1
        ) {
            const seed = getGeneratedPlantTemplateSeed({
                definition,
                variant,
            });
            const build = () => {
                const totalStartedAt = performance.now();
                const topologyStartedAt = performance.now();
                const topology = generatePlantTopology({
                    generation,
                    plantDefinition: definition,
                    seed,
                });
                const topologyDurationMs =
                    performance.now() - topologyStartedAt;
                const renderStartedAt = performance.now();
                const renderData = buildGeneratedPlantRenderData({
                    flowerGrowth: 1,
                    fruitGrowth: 1,
                    plantDefinition: definition,
                    renderDetailedGeometry: true,
                    topology,
                });
                const renderDurationMs = performance.now() - renderStartedAt;
                const packingStartedAt = performance.now();
                const packed = packPlantRenderData(renderData);
                const packingDurationMs = performance.now() - packingStartedAt;

                return {
                    packed,
                    packingDurationMs,
                    renderDurationMs,
                    topology,
                    topologyDurationMs,
                    totalDurationMs: performance.now() - totalStartedAt,
                };
            };

            for (let index = 0; index < warmupCount; index += 1) {
                build();
            }

            let representative: ReturnType<typeof build> | undefined;
            for (let index = 0; index < sampleCount; index += 1) {
                const sample = build();
                representative ??= sample;
                phaseSamples.topology.push(sample.topologyDurationMs);
                phaseSamples.render.push(sample.renderDurationMs);
                phaseSamples.packing.push(sample.packingDurationMs);
                phaseSamples.total.push(sample.totalDurationMs);
            }

            if (representative) {
                aggregate.instances += getInstanceCount(representative.packed);
                aggregate.organs += representative.topology.organs.length;
                aggregate.packedBytes += getPackedBytes(representative.packed);
            }
        }
    }
    currentByGeneration.set(generation, aggregate);
}

console.log(
    `Developmental plant benchmark: ${Object.keys(plantTypes).length} plants × ${generations.length} generations × ${generatedPlantTemplateVariantCount} variants`,
);
console.log(`Warmups/samples per template: ${warmupCount}/${sampleCount}`);
console.table(
    generations.map((generation) => {
        const current = currentByGeneration.get(generation);
        const legacy = legacyByGeneration[generation];
        if (!current) {
            throw new Error(`Missing generation ${generation} result`);
        }
        return {
            generation,
            organs: current.organs,
            instances: current.instances,
            legacyInstances: legacy.instances,
            instanceChange: formatChange(current.instances, legacy.instances),
            packedBytes: current.packedBytes,
            legacyPackedBytes: legacy.packedBytes,
            packedChange: formatChange(current.packedBytes, legacy.packedBytes),
        };
    }),
);
const matureSamples = phaseSamplesByGeneration.get(12);
if (!matureSamples) {
    throw new Error('Missing mature timing samples');
}
console.log('Mature generation phase timings:');
console.table([
    {
        phase: 'topology',
        medianMs: formatMilliseconds(percentile(matureSamples.topology, 0.5)),
        p95Ms: formatMilliseconds(percentile(matureSamples.topology, 0.95)),
    },
    {
        phase: 'render data',
        medianMs: formatMilliseconds(percentile(matureSamples.render, 0.5)),
        p95Ms: formatMilliseconds(percentile(matureSamples.render, 0.95)),
    },
    {
        phase: 'packing',
        medianMs: formatMilliseconds(percentile(matureSamples.packing, 0.5)),
        p95Ms: formatMilliseconds(percentile(matureSamples.packing, 0.95)),
    },
    {
        phase: 'total',
        medianMs: formatMilliseconds(percentile(matureSamples.total, 0.5)),
        p95Ms: formatMilliseconds(percentile(matureSamples.total, 0.95)),
    },
]);
console.log(
    'Legacy mature total phase: median 0.1811 ms, p95 1.7404 ms (same 50 × 4 template matrix).',
);
