import type {
    GardenStructureDocumentV1,
    GardenStructureEdge,
    GardenStructureFootprintCell,
    GardenStructureProp,
    GardenStructureRoofRegion,
    GardenStructureRotation,
} from '@gredice/js/gardenStructures';
import {
    gardenStructureSchemaVersion,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import { compileGardenStructurePlan } from './compileGardenStructurePlan';
import type {
    GardenStructureCompileInput,
    GardenStructureCompilerBenchmarkResult,
    GardenStructureSemanticPlan,
} from './structurePlanTypes';

const worstCaseWidth = 20;
const worstCaseToothDepth = 8;

function rotationForIndex(index: number): GardenStructureRotation {
    switch (index % 4) {
        case 0:
            return 0;
        case 1:
            return 1;
        case 2:
            return 2;
        default:
            return 3;
    }
}

function createWorstCaseEdge(
    index: number,
    from: Readonly<{ x: number; y: number }>,
    direction: GardenStructureEdge['direction'],
): GardenStructureEdge {
    const remainder = index % 8;
    if (remainder === 0) {
        return {
            id: `edge-${index.toString().padStart(3, '0')}`,
            from,
            direction,
            partId: 'door.timber-wide-open',
            kind: 'door',
        };
    }
    if (remainder === 1) {
        return {
            id: `edge-${index.toString().padStart(3, '0')}`,
            from,
            direction,
            partId: 'door.debug-closed',
            kind: 'door',
        };
    }
    if (remainder === 2) {
        return {
            id: `edge-${index.toString().padStart(3, '0')}`,
            from,
            direction,
            partId: 'window.house',
            kind: 'window',
        };
    }
    return {
        id: `edge-${index.toString().padStart(3, '0')}`,
        from,
        direction,
        partId: remainder === 3 ? 'wall.greenhouse-panel' : 'wall.timber',
        kind: 'wall',
    };
}

/**
 * A valid 20x9 / 100-cell comb whose adjacency graph is a tree. It reaches
 * the 301 distinct incident-edge maximum while also exercising one roof
 * region and prop per cell, opaque and transparent materials, open portals,
 * and solid closed doors.
 */
export function createWorstCaseGardenStructureDocument(): GardenStructureDocumentV1 {
    const cells: GardenStructureFootprintCell[] = [];
    const edges: GardenStructureEdge[] = [];
    const roofRegions: GardenStructureRoofRegion[] = [];
    const props: GardenStructureProp[] = [];

    for (let x = 0; x < worstCaseWidth; x++) {
        cells.push({ x, y: 0, spaceKind: 'interior' });
        if (x % 2 === 0) {
            for (let y = 1; y <= worstCaseToothDepth; y++) {
                cells.push({ x, y, spaceKind: 'interior' });
            }
        }
    }

    for (const [index, cell] of cells.entries()) {
        roofRegions.push({
            id: `roof-${index.toString().padStart(3, '0')}`,
            cells: [{ x: cell.x, y: cell.y }],
            styleId:
                index % 3 === 0
                    ? 'roof.greenhouse-gable'
                    : index % 3 === 1
                      ? 'roof.gable'
                      : 'roof.shed',
            materialId: index % 3 === 0 ? 'roof.greenhouse-panel' : 'roof.clay',
            rotation: rotationForIndex(index),
        });
        props.push({
            id: `prop-${index.toString().padStart(3, '0')}`,
            partId:
                index % 3 === 0
                    ? 'prop.workbench'
                    : index % 3 === 1
                      ? 'prop.table'
                      : 'prop.planter',
            x: cell.x,
            y: cell.y,
            rotation: rotationForIndex(index),
        });
    }

    const incidentEdgeSlots = new Map<
        string,
        Readonly<{
            from: Readonly<{ x: number; y: number }>;
            direction: GardenStructureEdge['direction'];
        }>
    >();
    const addIncidentEdge = (
        from: Readonly<{ x: number; y: number }>,
        direction: GardenStructureEdge['direction'],
    ) => {
        const key = `${from.x.toString()}|${from.y.toString()}|${direction}`;
        if (!incidentEdgeSlots.has(key)) {
            incidentEdgeSlots.set(key, { from, direction });
        }
    };
    for (const cell of cells) {
        addIncidentEdge(cell, 'north');
        addIncidentEdge(cell, 'east');
        addIncidentEdge({ x: cell.x, y: cell.y + 1 }, 'north');
        addIncidentEdge({ x: cell.x - 1, y: cell.y }, 'east');
    }
    const orderedIncidentEdges = [...incidentEdgeSlots.values()].sort(
        (left, right) =>
            left.from.y - right.from.y ||
            left.from.x - right.from.x ||
            (left.direction < right.direction ? -1 : 1),
    );
    for (const [index, edge] of orderedIncidentEdges.entries()) {
        edges.push(createWorstCaseEdge(index, edge.from, edge.direction));
    }

    return normalizeGardenStructureDocument({
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: cells.map((cell) => ({
            cell: { x: cell.x, y: cell.y },
            materialId:
                (cell.x + cell.y) % 2 === 0 ? 'floor.timber' : 'floor.stone',
        })),
        edges,
        roofRegions,
        props,
    });
}

export function createWorstCaseGardenStructureCompileInput(): GardenStructureCompileInput {
    return {
        structureId: 'benchmark-100-cell-structure',
        revision: 1,
        document: createWorstCaseGardenStructureDocument(),
        placement: { anchorX: -10, anchorY: 7, rotation: 3 },
        baseHeight: 0.5,
    };
}

export function benchmarkWorstCaseGardenStructureCompiler({
    iterations = 100,
    now = () => globalThis.performance.now(),
}: Readonly<{
    iterations?: number;
    now?: () => number;
}> = {}): GardenStructureCompilerBenchmarkResult {
    if (!Number.isInteger(iterations) || iterations < 1) {
        throw new Error(
            'Compiler benchmark iterations must be a positive integer.',
        );
    }

    const input = createWorstCaseGardenStructureCompileInput();
    let lastPlan: GardenStructureSemanticPlan | undefined;
    const startedAt = now();
    for (let iteration = 0; iteration < iterations; iteration++) {
        lastPlan = compileGardenStructurePlan(input);
    }
    const totalDurationMs = now() - startedAt;
    if (!lastPlan) {
        throw new Error('Compiler benchmark did not produce a semantic plan.');
    }

    return Object.freeze({
        iterations,
        totalDurationMs,
        averageDurationMs: totalDurationMs / iterations,
        counts: lastPlan.counts,
    });
}
