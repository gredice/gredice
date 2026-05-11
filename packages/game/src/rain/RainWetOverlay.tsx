import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { BufferGeometry, Vector3Tuple } from 'three';
import {
    MathUtils,
    ShaderMaterial,
    UniformsLib,
    UniformsUtils,
    Vector3,
} from 'three';
import { useGameState } from '../useGameState';

type RainWetOverlayProps = {
    geometry: BufferGeometry;
    minRain?: number;
    intensityMultiplier?: number;
    drySpeed?: number;
    wetSpeed?: number;
    topSurfaceBias?: number;
    darkness?: number;
    glossiness?: number;
    bounds?: {
        min: Vector3Tuple;
        max: Vector3Tuple;
    };
};

const fallbackBounds = {
    min: [-0.5, -0.5, -0.5] as Vector3Tuple,
    max: [0.5, 0.5, 0.5] as Vector3Tuple,
};

const rainOverlayVertexShader = `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const rainOverlayFragmentShader = `
uniform float uWetness;
uniform float uTopSurfaceBias;
uniform float uDarkness;
uniform float uGlossiness;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453123);
}

void main() {
    float topness = clamp(pow(max(vWorldNormal.y, 0.0), uTopSurfaceBias), 0.0, 1.0);
    vec3 local = (vWorldPos - uBoundsMin) / max(vec3(0.001), (uBoundsMax - uBoundsMin));
    float variation = 0.75 + noise(local * 17.0) * 0.25;
    float wet = clamp(uWetness * topness * variation, 0.0, 1.0);

    float alpha = wet * 0.4;
    vec3 color = vec3(0.02) * uDarkness;

    // Subtle fake glint for pooled highlights on horizontal surfaces
    float glint = pow(max(vWorldNormal.y, 0.0), 20.0) * wet * uGlossiness;
    color += vec3(glint * 0.18);

    gl_FragColor = vec4(color, alpha);
}
`;

export function RainWetOverlay({
    geometry,
    minRain = 0.35,
    intensityMultiplier = 1,
    drySpeed = 1.8,
    wetSpeed = 5,
    topSurfaceBias = 1.8,
    darkness = 1,
    glossiness = 0.7,
    bounds,
}: RainWetOverlayProps) {
    const rainAmount = useGameState((state) => state.weather?.rainy ?? 0);
    const shouldRender = rainAmount * intensityMultiplier >= minRain;

    const resolvedBounds = useMemo(() => {
        if (bounds) return bounds;
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        const box = geometry.boundingBox;
        if (!box) return fallbackBounds;
        return {
            min: [box.min.x, box.min.y, box.min.z] as Vector3Tuple,
            max: [box.max.x, box.max.y, box.max.z] as Vector3Tuple,
        };
    }, [bounds, geometry]);

    const material = useMemo(() => {
        const mat = new ShaderMaterial({
            transparent: true,
            fog: true,
            depthWrite: false,
            depthTest: true,
            lights: false,
            uniforms: UniformsUtils.merge([
                UniformsLib.fog,
                {
                    uWetness: { value: 0 },
                    uTopSurfaceBias: { value: topSurfaceBias },
                    uDarkness: { value: darkness },
                    uGlossiness: { value: glossiness },
                    uBoundsMin: { value: new Vector3(...resolvedBounds.min) },
                    uBoundsMax: { value: new Vector3(...resolvedBounds.max) },
                },
            ]),
            vertexShader: rainOverlayVertexShader,
            fragmentShader: rainOverlayFragmentShader,
        });
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1;
        mat.polygonOffsetUnits = -1;
        return mat;
    }, [
        darkness,
        glossiness,
        resolvedBounds.max,
        resolvedBounds.min,
        topSurfaceBias,
    ]);

    useEffect(() => {
        material.uniforms.uTopSurfaceBias.value = topSurfaceBias;
        material.uniforms.uDarkness.value = darkness;
        material.uniforms.uGlossiness.value = glossiness;
    }, [darkness, glossiness, material, topSurfaceBias]);

    useEffect(() => {
        material.uniforms.uBoundsMin.value.set(...resolvedBounds.min);
        material.uniforms.uBoundsMax.value.set(...resolvedBounds.max);
    }, [material, resolvedBounds.max, resolvedBounds.min]);

    useEffect(() => () => material.dispose(), [material]);

    useFrame((_, delta) => {
        const target = Math.min(
            1,
            Math.max(0, rainAmount * intensityMultiplier),
        );
        const speed =
            target > material.uniforms.uWetness.value ? wetSpeed : drySpeed;
        material.uniforms.uWetness.value = MathUtils.damp(
            material.uniforms.uWetness.value,
            target,
            speed,
            delta,
        );
    });

    if (!shouldRender && material.uniforms.uWetness.value < 0.01) {
        return null;
    }

    return <mesh geometry={geometry} material={material} />;
}
