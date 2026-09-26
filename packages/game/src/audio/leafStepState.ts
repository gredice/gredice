import type { GardenAvatarPoint } from '../entities/avatar/gardenAvatarMovement';
import { autumnSeed } from '../scene/autumnState';

// A full left/right cycle, shared with the avatar rig.
export const avatarStrideLength = 0.82;
export const leafStepMinimumInterval = 0.28;

export type LeafStepSample = GardenAvatarPoint & {
    time: number;
    distance: number;
    grounded: boolean;
};

/** Samples the existing movement clock; never catches up missed contacts. */
export function createLeafStepCadence(seed: string) {
    let previous: LeafStepSample | undefined;
    let lastSound = Number.NEGATIVE_INFINITY;
    return {
        reset() {
            previous = undefined;
            lastSound = Number.NEGATIVE_INFINITY;
        },
        update(sample: LeafStepSample) {
            const before = previous;
            previous = { ...sample };
            if (!before) return null;
            const elapsed = sample.time - before.time;
            const distance = sample.distance - before.distance;
            const displacement = Math.hypot(
                sample.x - before.x,
                sample.z - before.z,
            );
            if (elapsed < 0) lastSound = Number.NEGATIVE_INFINITY;
            if (
                !sample.grounded ||
                !before.grounded ||
                !Number.isFinite(
                    elapsed + distance + displacement + sample.y,
                ) ||
                elapsed <= 0 ||
                elapsed > 0.2 ||
                distance <= 0.001 ||
                displacement <= 0.001 ||
                displacement > 5 * elapsed + 0.03 ||
                distance > 5 * elapsed + 0.03 ||
                Math.abs(sample.y - before.y) > 0.5
            )
                return null;
            const contact = (value: number) =>
                Math.floor(
                    (value + avatarStrideLength / 4) / (avatarStrideLength / 2),
                );
            const step = contact(sample.distance);
            if (
                step === contact(before.distance) ||
                sample.time - lastSound < leafStepMinimumInterval
            )
                return null;
            // Sparse deterministic variation, including occasional quiet contacts.
            if (autumnSeed(`${seed}:${step}:quiet`) < 0.22) return null;
            lastSound = sample.time;
            return {
                variant: Math.floor(autumnSeed(`${seed}:${step}:variant`) * 3),
                volume: 0.16 + autumnSeed(`${seed}:${step}:gain`) * 0.07,
            };
        },
    };
}
