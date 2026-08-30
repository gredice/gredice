import { gardenStructureKitV1Metadata } from './gardenStructureKitV1Manifest';
import type {
    GardenStructureEdgePartMetadata,
    GardenStructureKitMetadata,
    GardenStructureMaterialMetadata,
} from './structurePlanTypes';

const debugClosedDoorMaterial: GardenStructureMaterialMetadata = Object.freeze({
    transparency: 'opaque',
});
const debugClosedDoorPart: GardenStructureEdgePartMetadata = Object.freeze({
    collisionHeight: 2.2,
    collisionThickness: 0.1,
    edgeKind: 'door',
    materialId: 'door.debug-closed',
    passage: 'solid',
});

/**
 * Compatibility name for the Milestone 0 renderer. Its semantic contract now
 * comes from the immutable production-tracked version one asset manifest.
 */
export const debugGardenStructureKitMetadata: GardenStructureKitMetadata =
    Object.freeze({
        ...gardenStructureKitV1Metadata,
        edgeParts: Object.freeze({
            ...gardenStructureKitV1Metadata.edgeParts,
            'door.debug-closed': debugClosedDoorPart,
        }),
        materials: Object.freeze({
            ...gardenStructureKitV1Metadata.materials,
            'door.debug-closed': debugClosedDoorMaterial,
        }),
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
