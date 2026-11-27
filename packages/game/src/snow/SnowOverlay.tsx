import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type {
    BufferGeometry,
    ColorRepresentation,
    Mesh,
    Vector3Tuple,
} from 'three';
import {
    Color,
    ShaderMaterial,
    UniformsLib,
    UniformsUtils,
    Vector2,
    Vector3,
} from 'three';
import {
    useAutumnPropWindOverlay,
    useAutumnPropWindOverlayGeometry,
} from '../scene/AutumnPropWindMaterial';
import { seasonalRoles } from '../scene/seasonalRoles';
import { useSnowSurfaceAmountUniform } from '../scene/WeatherSurfaceUniformProvider';
import { weatherSnowSunlitGain } from '../scene/weatherSurfaceMaterial';
import { useGameState } from '../useGameState';
import { createSnowOverlayGeometry } from './createSnowOverlayGeometry';
import {
    resolveSnowSettleAmountRange,
    snowCoverRules,
    snowOverlayFragmentShader,
    snowOverlayVertexShader,
} from './snowShader';

/**
 * Snow cover colour: the snow role (`#d6e2f2` on screen, GAME_ART "Seasonal
 * roles") as the light a sunlit snow top sends before tone mapping, that is
 * its albedo times the sunlit gain both snow shaders divide by. Shaded
 * sides, dawn and night follow the scene lights from there. Copy it, never
 * change it in place. Its linear blue is above 1 (about 1.08), so it is the
 * default when no `color` is given; passed as `color`, resolveColorKey's
 * getHexString would clamp it.
 */
export const snowCoverColor = new Color(
    seasonalRoles.snow.albedo,
).multiplyScalar(weatherSnowSunlitGain);
const defaultColor = snowCoverColor;
const fallbackBounds = {
    min: [-0.5, -0.5, -0.5] as Vector3Tuple,
    max: [0.5, 0.5, 0.5] as Vector3Tuple,
};

export type SnowMaterialOptions = {
    coverageMultiplier?: number;
    maxThickness?: number;
    slopeExponent?: number;
    noiseScale?: number;
    noiseAmplitude?: number;
    noiseInfluence?: number;
    color?: string | number | Color;
    bounds?: {
        min: Vector3Tuple;
        max: Vector3Tuple;
    };
    overrideSnow?: number;
    /**
     * Cover every face whose world normal's up component is in this range
     * or above (smoothly from the first to the second value), instead of
     * the slope exponent, and grow the snow along the normals. For a
     * canopy's lighter cap, which is covered completely.
     */
    slopeRange?: readonly [number, number];
    /**
     * Centimetres of lying snow over which this surface's translucent
     * dusting grows from none to its full partial cover (GAME_ART.md
     * "Weather > Snow": grass settles more slowly than paths and roofs).
     * Without it the dusting follows the shared cover ramp alone.
     */
    settleCm?: readonly [number, number];
};

export type SnowOverlayProps = SnowMaterialOptions & {
    raycast?: Mesh['raycast'];
    geometry: BufferGeometry;
    debugName?: string;
    minCoverage?: number;
    renderOrder?: number;
    overrideSnow?: number;
};

function resolveSnowOverlayActive(options: {
    coverageMultiplier?: number;
    gameSnowCoverage: number;
    minCoverage: number;
    overrideSnow?: number;
}) {
    const snowCoverage = options.overrideSnow ?? options.gameSnowCoverage;
    return (
        snowCoverage * (options.coverageMultiplier ?? 1) >= options.minCoverage
    );
}

export function useSnowOverlayVisible({
    coverageMultiplier,
    minCoverage = 0.02,
    overrideSnow,
}: {
    coverageMultiplier?: number;
    minCoverage?: number;
    overrideSnow?: number;
}) {
    const gameSnowCoverage = useGameState((state) => state.snowCoverage);

    return resolveSnowOverlayActive({
        coverageMultiplier,
        gameSnowCoverage,
        minCoverage,
        overrideSnow,
    });
}

function resolveColorKey(
    color: SnowMaterialOptions['color'],
): ColorRepresentation {
    if (color instanceof Color) {
        return color.getHexString();
    }
    return color ?? defaultColor;
}

export function useSnowMaterial({
    coverageMultiplier = 1,
    maxThickness = 0.18,
    slopeExponent = 2.4,
    noiseScale = 2.5,
    noiseAmplitude = 0.35,
    noiseInfluence = 0.15,
    color,
    bounds,
    overrideSnow,
    slopeRange,
    settleCm,
}: SnowMaterialOptions = {}) {
    const snowAmountUniform = useSnowSurfaceAmountUniform({
        coverageMultiplier,
        overrideSnow,
    });
    const colorKey = resolveColorKey(color);
    const snowColor = useMemo(() => new Color(colorKey), [colorKey]);
    const resolvedBounds = bounds ?? fallbackBounds;
    const slopeRangeFrom = slopeRange?.[0] ?? 0;
    const slopeRangeTo = slopeRange?.[1] ?? 1;
    const slopeRangeEnabled = slopeRange ? 1 : 0;
    const [settleFrom, settleTo] = settleCm
        ? resolveSnowSettleAmountRange(settleCm, coverageMultiplier)
        : [-1, 0];

    const material = useMemo(() => {
        const mat = new ShaderMaterial({
            transparent: true,
            fog: true,
            depthWrite: true,
            depthTest: true,
            lights: true,
            uniforms: UniformsUtils.merge([
                UniformsLib.common,
                UniformsLib.lights,
                UniformsLib.fog,
                {
                    uSnowAmount: { value: 0 },
                    uMaxThickness: { value: maxThickness },
                    uSlopeExponent: { value: slopeExponent },
                    uNoiseScale: { value: noiseScale },
                    uNoiseAmplitude: { value: noiseAmplitude },
                    uSnowColor: { value: snowColor.clone() },
                    uNoiseInfluence: { value: noiseInfluence },
                    uSnowBlend: { value: 1 },
                    uBoundsMin: {
                        value: new Vector3(...resolvedBounds.min),
                    },
                    uBoundsMax: {
                        value: new Vector3(...resolvedBounds.max),
                    },
                    uSlopeRange: {
                        value: new Vector3(
                            slopeRangeFrom,
                            slopeRangeTo,
                            slopeRangeEnabled,
                        ),
                    },
                    uSnowSettle: {
                        value: new Vector2(settleFrom, settleTo),
                    },
                },
            ]),
            vertexShader: snowOverlayVertexShader,
            fragmentShader: snowOverlayFragmentShader,
        });
        mat.uniforms.uSnowAmount = snowAmountUniform;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = 1; // push towards camera
        mat.polygonOffsetUnits = 1;
        return mat;
    }, [
        maxThickness,
        noiseAmplitude,
        noiseInfluence,
        noiseScale,
        slopeExponent,
        snowColor,
        snowAmountUniform,
        resolvedBounds.max,
        resolvedBounds.min,
        slopeRangeEnabled,
        slopeRangeFrom,
        slopeRangeTo,
        settleFrom,
        settleTo,
    ]);

    useEffect(() => {
        material.uniforms.uSnowColor.value.copy(snowColor);
    }, [material, snowColor]);

    useEffect(() => {
        const targetBounds = bounds ?? fallbackBounds;
        material.uniforms.uBoundsMin.value.set(...targetBounds.min);
        material.uniforms.uBoundsMax.value.set(...targetBounds.max);
    }, [bounds, material]);

    useEffect(() => () => material.dispose(), [material]);

    // Settling or melting snow blends as a translucent dusting; full cover
    // draws opaque. Only the render list and blending change, no program.
    useFrame(() => {
        const blend =
            material.uniforms.uSnowAmount.value < snowCoverRules.opaqueFrom;
        if (material.transparent === blend) return;
        material.transparent = blend;
        material.uniforms.uSnowBlend.value = blend ? 1 : 0;
    });

    useAutumnPropWindOverlay(material);
    return material;
}

export function SnowMaterial({
    attach = 'material',
    ...options
}: SnowMaterialOptions & { attach?: string }) {
    const material = useSnowMaterial(options);
    return <primitive object={material} attach={attach} />;
}

export function SnowOverlay({
    geometry,
    minCoverage = 0.02,
    renderOrder,
    overrideSnow,
    ...options
}: SnowOverlayProps) {
    const isActive = useSnowOverlayVisible({
        coverageMultiplier: options.coverageMultiplier,
        minCoverage,
        overrideSnow,
    });

    if (!isActive) {
        return null;
    }

    return (
        <SnowOverlayMesh
            geometry={geometry}
            renderOrder={renderOrder}
            overrideSnow={overrideSnow}
            {...options}
        />
    );
}

function SnowOverlayMesh({
    geometry,
    renderOrder,
    overrideSnow,
    ...options
}: SnowOverlayProps) {
    const overlayGeometry = useMemo(
        () => createSnowOverlayGeometry(geometry),
        [geometry],
    );
    useAutumnPropWindOverlayGeometry(overlayGeometry);
    const bounds = useMemo(() => {
        if (!overlayGeometry.boundingBox) {
            overlayGeometry.computeBoundingBox();
        }
        const box = overlayGeometry.boundingBox;
        if (!box) {
            return fallbackBounds;
        }
        return {
            min: [box.min.x, box.min.y, box.min.z] as Vector3Tuple,
            max: [box.max.x, box.max.y, box.max.z] as Vector3Tuple,
        };
    }, [overlayGeometry]);
    const material = useSnowMaterial({
        ...options,
        bounds: options.bounds ?? bounds,
        overrideSnow: overrideSnow,
    });
    return (
        <mesh
            name={options.debugName ?? 'SnowOverlay'}
            raycast={options.raycast}
            geometry={overlayGeometry}
            material={material}
            renderOrder={renderOrder}
        />
    );
}
