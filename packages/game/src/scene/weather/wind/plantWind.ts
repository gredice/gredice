import {
    resolveWindSway,
    resolveWindVector,
    windClassThresholds,
} from '../windClass';

/**
 * Live wind for plant sway (GAME_ART.md "Weather > Wind > Sway", decision
 * D4: live API wind sways plants, gently). Plants render outside the
 * weather frame, so the wind layer publishes the blended wind class here
 * and every swaying plant part registers its sway uniforms. A wind change
 * writes a few numbers into those uniforms; no plant re-renders.
 *
 * Reduced motion: no breathing and no idle sway in still air (as before),
 * and wind sway at 30% of its full size.
 */

export type PlantWindState = {
    /** Blended wind class, 0 to 4. */
    windClass: number;
    /** Wind direction in degrees. */
    directionDegrees: number;
    /**
     * Reduced motion as the weather frame sees it (the OS setting or the
     * debug override); null when no wind layer is mounted, so each plant
     * follows the OS setting.
     */
    reducedMotion: boolean | null;
};

export const calmPlantWind: PlantWindState = {
    windClass: 0,
    directionDegrees: 0,
    reducedMotion: null,
};

/** Share of the full sway a plant keeps under reduced motion. */
export const plantSwayReducedShare = 0.3;

/**
 * Under reduced motion the sway ramps in over this wind class range, so
 * plants stay still in calm air and nothing pops as the wind rises.
 */
export const plantSwayReducedRamp = [windClassThresholds.rainSlant, 1] as const;

/** How a plant moves: fully, gently in wind (reduced motion), or not. */
export type PlantMotion = 'full' | 'reduced' | 'still';

export function resolvePlantMotion(
    state: Pick<PlantWindState, 'windClass'>,
    reducedMotion: boolean,
): PlantMotion {
    if (!reducedMotion) return 'full';
    return state.windClass > plantSwayReducedRamp[0] ? 'reduced' : 'still';
}

export type PlantSwayUniforms = {
    uSwayAmplitude: { value: number };
    uSwaySpeed: { value: number };
    uWindStrength: { value: number };
    uWindDirection: { value: [number, number] };
    uBreathAmplitude: { value: number };
    uBreathSpeed: { value: number };
};

export type PlantSwayTarget = {
    uniforms: PlantSwayUniforms;
    /** The part's own sway amplitude and speed, and breath. */
    amplitude: number;
    speed: number;
    breathAmplitude: number;
    breathSpeed: number;
    /** The OS reduced-motion setting the part rendered with. */
    reducedMotion: boolean;
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

/**
 * Sway uniforms for a plant part in a wind. Full motion: the part's sway
 * grows with the class (amplitude × (1 + 0.28 × sway)), and the shader adds
 * the wind's lean bias and gain from `uWindStrength`. The sway speed stays
 * the part's own, so a blending wind never jumps the phase.
 */
export function resolvePlantSwayUniformValues(
    state: PlantWindState,
    target: Omit<PlantSwayTarget, 'uniforms'>,
) {
    const reduced = state.reducedMotion ?? target.reducedMotion;
    const motion = resolvePlantMotion(state, reduced);
    const strength = resolveWindSway(state.windClass, false);
    const vector = resolveWindVector(state.directionDegrees);
    const direction: [number, number] = [vector.x, vector.z];
    if (motion === 'still') {
        return {
            swayAmplitude: 0,
            swaySpeed: 0,
            windStrength: 0,
            windDirection: direction,
            breathAmplitude: 0,
            breathSpeed: 0,
        };
    }
    const fullAmplitude = target.amplitude * (1 + strength * 0.28);
    if (motion === 'reduced') {
        const ramp = clamp01(
            (state.windClass - plantSwayReducedRamp[0]) /
                (plantSwayReducedRamp[1] - plantSwayReducedRamp[0]),
        );
        return {
            swayAmplitude: fullAmplitude * plantSwayReducedShare * ramp,
            swaySpeed: target.speed,
            windStrength: strength,
            windDirection: direction,
            breathAmplitude: 0,
            breathSpeed: 0,
        };
    }
    return {
        swayAmplitude: fullAmplitude,
        swaySpeed: target.speed,
        windStrength: strength,
        windDirection: direction,
        breathAmplitude: target.breathAmplitude,
        breathSpeed: target.breathSpeed,
    };
}

let current: PlantWindState = calmPlantWind;
const targets = new Set<PlantSwayTarget>();
const listeners = new Set<() => void>();

function apply(target: PlantSwayTarget) {
    const values = resolvePlantSwayUniformValues(current, target);
    const { uniforms } = target;
    uniforms.uSwayAmplitude.value = values.swayAmplitude;
    uniforms.uSwaySpeed.value = values.swaySpeed;
    uniforms.uWindStrength.value = values.windStrength;
    uniforms.uWindDirection.value[0] = values.windDirection[0];
    uniforms.uWindDirection.value[1] = values.windDirection[1];
    uniforms.uBreathAmplitude.value = values.breathAmplitude;
    uniforms.uBreathSpeed.value = values.breathSpeed;
}

/** The wind layer publishes the blended wind; plants follow at once. */
export function setPlantWind(next: PlantWindState) {
    if (
        next.windClass === current.windClass &&
        next.directionDegrees === current.directionDegrees &&
        next.reducedMotion === current.reducedMotion
    ) {
        return;
    }
    const previous = current;
    current = next;
    for (const target of targets) apply(target);
    if (
        previous.reducedMotion !== next.reducedMotion ||
        previous.windClass > plantSwayReducedRamp[0] !==
            next.windClass > plantSwayReducedRamp[0]
    ) {
        for (const listener of listeners) listener();
    }
}

export function getPlantWind() {
    return current;
}

/** Registers a plant part's sway uniforms; returns the unregister call. */
export function registerPlantSwayTarget(target: PlantSwayTarget) {
    targets.add(target);
    apply(target);
    return () => {
        targets.delete(target);
    };
}

/**
 * Subscribe to changes that can start or stop a plant's motion (reduced
 * motion, or calm air under reduced motion); for `useSyncExternalStore`.
 */
export function subscribePlantWindMotion(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Number of registered plant parts (debug and tests). */
export function countPlantSwayTargets() {
    return targets.size;
}
