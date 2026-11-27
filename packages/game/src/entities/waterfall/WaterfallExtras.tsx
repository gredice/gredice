import { useEffect, useMemo } from 'react';
import { type Material, Vector4 } from 'three';
import { useSnowSurfaceAmountUniform } from '../../scene/WeatherSurfaceUniformProvider';
import { useSnowOverlayVisible } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import { useWaterBlockMaterial } from '../BlockWater';
import type { WaterBlockStyle } from '../waterBlockNames';
import { createWaterfallExtrasGeometry } from './waterfallExtrasGeometry';
import type { WaterfallColumn } from './waterfallPlacements';

/** The extras have no banks; the shader ignores the foam edges. */
const waterfallExtrasFoamEdges = new Vector4(0, 0, 0, 0);

/**
 * Whether snow lies on the flat grass and grass lips around the falls, by
 * the rule the terrain rim's snow lip follows: the quality tier draws snow
 * (`renderSnow`) and the grass cover has reached the tier's overlay
 * threshold. Below it the grass stays bare on that tier, so the falls must
 * not act as if snow lay there.
 */
export function useWaterfallSnowLies({
    renderSnow = true,
    snowOverlayMinCoverage,
}: {
    renderSnow?: boolean;
    snowOverlayMinCoverage?: number;
}) {
    const grassSnowVisible = useSnowOverlayVisible({
        coverageMultiplier: snowPresets.grassFlat.coverageMultiplier,
        minCoverage: snowOverlayMinCoverage,
    });
    return renderSnow && grassSnowVisible;
}

/**
 * Material of the landing foam, spills and island-edge run-outs of one water
 * style.
 * It is the lit water material, so day, night, weather and moonlight light
 * it like the water it belongs to, and it animates from the same scene-time
 * lease as the water surface. Landing foam on terrain fades with the snow on
 * flat grass, which would bury it, and spills lift over the snow on their
 * lip; both only while `snowLies` (`useWaterfallSnowLies`).
 */
export function useWaterfallExtrasMaterial(
    style: WaterBlockStyle,
    simple: boolean,
    snowLies: boolean,
) {
    const snowAmountUniform = useSnowSurfaceAmountUniform({
        coverageMultiplier: snowPresets.grassFlat.coverageMultiplier,
        overrideSnow: undefined,
    });
    return useWaterBlockMaterial(waterfallExtrasFoamEdges, false, undefined, {
        style,
        useWaterDepthAttribute: true,
        waterfall: 'extras',
        waterfallSimple: simple,
        // No uniform reads as no snow.
        waterfallSnowUniform: snowLies ? snowAmountUniform : undefined,
    });
}

/**
 * Landing foam, spills and island-edge run-outs of the waterfalls in one
 * water chunk, in one draw. Drawn after the water body, without depth
 * writes.
 */
export function WaterfallExtras({
    columns,
    material,
    name,
}: {
    columns: readonly WaterfallColumn[];
    material: Material;
    name: string;
}) {
    const geometry = useMemo(
        () => createWaterfallExtrasGeometry(columns),
        [columns],
    );

    useEffect(() => () => geometry.dispose(), [geometry]);

    if ((geometry.getIndex()?.count ?? 0) === 0) {
        return null;
    }

    return (
        <mesh
            castShadow={false}
            receiveShadow
            geometry={geometry}
            material={material}
            name={name}
            renderOrder={2}
            raycast={() => null}
        />
    );
}
