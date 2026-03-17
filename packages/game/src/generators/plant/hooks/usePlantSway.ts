'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { useGameState } from '../../../useGameState';
import { SeededRNG } from '../lib/rng';

interface PlantSwayOptions {
    amplitude: number;
    speed: number;
}

export const plantSwayVertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uSwayAmplitude;
    uniform float uSwaySpeed;
    uniform float uSwayPhase;
    uniform float uWindStrength;
    uniform vec2 uWindDirection;

    void main() {
        vec4 localPosition = vec4(position, 1.0);
        vec4 swayReferencePosition = localPosition;

        #ifdef USE_INSTANCING
            swayReferencePosition = instanceMatrix * localPosition;
        #endif

        float heightFactor = smoothstep(0.0, 1.5, max(swayReferencePosition.y, 0.0));
        float primaryWave = sin(
            uTime * uSwaySpeed +
            uSwayPhase +
            swayReferencePosition.y * 2.15
        );
        float secondaryWave = cos(
            uTime * (uSwaySpeed * 1.31) +
            uSwayPhase * 1.7 +
            swayReferencePosition.x * 1.35 +
            swayReferencePosition.z * 0.85
        );
        vec2 windDirection = length(uWindDirection) > 0.0
            ? normalize(uWindDirection)
            : vec2(1.0, 0.0);
        float windBias = sin(
            dot(swayReferencePosition.xz, windDirection) * 0.85 +
            uTime * (uSwaySpeed * 0.72) +
            uSwayPhase * 0.4
        );
        float amplitude = uSwayAmplitude * (1.0 + uWindStrength * 0.75);
        float sway = (
            primaryWave +
            secondaryWave * 0.45 +
            windBias * uWindStrength * 0.9
        ) * amplitude * heightFactor;
        vec2 directionalSway = windDirection * sway;

        localPosition.x += directionalSway.x + secondaryWave * amplitude * 0.2 * heightFactor;
        localPosition.z += directionalSway.y + primaryWave * amplitude * 0.22 * heightFactor;

        csm_Position = localPosition.xyz;
    }
`;

export function usePlantSway(seed: string, options: PlantSwayOptions) {
    const weather = useGameState((state) => state.weather);
    const uniforms = useMemo(() => {
        const rng = new SeededRNG(seed);
        return {
            uTime: { value: 0 },
            uSwayAmplitude: { value: options.amplitude },
            uSwaySpeed: { value: options.speed },
            uSwayPhase: { value: rng.nextRange(0, Math.PI * 2) },
            uWindStrength: { value: 0 },
            uWindDirection: { value: [1, 0] as [number, number] },
        };
    }, [options.amplitude, options.speed, seed]);

    useFrame(({ clock }) => {
        uniforms.uTime.value = clock.getElapsedTime();
        const windStrength = Math.max(
            0,
            Math.min(1, (weather?.windSpeed ?? 0) / 25),
        );
        const windDirectionRadians =
            ((weather?.windDirection ?? 0) * Math.PI) / 180;

        uniforms.uSwayAmplitude.value =
            options.amplitude * (1 + windStrength * 0.28);
        uniforms.uSwaySpeed.value = options.speed * (1 + windStrength * 0.18);
        uniforms.uWindStrength.value = windStrength;
        uniforms.uWindDirection.value = [
            Math.sin(windDirectionRadians),
            -Math.cos(windDirectionRadians),
        ];
    });

    return uniforms;
}
