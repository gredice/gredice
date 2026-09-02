import { animated, useSpring } from '@react-spring/three';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import {
    useSceneAfterRenderSubscription,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';

export type R3FRootIsolationCounters = {
    frameloop: string;
    springChangeCount: number;
    submittedFrameCount: number;
};

export function R3FRootIsolationSpring({
    counters,
    ownsCadence,
}: {
    counters: R3FRootIsolationCounters;
    ownsCadence: boolean;
}) {
    const frameloop = useThree((state) => state.frameloop);
    const subscribeAfterRender = useSceneAfterRenderSubscription();
    const { offset } = useSpring({
        config: { duration: 200 },
        from: { offset: -0.35 },
        loop: { reverse: true },
        onChange: () => {
            counters.springChangeCount += 1;
        },
        to: { offset: 0.35 },
    });

    counters.frameloop = frameloop;
    useSceneTimeInvalidation(
        'r3f-root-isolation-browser-driver',
        ownsCadence,
        60,
    );

    useEffect(
        () =>
            subscribeAfterRender(() => {
                counters.submittedFrameCount += 1;
            }),
        [counters, subscribeAfterRender],
    );

    return (
        <animated.mesh position-x={offset}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial color={ownsCadence ? '#44aa66' : '#aa6644'} />
        </animated.mesh>
    );
}
