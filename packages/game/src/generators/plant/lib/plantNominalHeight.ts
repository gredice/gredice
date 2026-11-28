import type { PlantDefinition } from './plant-definitions';

/**
 * Height a mature plant of this definition reaches, estimated from the
 * definition alone. In-game presets scale their models with it, and the 3D
 * leaves use it to lean upper leaves toward the highlight colour.
 */
export function getNominalMaturePlantHeight(plantDefinition: PlantDefinition) {
    const { development } = plantDefinition;
    const isBasal =
        development.architecture === 'rosette' ||
        development.architecture === 'clump';
    const isProstrate = development.axes.habit === 'prostrate';
    const storageHeight = development.storage
        ? plantDefinition.vegetable.baseSize *
          development.storage.sizeScale *
          Math.max(0.5, development.storage.aboveSoilFraction)
        : 0;
    const basalFoliageHeight =
        plantDefinition.leaf.size *
        (1.05 + development.foliage.petioleLengthScale * 0.5);
    const axialFoliageHeight =
        plantDefinition.height *
            development.axes.internodeLengthScale *
            (isProstrate ? 0.18 : 0.98) +
        plantDefinition.leaf.size;

    return Math.max(
        isBasal ? basalFoliageHeight : axialFoliageHeight,
        storageHeight,
        0.16,
    );
}
