import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getHorseAppearanceVariantDefinition,
    horseAppearanceVariants,
} from '@gredice/js/entityAppearanceVariants';
import { getHorseMaterialTint } from './horseAppearance';

describe('Horse runtime appearance', () => {
    it('provides typed coat, mane, marking, and muzzle colors for every coat', () => {
        for (const appearance of horseAppearanceVariants.variants) {
            assert.equal(
                getHorseMaterialTint({
                    appearance,
                    materialName: 'Material.Horse.Coat',
                    meshName: 'Horse_Body',
                })?.color,
                appearance.coatColor,
            );
            assert.equal(
                getHorseMaterialTint({
                    appearance,
                    materialName: 'Material.Horse.Mane',
                    meshName: 'Horse_Mane',
                })?.color,
                appearance.maneColor,
            );
            assert.equal(
                getHorseMaterialTint({
                    appearance,
                    materialName: 'Material.Horse.Muzzle',
                    meshName: 'Horse_Muzzle',
                })?.color,
                appearance.muzzleColor,
            );
        }
    });

    it('shows pinto patches only on pinto and preserves normal markings', () => {
        const bay = getHorseAppearanceVariantDefinition(0);
        const pinto = getHorseAppearanceVariantDefinition(5);
        const materialName = 'Material.Horse.Marking';

        assert.equal(
            getHorseMaterialTint({
                appearance: bay,
                materialName,
                meshName: 'Horse_PintoPatch_Left',
            })?.color,
            bay.coatColor,
        );
        assert.equal(
            getHorseMaterialTint({
                appearance: pinto,
                materialName,
                meshName: 'Horse_PintoPatch_Left',
            })?.color,
            pinto.markingColor,
        );
        assert.equal(
            getHorseMaterialTint({
                appearance: bay,
                materialName,
                meshName: 'Horse_Blaze',
            })?.color,
            bay.markingColor,
        );
    });
});
