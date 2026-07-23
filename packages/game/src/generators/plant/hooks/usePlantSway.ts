'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSceneTimeUniform } from '../../../scene/SceneTime';
import { useGameState } from '../../../useGameState';
import { SeededRNG } from '../lib/rng';

interface PlantSwayOptions {
    amplitude: number;
    enabled?: boolean;
    speed: number;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getPrefersReducedMotion() {
    if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
    ) {
        return false;
    }

    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(
        getPrefersReducedMotion,
    );

    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            typeof window.matchMedia !== 'function'
        ) {
            return;
        }

        const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
        const handleChange = () => {
            setPrefersReducedMotion(mediaQueryList.matches);
        };

        handleChange();
        mediaQueryList.addEventListener('change', handleChange);

        return () => {
            mediaQueryList.removeEventListener('change', handleChange);
        };
    }, []);

    return prefersReducedMotion;
}

function defaultWindDirection(): [number, number] {
    return [1, 0];
}

export const plantSwayVertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uSwayAmplitude;
    uniform float uSwaySpeed;
    uniform float uSwayPhase;
    uniform float uWindStrength;
    uniform vec2 uWindDirection;

    #ifdef USE_INSTANCING
        attribute float instanceSwayPhase;
    #endif

    void main() {
        vec4 localPosition = vec4(position, 1.0);
        vec4 swayReferencePosition = localPosition;
        float swayPhase = uSwayPhase;

        #ifdef USE_INSTANCING
            swayReferencePosition = instanceMatrix * localPosition;
            swayPhase += instanceSwayPhase;
        #endif

        float heightFactor = smoothstep(0.0, 1.5, max(swayReferencePosition.y, 0.0));
        float primaryWave = sin(
            uTime * uSwaySpeed +
            swayPhase +
            swayReferencePosition.y * 2.15
        );
        float secondaryWave = cos(
            uTime * (uSwaySpeed * 1.31) +
            swayPhase * 1.7 +
            swayReferencePosition.x * 1.35 +
            swayReferencePosition.z * 0.85
        );
        vec2 windDirection = length(uWindDirection) > 0.0
            ? normalize(uWindDirection)
            : vec2(1.0, 0.0);
        float windBias = sin(
            dot(swayReferencePosition.xz, windDirection) * 0.85 +
            uTime * (uSwaySpeed * 0.72) +
            swayPhase * 0.4
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
    const timeUniform = useSceneTimeUniform();
    const prefersReducedMotion = usePrefersReducedMotion();
    const swayDisabled = options.enabled === false || prefersReducedMotion;
    const uniforms = useMemo(() => {
        const rng = new SeededRNG(seed);
        return {
            uTime: timeUniform,
            uSwayAmplitude: {
                value: swayDisabled ? 0 : options.amplitude,
            },
            uSwaySpeed: { value: swayDisabled ? 0 : options.speed },
            uSwayPhase: { value: rng.nextRange(0, Math.PI * 2) },
            uWindStrength: { value: 0 },
            uWindDirection: { value: defaultWindDirection() },
        };
    }, [options.amplitude, options.speed, seed, swayDisabled, timeUniform]);

    useEffect(() => {
        if (swayDisabled) {
            uniforms.uSwayAmplitude.value = 0;
            uniforms.uSwaySpeed.value = 0;
            uniforms.uWindStrength.value = 0;
            uniforms.uWindDirection.value = defaultWindDirection();
            return;
        }

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
    }, [
        options.amplitude,
        options.speed,
        swayDisabled,
        uniforms,
        weather?.windDirection,
        weather?.windSpeed,
    ]);

    return uniforms;
}
