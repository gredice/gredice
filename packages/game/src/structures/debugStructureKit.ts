import type {
    GardenStructureEdgePartMetadata,
    GardenStructureKitMetadata,
    GardenStructureMaterialMetadata,
    GardenStructurePropPartMetadata,
    GardenStructureRoofStyleMetadata,
} from './structurePlanTypes';

function material(
    transparency: GardenStructureMaterialMetadata['transparency'],
): GardenStructureMaterialMetadata {
    return Object.freeze({ transparency });
}

function edgePart(
    metadata: GardenStructureEdgePartMetadata,
): GardenStructureEdgePartMetadata {
    return Object.freeze(metadata);
}

function propPart(
    metadata: GardenStructurePropPartMetadata,
): GardenStructurePropPartMetadata {
    return Object.freeze(metadata);
}

function roofStyle(
    metadata: GardenStructureRoofStyleMetadata,
): GardenStructureRoofStyleMetadata {
    return Object.freeze(metadata);
}

const materials = Object.freeze({
    'floor.limestone': material('opaque'),
    'floor.stone': material('opaque'),
    'floor.timber': material('opaque'),
    'roof.clay': material('opaque'),
    'roof.greenhouse-panel': material('transparent'),
    'wall.timber': material('opaque'),
    'wall.plaster': material('opaque'),
    'wall.greenhouse-panel': material('transparent'),
    'window.house': material('transparent'),
    'door.timber-wide-open': material('opaque'),
    'door.house-open': material('opaque'),
    'door.greenhouse-open': material('transparent'),
    'door.debug-closed': material('opaque'),
    'prop.workbench': material('opaque'),
    'prop.table': material('opaque'),
    'prop.planter': material('opaque'),
} satisfies Record<string, GardenStructureMaterialMetadata>);

const edgeParts = Object.freeze({
    'wall.timber': edgePart({
        edgeKind: 'wall',
        materialId: 'wall.timber',
        passage: 'solid',
        collisionHeight: 2.4,
        collisionThickness: 0.12,
    }),
    'wall.plaster': edgePart({
        edgeKind: 'wall',
        materialId: 'wall.plaster',
        passage: 'solid',
        collisionHeight: 2.4,
        collisionThickness: 0.12,
    }),
    'wall.greenhouse-panel': edgePart({
        edgeKind: 'wall',
        materialId: 'wall.greenhouse-panel',
        passage: 'solid',
        collisionHeight: 2.4,
        collisionThickness: 0.08,
    }),
    'window.house': edgePart({
        edgeKind: 'window',
        materialId: 'window.house',
        passage: 'solid',
        collisionHeight: 2.4,
        collisionThickness: 0.12,
    }),
    'door.timber-wide-open': edgePart({
        edgeKind: 'door',
        materialId: 'door.timber-wide-open',
        passage: 'open-portal',
        collisionHeight: 2.4,
        collisionThickness: 0.12,
        portalClearanceHeight: 2.2,
        portalClearanceWidth: 0.88,
    }),
    'door.house-open': edgePart({
        edgeKind: 'door',
        materialId: 'door.house-open',
        passage: 'open-portal',
        collisionHeight: 2.4,
        collisionThickness: 0.12,
        portalClearanceHeight: 2.15,
        portalClearanceWidth: 0.82,
    }),
    'door.greenhouse-open': edgePart({
        edgeKind: 'door',
        materialId: 'door.greenhouse-open',
        passage: 'open-portal',
        collisionHeight: 2.4,
        collisionThickness: 0.08,
        portalClearanceHeight: 2.15,
        portalClearanceWidth: 0.84,
    }),
    'door.debug-closed': edgePart({
        edgeKind: 'door',
        materialId: 'door.debug-closed',
        passage: 'solid',
        collisionHeight: 2.2,
        collisionThickness: 0.1,
    }),
} satisfies Record<string, GardenStructureEdgePartMetadata>);

const propParts = Object.freeze({
    'prop.workbench': propPart({
        materialId: 'prop.workbench',
        collisionWidth: 0.82,
        collisionDepth: 0.5,
        collisionHeight: 0.92,
    }),
    'prop.table': propPart({
        materialId: 'prop.table',
        collisionWidth: 0.74,
        collisionDepth: 0.74,
        collisionHeight: 0.8,
    }),
    'prop.planter': propPart({
        materialId: 'prop.planter',
        collisionWidth: 0.72,
        collisionDepth: 0.64,
        collisionHeight: 0.5,
    }),
} satisfies Record<string, GardenStructurePropPartMetadata>);

const roofStyles = Object.freeze({
    'roof.gable': roofStyle({
        ceilingHeight: 2.4,
        maximumHeight: 3.2,
    }),
    'roof.shed': roofStyle({
        ceilingHeight: 2.35,
        maximumHeight: 2.85,
    }),
    'roof.greenhouse-gable': roofStyle({
        ceilingHeight: 2.4,
        maximumHeight: 3.05,
    }),
} satisfies Record<string, GardenStructureRoofStyleMetadata>);

/**
 * Fixture-only Milestone 0 kit. It intentionally contains semantic collision
 * and material facts, but no asset paths or renderer objects.
 */
export const debugGardenStructureKitMetadata: GardenStructureKitMetadata =
    Object.freeze({
        kitKey: 'gredice-buildings',
        kitVersion: '1',
        floorThickness: 0.08,
        ceilingThickness: 0.06,
        visualHorizontalPadding: 0.06,
        materials,
        edgeParts,
        propParts,
        roofStyles,
    });

export const gardenStructureKitMetadataRegistry: Readonly<
    Record<string, GardenStructureKitMetadata>
> = Object.freeze({
    'gredice-buildings@1': debugGardenStructureKitMetadata,
});

export function getGardenStructureKitMetadata(
    kitKey: string,
    kitVersion: string,
): GardenStructureKitMetadata | undefined {
    return gardenStructureKitMetadataRegistry[`${kitKey}@${kitVersion}`];
}
