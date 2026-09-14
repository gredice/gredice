import type {
    GardenStructureDocumentV1,
    GardenStructureRotation,
    GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';
import type { CurrentGarden } from './useCurrentGarden';

export type GardenStructureMutationResult = Readonly<{
    economy: Readonly<{
        debitedSunflowers: number;
        refundedSunflowers: number;
    }>;
    kind: 'create' | 'delete' | 'placement' | 'replace' | 'resize';
    structure: Readonly<{
        anchorX: number;
        anchorY: number;
        deleted: boolean;
        document: GardenStructureDocumentV1;
        gardenId: number;
        id: string;
        kitKey: string;
        kitVersion: string;
        pricingVersion: number;
        refundableSunflowerPrincipal: number;
        revision: number;
        rotation: GardenStructureRotation;
        sunflowerPricePerCell: number;
        templateKey: GardenStructureTemplateKey;
    }>;
}>;

function compareStructureIds(
    left: CurrentGarden['structures'][number],
    right: CurrentGarden['structures'][number],
) {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function installGardenStructureMutationInCurrentGarden(
    currentGarden: CurrentGarden | null | undefined,
    result: GardenStructureMutationResult,
): CurrentGarden | null | undefined {
    if (!currentGarden || currentGarden.id !== result.structure.gardenId) {
        return currentGarden;
    }

    const structuresWithoutMutationTarget = currentGarden.structures.filter(
        (structure) => structure.id !== result.structure.id,
    );
    if (result.structure.deleted) {
        return {
            ...currentGarden,
            structures: structuresWithoutMutationTarget,
        };
    }

    const {
        deleted: _deleted,
        gardenId: _gardenId,
        ...canonical
    } = result.structure;
    const canonicalStructure: CurrentGarden['structures'][number] = {
        ...canonical,
        isDeleted: false,
    };
    return {
        ...currentGarden,
        structures: [
            ...structuresWithoutMutationTarget,
            canonicalStructure,
        ].sort(compareStructureIds),
    };
}
