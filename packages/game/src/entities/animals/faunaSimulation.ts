import type { Object3D, Quaternion, Vector3 } from 'three';

/** Matches the existing ambient fauna cadence, independently of render FPS. */
export const faunaSimulationStepSeconds = 1 / 30;
const maximumFrameDeltaSeconds = 0.064;
const timeEpsilon = 1e-9;

export type FaunaSimulationFrame = {
    delta: number;
    now: number;
};

export function createFaunaWalkDistance(getAlpha: () => number) {
    let previous = 0;
    let current = 0;
    let initialized = false;
    return {
        set: (distance: number) => {
            previous = !initialized || distance < current ? distance : current;
            current = distance;
            initialized = true;
        },
        get: () => previous + (current - previous) * getAlpha(),
    };
}

type FaunaTransform = {
    position: Vector3;
    quaternion: Quaternion;
    scale: Vector3;
};

function createTransform(object: Object3D): FaunaTransform {
    return {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
    };
}

function readTransform(target: FaunaTransform, object: Object3D) {
    target.position.copy(object.position);
    target.quaternion.copy(object.quaternion);
    target.scale.copy(object.scale);
}

function copyTransform(target: FaunaTransform, source: FaunaTransform) {
    target.position.copy(source.position);
    target.quaternion.copy(source.quaternion);
    target.scale.copy(source.scale);
}

function writeTransform(object: Object3D, transform: FaunaTransform) {
    object.position.copy(transform.position);
    object.quaternion.copy(transform.quaternion);
    object.scale.copy(transform.scale);
}

function sameTransform(object: Object3D, transform: FaunaTransform) {
    return (
        object.position.equals(transform.position) &&
        object.quaternion.equals(transform.quaternion) &&
        object.scale.equals(transform.scale)
    );
}

type FaunaActorTransform = {
    current: FaunaTransform;
    object: Object3D;
    previous: FaunaTransform;
    rendered: FaunaTransform;
    initialized: boolean;
};

/**
 * One retained simulation/visual dispatcher per Canvas. Simulation callbacks
 * keep registration order, so a species observes the same earlier presence
 * reports as before. Rendered transforms never become simulation inputs.
 */
export function createFaunaSimulation<TState>({
    resolveStepState,
}: {
    resolveStepState?: (state: TState, frame: FaunaSimulationFrame) => TState;
} = {}) {
    const callbacks = new Map<
        symbol,
        {
            callback: (state: TState, frame: FaunaSimulationFrame) => void;
            getObject?: () => Object3D | null;
            transform?: FaunaActorTransform;
        }
    >();
    const renderCallbacks = new Map<
        symbol,
        (state: TState, frame: FaunaSimulationFrame) => void
    >();
    const animationCallbacks = new Map<
        symbol,
        (state: TState, frame: FaunaSimulationFrame) => void
    >();
    let lastFrameTime: number | null = null;
    let simulationTime = 0;
    let accumulator = 0;
    let stepCount = 0;
    let renderCount = 0;
    let resumed = false;

    function synchronizeObjects() {
        for (const registration of callbacks.values()) {
            const object = registration.getObject?.();
            if (!object) {
                registration.transform = undefined;
                continue;
            }
            const transform = registration.transform;
            if (!transform || transform.object !== object) {
                registration.transform = {
                    current: createTransform(object),
                    object,
                    previous: createTransform(object),
                    rendered: createTransform(object),
                    initialized: false,
                };
            } else if (!sameTransform(object, transform.rendered)) {
                // Placement/effect updates are semantic inputs. Accept them,
                // instead of overwriting them with a retained interpolation.
                readTransform(transform.current, object);
                copyTransform(transform.previous, transform.current);
                readTransform(transform.rendered, object);
            }
        }
    }

    function restoreSimulationTransforms() {
        for (const { transform } of callbacks.values()) {
            if (transform) writeTransform(transform.object, transform.current);
        }
    }

    function simulate(state: TState, delta: number, now: number) {
        restoreSimulationTransforms();
        for (const { transform } of callbacks.values()) {
            if (transform) copyTransform(transform.previous, transform.current);
        }
        const frame = { delta, now };
        const stepState = resolveStepState?.(state, frame) ?? state;
        for (const { callback } of callbacks.values())
            callback(stepState, frame);
        for (const { transform } of callbacks.values()) {
            if (!transform) continue;
            readTransform(transform.current, transform.object);
            // First mount and teleports must not glide in from the origin or
            // through occupied terrain. Ordinary locomotion stays interpolated.
            if (
                !transform.initialized ||
                transform.previous.position.distanceToSquared(
                    transform.current.position,
                ) > 4
            ) {
                copyTransform(transform.previous, transform.current);
            }
            transform.initialized = true;
        }
        stepCount += 1;
    }

    function interpolate() {
        const alpha = Math.min(1, accumulator / faunaSimulationStepSeconds);
        for (const { transform } of callbacks.values()) {
            if (!transform) continue;
            const { object, previous, current, rendered } = transform;
            object.position.lerpVectors(
                previous.position,
                current.position,
                alpha,
            );
            object.quaternion.slerpQuaternions(
                previous.quaternion,
                current.quaternion,
                alpha,
            );
            object.scale.lerpVectors(previous.scale, current.scale, alpha);
            readTransform(rendered, object);
        }
    }

    function finishRender(state: TState, frame: FaunaSimulationFrame) {
        // A separate registry makes this order independent of initial/late
        // React mount order: every mixer precedes every manual pose override.
        for (const callback of animationCallbacks.values())
            callback(state, frame);
        for (const callback of renderCallbacks.values()) callback(state, frame);
        // Visual callbacks may write root poses. Remember their output, while
        // keeping the authoritative simulation transforms separate.
        for (const { transform } of callbacks.values()) {
            if (transform) readTransform(transform.rendered, transform.object);
        }
        renderCount += 1;
    }

    return {
        register: (
            callback: (state: TState, frame: FaunaSimulationFrame) => void,
            getObject?: () => Object3D | null,
        ) => {
            const id = Symbol();
            callbacks.set(id, { callback, getObject });
            return () => {
                const transform = callbacks.get(id)?.transform;
                if (transform)
                    writeTransform(transform.object, transform.current);
                callbacks.delete(id);
            };
        },
        registerRender: (
            callback: (state: TState, frame: FaunaSimulationFrame) => void,
        ) => {
            const id = Symbol();
            renderCallbacks.set(id, callback);
            return () => {
                renderCallbacks.delete(id);
            };
        },
        registerAnimation: (
            callback: (state: TState, frame: FaunaSimulationFrame) => void,
        ) => {
            const id = Symbol();
            animationCallbacks.set(id, callback);
            return () => {
                animationCallbacks.delete(id);
            };
        },
        getInterpolationAlpha: () =>
            Math.min(1, accumulator / faunaSimulationStepSeconds),
        advance: (
            state: TState,
            frame: FaunaSimulationFrame,
            finishVisuals = true,
        ) => {
            if (!Number.isFinite(frame.now) || !Number.isFinite(frame.delta)) {
                return;
            }
            synchronizeObjects();
            if (
                lastFrameTime === null ||
                frame.now < lastFrameTime ||
                resumed
            ) {
                accumulator = 0;
                simulationTime = frame.now;
                simulate(
                    state,
                    Math.min(
                        faunaSimulationStepSeconds,
                        Math.max(0, frame.delta),
                    ),
                    simulationTime,
                );
                resumed = false;
            } else {
                const elapsed = Math.max(0, frame.now - lastFrameTime);
                accumulator += Math.min(maximumFrameDeltaSeconds, elapsed);
                if (elapsed > maximumFrameDeltaSeconds) {
                    // Drop excess movement work, never absolute deadlines.
                    // The scene root already excludes hidden wall-clock gaps.
                    simulationTime = frame.now - accumulator;
                }
                while (
                    accumulator + timeEpsilon >=
                    faunaSimulationStepSeconds
                ) {
                    accumulator = Math.max(
                        0,
                        accumulator - faunaSimulationStepSeconds,
                    );
                    simulationTime += faunaSimulationStepSeconds;
                    simulate(state, faunaSimulationStepSeconds, simulationTime);
                }
            }
            lastFrameTime = frame.now;
            interpolate();
            if (finishVisuals) finishRender(state, frame);
        },
        finishRender,
        resume: () => {
            resumed = true;
            accumulator = 0;
            for (const { transform } of callbacks.values()) {
                if (transform)
                    copyTransform(transform.previous, transform.current);
            }
        },
        getStats: () => ({
            simulationCallbacks: callbacks.size,
            renderCallbacks: renderCallbacks.size,
            animationCallbacks: animationCallbacks.size,
            stepCount,
            renderCount,
        }),
    };
}
