import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import type {
    GardenStructureCatalogEntry,
    GardenStructureCatalogPartEntry,
} from '../src/structures/catalog/gardenStructureKitV1Catalog';
import { compileGardenStructurePlan } from '../src/structures/compileGardenStructurePlan';
import type { GardenStructureKitV1RuntimeBatch } from '../src/structures/GardenStructureKitV1AssetRenderer';
import {
    type GardenStructureKitBounds,
    gardenStructureKitV1AssetManifest,
} from '../src/structures/gardenStructureKitV1Manifest';

export type GardenStructureKitV1CatalogSnapshot = Readonly<{
    batches: readonly GardenStructureKitV1RuntimeBatch[];
    center: Readonly<{ height: number; x: number; z: number }>;
    extent: Readonly<{ depth: number; height: number; width: number }>;
    footprintGuideCells: readonly Readonly<{ x: number; z: number }>[];
    materialNames: readonly string[];
    zoom: number;
}>;

const manifest = gardenStructureKitV1AssetManifest;

function extentZoom(width: number, depth: number, height: number) {
    const projectedWidth = width + depth * 0.65;
    const projectedHeight = height + (width + depth) * 0.32;
    return Math.min(90, 110 / Math.max(projectedWidth, projectedHeight, 0.8));
}

function boundsSnapshot(
    bounds: GardenStructureKitBounds,
): Pick<GardenStructureKitV1CatalogSnapshot, 'center' | 'extent' | 'zoom'> {
    const [minimumX, minimumZ, minimumHeight] = bounds.minimum;
    const [maximumX, maximumZ, maximumHeight] = bounds.maximum;
    const width = maximumX - minimumX;
    const depth = maximumZ - minimumZ;
    const height = maximumHeight - minimumHeight;
    return {
        center: {
            height: (minimumHeight + maximumHeight) / 2,
            x: (minimumX + maximumX) / 2,
            z: (minimumZ + maximumZ) / 2,
        },
        extent: { depth, height, width },
        zoom: extentZoom(width, depth, height),
    };
}

function partDefinition(entry: GardenStructureCatalogPartEntry) {
    switch (entry.category) {
        case 'floor':
            return manifest.floorParts[entry.id];
        case 'edge':
            return manifest.edgeParts[entry.id];
        case 'roof':
            return manifest.roofStyles[entry.id];
        case 'prop':
            return manifest.propParts[entry.id];
    }
}

function partBatch(
    entry: GardenStructureCatalogPartEntry,
): GardenStructureKitV1RuntimeBatch {
    const definition = partDefinition(entry);
    if (!definition) {
        throw new Error(`Missing Garden Structure Kit V1 part ${entry.id}.`);
    }
    const materialId =
        'materialId' in definition
            ? definition.materialId
            : definition.materialIds[0];
    if (!materialId) {
        throw new Error(
            `Missing Garden Structure Kit V1 material for ${entry.id}.`,
        );
    }
    return Object.freeze({
        geometryId: entry.category === 'floor' ? 'floor-cell' : entry.id,
        geometryKind:
            entry.category === 'floor'
                ? 'floor-cell'
                : entry.category === 'edge'
                  ? 'edge-segment'
                  : entry.category === 'roof'
                    ? 'roof-cell'
                    : 'prop',
        id: `catalog:${entry.key}`,
        instanceIds: Object.freeze([entry.key]),
        materialId,
        transforms: new Float32Array([0, 0, 0]),
        transformStride: 3,
    });
}

function templateSnapshot(
    entry: Extract<GardenStructureCatalogEntry, { kind: 'template' }>,
): GardenStructureKitV1CatalogSnapshot {
    const seed = createGardenStructureTemplateSeed(entry.id);
    const plan = compileGardenStructurePlan({
        document: seed.document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        revision: 1,
        structureId: `catalog-${entry.id}`,
    });
    const { worldBounds } = plan;
    const extent = {
        depth: worldBounds.depth,
        height: worldBounds.height,
        width: worldBounds.width,
    };
    return Object.freeze({
        batches: Object.freeze([
            ...plan.batches.opaque,
            ...plan.batches.transparent,
            ...plan.batches.roof,
            ...plan.batches.props,
        ]),
        center: Object.freeze({
            height: (worldBounds.minHeight + worldBounds.maxHeight) / 2,
            x: (worldBounds.minX + worldBounds.maxX) / 2,
            z: (worldBounds.minY + worldBounds.maxY) / 2,
        }),
        extent: Object.freeze(extent),
        footprintGuideCells: Object.freeze(
            entry.id === 'blank'
                ? seed.document.footprint.cells.map(({ x, y }) =>
                      Object.freeze({ x, z: y }),
                  )
                : [],
        ),
        materialNames: Object.freeze([]),
        zoom: extentZoom(extent.width, extent.depth, extent.height),
    });
}

export function createGardenStructureKitV1CatalogSnapshot(
    entry: GardenStructureCatalogEntry,
): GardenStructureKitV1CatalogSnapshot {
    if (entry.kind === 'template') {
        return templateSnapshot(entry);
    }
    if (entry.kind === 'part') {
        const definition = partDefinition(entry);
        if (!definition) {
            throw new Error(
                `Missing Garden Structure Kit V1 part ${entry.id}.`,
            );
        }
        return Object.freeze({
            ...boundsSnapshot(definition.bounds),
            batches: Object.freeze([partBatch(entry)]),
            footprintGuideCells: Object.freeze([]),
            materialNames: Object.freeze([]),
        });
    }

    const material = manifest.materials[entry.id];
    if (!material) {
        throw new Error(
            `Missing Garden Structure Kit V1 material ${entry.id}.`,
        );
    }
    return Object.freeze({
        batches: Object.freeze([]),
        center: Object.freeze({ height: 0.08, x: 0, z: 0 }),
        extent: Object.freeze({ depth: 0.8, height: 0.16, width: 1.2 }),
        footprintGuideCells: Object.freeze([]),
        materialNames: material.nodeMaterialNames,
        zoom: 82,
    });
}
