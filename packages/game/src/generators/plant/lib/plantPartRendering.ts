export function resolvePlantPartCastShadow(
    castShadow: boolean | undefined,
): boolean {
    return castShadow ?? true;
}

/**
 * Roughness bands from GAME_ART.md, Materials. Leaves use the crop leaf role,
 * stems and thorns the satin band, petals the gloss band. Produce roughness
 * comes with its colour from the crop palette.
 */
export const PLANT_LEAF_ROUGHNESS = 0.5;
/**
 * Leaves keep a faint satin sheen but far less than a full dielectric
 * reflection. A plant shows hundreds of small leaves turned every way, and at
 * full strength their reflections add enough white to pull sunlit leaves
 * below the 0.55 saturation floor and away from the matte crop cards. The
 * leaf material is a `MeshPhysicalMaterial` only for this setting.
 */
export const PLANT_LEAF_SPECULAR_INTENSITY = 0.25;

/**
 * How far crop foliage bends its shading normal toward world up, as the
 * length of the up vector added to the unit normal.
 *
 * The crop leaf colours are chosen for a sunlit top face (GAME_ART.md,
 * Colour). A small leaf turned straight at the key light gets more light
 * than that, and the tone mapping bleaches it toward white; a leaf seen from
 * behind faces the warm ground bounce and turns olive. Bending the normal up
 * lights every leaf close to a top face, so the plant stays saturated green
 * from every side, while the domed leaf normals still give each leaf a soft
 * gradient. The far and mid crop cards bend their clump normal the same way,
 * so the colour does not jump between levels of detail.
 */
export const PLANT_FOLIAGE_UP_BEND = 1.1;
export const PLANT_STEM_ROUGHNESS = 0.55;
export const PLANT_PETAL_ROUGHNESS = 0.45;
