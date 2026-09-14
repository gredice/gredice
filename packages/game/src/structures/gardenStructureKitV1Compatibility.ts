import { debugGardenStructureKitMetadata } from './debugStructureKit';
import { validateGardenStructureKitMetadata } from './gardenStructureKitMetadataValidation';

const gardenStructureKitV1DefinitionFingerprint =
    validateGardenStructureKitMetadata(
        debugGardenStructureKitMetadata,
    ).kitDefinitionFingerprint;

/**
 * The loaded V1 asset manifest has fixed geometry and offsets. Only plans
 * compiled from the exact registered immutable definition may use it.
 */
export function isGardenStructureKitV1DefinitionCompatible(
    definition: Readonly<{
        kitDefinitionFingerprint: string | null;
        kitKey: string;
        kitVersion: string;
    }>,
) {
    return (
        gardenStructureKitV1DefinitionFingerprint !== undefined &&
        definition.kitKey === debugGardenStructureKitMetadata.kitKey &&
        definition.kitVersion === debugGardenStructureKitMetadata.kitVersion &&
        definition.kitDefinitionFingerprint ===
            gardenStructureKitV1DefinitionFingerprint
    );
}
