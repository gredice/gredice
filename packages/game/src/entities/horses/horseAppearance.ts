import type { HorseAppearanceVariantDefinition } from '@gredice/js/entityAppearanceVariants';

export type HorseMaterialTint = {
    color: string;
    darken?: number;
};

export function getHorseMaterialTint({
    appearance,
    materialName,
    meshName,
}: {
    appearance: HorseAppearanceVariantDefinition;
    materialName: string;
    meshName: string;
}): HorseMaterialTint | null {
    if (materialName.includes('Material.Horse.CoatDark')) {
        return { color: appearance.coatColor, darken: 0.72 };
    }
    if (materialName.includes('Material.Horse.Coat')) {
        return { color: appearance.coatColor };
    }
    if (materialName.includes('Material.Horse.Mane')) {
        return { color: appearance.maneColor };
    }
    if (materialName.includes('Material.Horse.Marking')) {
        const pintoPatch = meshName.includes('Horse_PintoPatch_');
        return {
            color:
                pintoPatch && appearance.id !== 'pinto'
                    ? appearance.coatColor
                    : appearance.markingColor,
        };
    }
    if (materialName.includes('Material.Horse.Muzzle')) {
        return { color: appearance.muzzleColor };
    }
    return null;
}
