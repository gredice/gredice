'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
    idleBreathingAmplitudes,
    idleBreathingPeriod,
    idleBreathingPeriodSeconds,
    plantInstanceBreathSpeedJitterGlsl,
} from '../../../scene/idleBreathing';
import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../../../scene/SceneTime';
import { useWeatherReducedMotion } from '../../../scene/weather/useWeatherReducedMotion';
import {
    getPlantWind,
    registerPlantSwayTarget,
    resolvePlantMotion,
    resolvePlantSwayUniformValues,
    subscribePlantWindMotion,
} from '../../../scene/weather/wind/plantWind';
import { SeededRNG } from '../lib/rng';

interface PlantSwayOptions {
    amplitude: number;
    /** Idle breathing scale amplitude; defaults to `PLANT_BREATH_AMPLITUDE`. */
    breathAmplitude?: number;
    /**
     * Seed of the breathing phase. Every part of one plant passes the plant's
     * own seed, so leaves, stems and produce swell together.
     */
    breathSeed?: string;
    enabled?: boolean;
    speed: number;
}

/**
 * Living things breathe at rest (GAME_ART.md, Motion): each part swells by
 * about 3% once every four seconds, with the shared timing and the shrub
 * amplitude from `scene/idleBreathing.ts`. All parts of one plant share one
 * breath phase, and batched plants add their own per-plant phase, so a plant
 * breathes as one and neighbours stay out of step.
 */
export const PLANT_BREATH_AMPLITUDE = idleBreathingAmplitudes.shrub;
export const PLANT_BREATH_SPEED = (Math.PI * 2) / idleBreathingPeriodSeconds;

/**
 * Breath speed of one plant: the shared four-second breath with the same
 * per-instance period jitter as `scene/idleBreathing.ts`, so neighbouring
 * plants drift apart instead of breathing in lockstep.
 */
export function getPlantBreathSpeed(breathSeed: string) {
    const seed = new SeededRNG(`${breathSeed}:breath-period`).nextRange(0, 1);
    return (Math.PI * 2) / idleBreathingPeriod(seed);
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
    uniform float uBreathAmplitude;
    uniform float uBreathSpeed;
    uniform float uBreathPhase;

    #ifdef USE_INSTANCING
        attribute float instanceSwayPhase;
    #endif

    void main() {
        vec4 localPosition = vec4(position, 1.0);
        vec4 swayReferencePosition = localPosition;
        float swayPhase = uSwayPhase;
        float breathPhase = uBreathPhase;
        float breathSpeed = uBreathSpeed;

        #ifdef USE_INSTANCING
            swayReferencePosition = instanceMatrix * localPosition;
            swayPhase += instanceSwayPhase;
            breathPhase += instanceSwayPhase;
            breathSpeed *= ${plantInstanceBreathSpeedJitterGlsl};
        #endif

        // Each part swells about its own attachment point.
        float breathScale = 1.0 + uBreathAmplitude * sin(
            uTime * breathSpeed + breathPhase
        );
        localPosition.xyz *= breathScale;

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

/**
 * How this plant part moves now: fully, gently in wind under reduced
 * motion, or still. Re-renders only when that changes; the wind itself
 * reaches the uniforms through `scene/weather/wind/plantWind.ts`.
 */
function usePlantMotion() {
    const osReducedMotion = useWeatherReducedMotion();
    const motion = useSyncExternalStore(
        subscribePlantWindMotion,
        () => {
            const wind = getPlantWind();
            return resolvePlantMotion(
                wind,
                wind.reducedMotion ?? osReducedMotion,
            );
        },
        () => resolvePlantMotion(getPlantWind(), osReducedMotion),
    );
    return { motion, osReducedMotion };
}

/**
 * Plant sway and breathing uniforms. Live wind sways plants through the one
 * wind scale (`scene/weather/windClass.ts`): the weather's wind layer
 * publishes the blended class and each part's uniforms follow without a
 * re-render. Under reduced motion plants do not breathe, keep still in calm
 * air and sway at 30% in wind.
 */
export function usePlantSway(seed: string, options: PlantSwayOptions) {
    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const timeUniform = useSceneTimeUniform();
    const { motion, osReducedMotion } = usePlantMotion();
    const swayDisabled = options.enabled === false || motion === 'still';
    const breathAmplitude = options.breathAmplitude ?? PLANT_BREATH_AMPLITUDE;
    const breathSeed = options.breathSeed ?? seed;
    const breathSpeed = getPlantBreathSpeed(breathSeed);
    useSceneTimeInvalidation(
        'plant-sway',
        !swayDisabled && fixedTimeSeconds === undefined,
    );
    const uniforms = useMemo(() => {
        const rng = new SeededRNG(seed);
        // Start from the current wind, so the first frame already sways.
        const initial = swayDisabled
            ? null
            : resolvePlantSwayUniformValues(getPlantWind(), {
                  amplitude: options.amplitude,
                  speed: options.speed,
                  breathAmplitude,
                  breathSpeed,
                  reducedMotion: osReducedMotion,
              });
        return {
            uTime: timeUniform,
            uSwayAmplitude: { value: initial?.swayAmplitude ?? 0 },
            uSwaySpeed: { value: initial?.swaySpeed ?? 0 },
            uSwayPhase: { value: rng.nextRange(0, Math.PI * 2) },
            uWindStrength: { value: initial?.windStrength ?? 0 },
            uWindDirection: {
                value: initial?.windDirection ?? defaultWindDirection(),
            },
            uBreathAmplitude: { value: initial?.breathAmplitude ?? 0 },
            uBreathSpeed: { value: initial?.breathSpeed ?? 0 },
            uBreathPhase: {
                value: new SeededRNG(`${breathSeed}:breath`).nextRange(
                    0,
                    Math.PI * 2,
                ),
            },
        };
    }, [
        breathAmplitude,
        breathSeed,
        breathSpeed,
        options.amplitude,
        options.speed,
        osReducedMotion,
        seed,
        swayDisabled,
        timeUniform,
    ]);

    useEffect(() => {
        if (swayDisabled) {
            return;
        }
        return registerPlantSwayTarget({
            uniforms,
            amplitude: options.amplitude,
            speed: options.speed,
            breathAmplitude,
            breathSpeed,
            reducedMotion: osReducedMotion,
        });
    }, [
        breathAmplitude,
        breathSpeed,
        options.amplitude,
        options.speed,
        osReducedMotion,
        swayDisabled,
        uniforms,
    ]);

    return uniforms;
}
