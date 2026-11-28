import { cropLeafPalette } from '../../generators/plant/lib/cropPalette';
import { seasonalRoles } from '../../scene/seasonalRoles';
import { defaultGameWoodColor } from '../woodPalette';

/**
 * Colours of the raised-bed field accessories (weeds, frost fleece, insect
 * net, supports and sown seeds), as albedo with the roughness of their
 * GAME_ART.md role, so they sit in the same palette as the beds and crops.
 */
export const raisedBedAccessoryPalette = {
    /** Crop leaf base role, as the crops use it. */
    weed: { color: cropLeafPalette.base, roughness: 0.5 },
    /** Fleece, hem, bars and the insect net: the cream neutral. */
    fabric: {
        color: seasonalRoles.cream.albedo,
        roughness: seasonalRoles.cream.roughness,
    },
    /** Stakes and net anchors: the shared wood profile, satin band. */
    wood: { color: defaultGameWoodColor, roughness: 0.55 },
    /** Sown seed rows: bed soil (`#8f5530` on screen) at its roughness. */
    seed: { color: '#522f19', roughness: 0.85 },
} as const;
