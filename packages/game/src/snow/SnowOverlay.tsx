import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { BufferGeometry, ColorRepresentation, Vector3Tuple } from 'three';
import {
    Color,
    MathUtils,
    ShaderMaterial,
    UniformsLib,
    UniformsUtils,
    Vector3,
} from 'three';
import { useGameState } from '../useGameState';
import { createSnowOverlayGeometry } from './createSnowOverlayGeometry';
import {
    snowOverlayFragmentShader,
    snowOverlayVertexShader,
} from './snowShader';

const defaultColor = '#f7f7ff';
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
};

export type SnowOverlayProps = SnowMaterialOptions & {
    geometry: BufferGeometry;
    renderOrder?: number;
    overrideSnow?: number;
};

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
}: SnowMaterialOptions = {}) {
    const gameSnowCoverage = useGameState((state) => state.snowCoverage);
    const snowCoverage = overrideSnow ?? gameSnowCoverage;
    const colorKey = resolveColorKey(color);
    const snowColor = useMemo(() => new Color(colorKey), [colorKey]);
    const resolvedBounds = bounds ?? fallbackBounds;

    const material = useMemo(() => {
        const mat = new ShaderMaterial({
            transparent: false,
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
                    uBoundsMin: {
                        value: new Vector3(...resolvedBounds.min),
                    },
                    uBoundsMax: {
                        value: new Vector3(...resolvedBounds.max),
                    },
                },
            ]),
            vertexShader: snowOverlayVertexShader,
            fragmentShader: snowOverlayFragmentShader,
        });
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
        resolvedBounds.max,
        resolvedBounds.min,
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

    useFrame((_, delta) => {
        material.uniforms.uSnowAmount.value = MathUtils.damp(
            material.uniforms.uSnowAmount.value,
            Math.min(1, Math.max(0, snowCoverage * coverageMultiplier)),
            6,
            delta,
        );
    });

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
    renderOrder,
    overrideSnow,
    ...options
}: SnowOverlayProps) {
    const overlayGeometry = useMemo(
        () => createSnowOverlayGeometry(geometry),
        [geometry],
    );
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
            geometry={overlayGeometry}
            material={material}
            castShadow
            receiveShadow
            renderOrder={renderOrder}
        />
    );
}
