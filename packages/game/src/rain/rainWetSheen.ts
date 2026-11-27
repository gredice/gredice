import { Color, type IUniform } from 'three';
import { weatherRoleSets } from '../scene/weather/weatherRoles';

/**
 * The wet look (GAME_ART.md "Weather > Rain and heavy rain"): richer, never
 * darker. Wet up-facing faces gain a soft sky-coloured sheen: halfway
 * between the puddle's deep and light (sky reflection) roles, which is
 * close to the middle sky colour at midday and stays a calm violet at night
 * instead of a pale lift over a dim garden.
 */
export const rainWetLook = {
    /** Saturation gain at full wetness. */
    saturation: 0.22,
    /** Roughness wet surfaces move toward. */
    roughness: 0.26,
    /** Sky sheen on up-facing faces at full wetness. */
    sheen: 0.07,
} as const;

/** Share of the puddle-light role in the sheen (the rest is puddle-deep). */
export const rainWetSheenLightShare = 0.5;

/** The sheen colour from the puddle roles (linear colours). */
export function resolveRainWetSheenColor(
    puddleDeep: Color,
    puddleLight: Color,
    target = new Color(),
) {
    return target.copy(puddleDeep).lerp(puddleLight, rainWetSheenLightShare);
}

/**
 * One shared sheen colour (linear) for every wet material (the integrated
 * weather surface; the wet overlays are retired). The rain layer sets it from the
 * weather roles; it starts at the midday role.
 */
const sheenColorUniform: IUniform<Color> = {
    value: resolveRainWetSheenColor(
        new Color(weatherRoleSets.midday.puddleDeep),
        new Color(weatherRoleSets.midday.puddleLight),
    ),
};

export function getRainWetSheenColorUniform() {
    return sheenColorUniform;
}

/** Sets the shared sheen colour; returns whether it changed. */
export function setRainWetSheenColor(color: Color) {
    if (sheenColorUniform.value.equals(color)) {
        return false;
    }
    sheenColorUniform.value.copy(color);
    return true;
}
