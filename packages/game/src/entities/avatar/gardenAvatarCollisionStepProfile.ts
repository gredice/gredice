import {
    type GardenAvatarHorizontalMovementInput,
    resolveGardenAvatarHorizontalMovement,
} from './gardenAvatarMovement';

/**
 * Measures the production collision resolver itself. The recording callback is
 * outside the measured interval so histogram/reporting overhead cannot inflate
 * the collision-step sample.
 */
export function resolveProfiledGardenAvatarHorizontalMovement({
    input,
    now = () => performance.now(),
    recordDuration,
}: Readonly<{
    input: GardenAvatarHorizontalMovementInput;
    now?: () => number;
    recordDuration: (durationMs: number) => void;
}>) {
    const startedAt = now();
    const result = resolveGardenAvatarHorizontalMovement(input);
    recordDuration(Math.max(0, now() - startedAt));
    return result;
}
