export type SceneClockActivationTarget = {
    elapsedTime: number;
    getDelta: () => number;
};

/**
 * Advances the clock's internal frame timestamp without advancing scene time.
 * This keeps the first R3F delta after activation fresh and prevents hidden or
 * offscreen wall time from fast-forwarding elapsed-time-driven animations.
 */
export function consumeSceneClockActivationGap(
    clock: SceneClockActivationTarget,
) {
    const elapsedTime = clock.elapsedTime;
    clock.getDelta();
    clock.elapsedTime = elapsedTime;
}
