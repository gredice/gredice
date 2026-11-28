import {
    type PropsWithChildren,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import { usePrefersReducedMotion } from '../../scene/IdleBreathingMotion';
import { animated, useSpring } from '../../scene/sceneSpring';
import {
    type BounceMotionKind,
    type BouncePivot,
    type BouncePose,
    bounceMotions,
    bouncePoseTransform,
    fallConfig,
    riseConfig,
    type SpringConfig,
    settleConfig,
} from './bounceMotion';

type BounceMotion = (typeof bounceMotions)[BounceMotionKind];

/** Moves a bounce to a pose, animated or at once. */
export type BounceDriver = {
    move: (pose: BouncePose, config: SpringConfig) => Promise<unknown>;
    set: (pose: BouncePose) => void;
};

const restPose: BouncePose = [0, 0];

/** The pose a bounce starts from: in the air, stretched, for a drop. */
export function getBounceStartPose(motion: BounceMotion): BouncePose {
    return [motion.lift, motion.lift > 0 ? motion.stretch : 0];
}

/**
 * Plays one bounce: an optional hop or fall, then an impact that flattens the
 * block at once and springs back with a small wobble. `isCurrent` stops the
 * sequence when a newer bounce replaced it; `onImpact` runs at touchdown.
 */
export async function playBounceMotion({
    driver,
    isCurrent,
    motion,
    onImpact,
}: {
    driver: BounceDriver;
    isCurrent: () => boolean;
    motion: BounceMotion;
    onImpact?: () => void;
}) {
    if (motion.hop > 0) {
        driver.set(restPose);
        await driver.move([motion.hop, motion.stretch], riseConfig);
        if (!isCurrent()) return false;
        await driver.move([0, motion.stretch], fallConfig);
    } else if (motion.lift > 0) {
        driver.set(getBounceStartPose(motion));
        await driver.move([0, motion.stretch], fallConfig);
    }
    if (!isCurrent()) return false;
    onImpact?.();
    driver.set([0, -motion.squash]);
    await driver.move(restPose, settleConfig);
    return isCurrent();
}

/**
 * Springs for a bounce about `pivot`, the ground point in the animated
 * group's parent space. Every transform value is its own scene spring, so
 * the group follows the bounce on exactly the frames the scene renders.
 */
export function useBounceSpring(
    pivot: BouncePivot,
    initialPose: BouncePose = restPose,
) {
    const pivotRef = useRef(pivot);
    pivotRef.current = pivot;
    const [values, api] = useSpring(() => ({
        config: fallConfig,
        from: bouncePoseTransform(initialPose, pivot),
    }));
    const driver = useMemo<BounceDriver>(
        () => ({
            move: (pose, config) =>
                Promise.all(
                    api.start({
                        ...bouncePoseTransform(pose, pivotRef.current),
                        config,
                    }),
                ),
            set: (pose) => {
                api.set(bouncePoseTransform(pose, pivotRef.current));
            },
        }),
        [api],
    );
    return { driver, values };
}

type BounceSpringValues = ReturnType<typeof useBounceSpring>['values'];

/** The animated group a bounce moves; children squash toward the pivot. */
export function BounceTransformGroup({
    children,
    name,
    values,
}: PropsWithChildren<{ name: string; values: BounceSpringValues }>) {
    return (
        <animated.group
            name={name}
            position-x={values.positionX}
            position-y={values.positionY}
            position-z={values.positionZ}
            scale-x={values.scaleSide}
            scale-y={values.scaleUp}
            scale-z={values.scaleSide}
        >
            {children}
        </animated.group>
    );
}

const originPivot: BouncePivot = [0, 0, 0];

/**
 * Plays a bounce on its children each time `playKey` changes to a value above
 * zero, for things that are not placed blocks, such as a harvest basket.
 * Mounting with a key of zero shows the rest pose.
 */
export function BounceGroup({
    children,
    kind,
    name,
    pivot = originPivot,
    playKey,
}: PropsWithChildren<{
    kind: BounceMotionKind;
    name?: string;
    /** The ground point, in this group's space. */
    pivot?: BouncePivot;
    playKey: number;
}>) {
    const reducedMotion = usePrefersReducedMotion();
    const { driver, values } = useBounceSpring(pivot);
    const startedKey = useRef<number | null>(null);

    // Layout timing sets the start pose before the next frame, so something
    // that mounts already bouncing never shows its rest pose first.
    useLayoutEffect(() => {
        if (playKey <= 0 || startedKey.current === playKey) return;
        startedKey.current = playKey;
        if (reducedMotion) {
            driver.set(restPose);
            return;
        }
        const isCurrent = () => startedKey.current === playKey;
        void playBounceMotion({
            driver,
            isCurrent,
            motion: bounceMotions[kind],
        });
    }, [driver, kind, playKey, reducedMotion]);

    useEffect(
        () => () => {
            // Stops a sequence that is still awaiting a spring after unmount.
            startedKey.current = null;
        },
        [],
    );

    return (
        <BounceTransformGroup name={name ?? 'Animation:Bounce'} values={values}>
            {children}
        </BounceTransformGroup>
    );
}
