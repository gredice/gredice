import {
    type RenderCallback,
    type RootState,
    useFrame,
} from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    type RefObject,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import type { Object3D } from 'three';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import { useSceneResume } from '../../scene/SceneTime';
import {
    createFaunaPresentationSample,
    createFaunaSimulation,
    createFaunaWalkDistance,
} from './faunaSimulation';

import { createFaunaSimulationProfile } from './faunaSimulationProfile';

const faunaSimulationProfile = createFaunaSimulationProfile((stats) =>
    updateGameProfileMetadata({ faunaSimulation: stats }),
);

type FaunaSimulation = ReturnType<typeof createFaunaSimulation<RootState>>;
const FaunaRuntimeContext = createContext<FaunaSimulation | null>(null);

export function FaunaRuntimeProvider({ children }: PropsWithChildren) {
    const clock = useMemo(
        () =>
            ({
                autoStart: false,
                startTime: 0,
                oldTime: 0,
                elapsedTime: 0,
                running: false,
                start() {},
                stop() {},
                getDelta: () => 0,
                getElapsedTime() {
                    return this.elapsedTime;
                },
            }) satisfies RootState['clock'],
        [],
    );
    const simulationState = useRef<RootState | null>(null);
    const lastStatsTime = useRef(Number.NEGATIVE_INFINITY);
    const runtime = useMemo<FaunaSimulation>(
        () =>
            createFaunaSimulation<RootState>({
                resolveStepState: (state, frame) => {
                    // One stable stopped clock exposes absolute simulation
                    // time without mutating R3F's render clock or other roots.
                    clock.elapsedTime = frame.now;
                    if (!simulationState.current) {
                        simulationState.current = { ...state, clock };
                    } else {
                        Object.assign(simulationState.current, state, {
                            clock,
                        });
                    }
                    return simulationState.current;
                },
            }),
        [clock],
    );
    const profileRegistration = useRef<ReturnType<
        typeof faunaSimulationProfile.register
    > | null>(null);
    useLayoutEffect(() => {
        const registration = faunaSimulationProfile.register(
            runtime.getStats(),
        );
        profileRegistration.current = registration;
        lastStatsTime.current = Number.NEGATIVE_INFINITY;
        return () => {
            profileRegistration.current = null;
            registration.dispose();
        };
    }, [runtime]);
    useSceneResume(runtime.resume);
    // SceneTime (-1000) advances shared time first. All species movement then
    // runs here, before the render-cadence pose and grounding-shadow phase.
    useFrame((state, delta) => {
        runtime.advance(state, { delta, now: state.clock.elapsedTime }, false);
    }, -100);
    // Central mixers precede all manual poses, including actors mounted later.
    // The shadow batch (-10) observes both in this same rendered frame.
    useFrame((state, delta) => {
        runtime.finishRender(state, { delta, now: state.clock.elapsedTime });
        if (
            state.clock.elapsedTime < lastStatsTime.current ||
            state.clock.elapsedTime - lastStatsTime.current >= 1
        ) {
            lastStatsTime.current = state.clock.elapsedTime;
            profileRegistration.current?.update(runtime.getStats());
        }
    }, -25);

    return (
        <FaunaRuntimeContext.Provider value={runtime}>
            {children}
        </FaunaRuntimeContext.Provider>
    );
}

function useFaunaRuntime() {
    const runtime = useContext(FaunaRuntimeContext);
    if (!runtime)
        throw new Error('Missing FaunaRuntimeProvider in the scene tree');
    return runtime;
}

/** Retains one species callback; renders do not resubscribe or reorder it. */
export function useFaunaFrame(
    callback: RenderCallback,
    actorRef?: RefObject<Object3D | null>,
) {
    const runtime = useFaunaRuntime();
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useLayoutEffect(
        () =>
            runtime.register(
                (state, frame) => callbackRef.current(state, frame.delta),
                actorRef ? () => actorRef.current : undefined,
            ),
        [actorRef, runtime],
    );
}

/** Pose and grounding updates keep the actual render cadence. */
export function useFaunaRenderFrame(callback: RenderCallback) {
    const runtime = useFaunaRuntime();
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useLayoutEffect(
        () =>
            runtime.registerRender((state, frame) =>
                callbackRef.current(state, frame.delta),
            ),
        [runtime],
    );
}

/** Animation mixers always precede manual poses, irrespective of mount order. */
export function useFaunaAnimationFrame(callback: RenderCallback) {
    const runtime = useFaunaRuntime();
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useLayoutEffect(
        () =>
            runtime.registerAnimation((state, frame) =>
                callbackRef.current(state, frame.delta),
            ),
        [runtime],
    );
}

/** Gait samples use the same interpolation fraction as the actor transform. */
export function useFaunaWalkDistance() {
    const runtime = useFaunaRuntime();
    const distance = useMemo(
        () => createFaunaWalkDistance(runtime.getInterpolationAlpha),
        [runtime],
    );
    useSceneResume(distance.resume);
    return distance;
}

/** Keep gait, time and discrete behavior inputs in one visual sample. */
export function useFaunaPresentationSample<T>(
    actorRef: RefObject<Object3D | null>,
) {
    const runtime = useFaunaRuntime();
    const sample = useMemo(() => {
        const presentation = createFaunaPresentationSample<T>(
            runtime.getInterpolationAlpha,
        );
        let lastObject: Object3D | null = null;
        let lastPosition: Object3D['position'] | null = null;
        return {
            ...presentation,
            set: (value: T, time: number) => {
                const object = actorRef.current;
                const snap =
                    object !== lastObject ||
                    (object !== null &&
                        lastPosition !== null &&
                        object.position.distanceToSquared(lastPosition) > 4);
                const snapped = presentation.set(value, time, snap);
                lastObject = object;
                if (object) {
                    if (!lastPosition) lastPosition = object.position.clone();
                    else lastPosition.copy(object.position);
                }
                return snapped;
            },
        };
    }, [actorRef, runtime]);
    useSceneResume(sample.resume);
    return sample;
}
