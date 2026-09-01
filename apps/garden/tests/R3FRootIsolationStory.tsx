'use client';

import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    createRuntimeFrameLoopProfileTelemetry,
    type RuntimeFrameLoopProfileTelemetry,
} from '../../../packages/game/src/scene/gameProfileMetadata';
import { SceneTimeProvider } from '../../../packages/game/src/scene/SceneTime';
import {
    type R3FRootIsolationCounters,
    R3FRootIsolationSpring,
} from '../../../packages/game/tests/R3FRootIsolationSpring';

type RootCounters = R3FRootIsolationCounters;

type IsolationSnapshot = {
    active: RootCounters & RuntimeFrameLoopProfileTelemetry;
    secondary: RootCounters & RuntimeFrameLoopProfileTelemetry;
};

function IsolationRoot({
    counters,
    ownsCadence,
    telemetry,
}: {
    counters: RootCounters;
    ownsCadence: boolean;
    telemetry: RuntimeFrameLoopProfileTelemetry;
}) {
    return (
        <Canvas camera={{ position: [0, 0, 4] }} frameloop="demand">
            <SceneTimeProvider
                ambientFramesPerSecond={30}
                baseFramesPerSecond={0}
                continuousRenderLeasesEnabled
                runtimeFrameLoop={telemetry}
                suspendWhenOffscreen
            >
                <R3FRootIsolationSpring
                    counters={counters}
                    ownsCadence={ownsCadence}
                />
            </SceneTimeProvider>
        </Canvas>
    );
}

function createRootCounters(): RootCounters {
    return {
        frameloop: 'demand',
        springChangeCount: 0,
        submittedFrameCount: 0,
    };
}

export function R3FRootIsolationStory() {
    const [secondaryVisible, setSecondaryVisible] = useState(false);
    const outputRef = useRef<HTMLOutputElement>(null);
    const activeCounters = useMemo(createRootCounters, []);
    const activeTelemetry = useMemo(createRuntimeFrameLoopProfileTelemetry, []);
    const secondaryCounters = useMemo(createRootCounters, []);
    const secondaryTelemetry = useMemo(
        createRuntimeFrameLoopProfileTelemetry,
        [],
    );

    useEffect(() => {
        const publish = () => {
            if (!outputRef.current) {
                return;
            }
            const snapshot: IsolationSnapshot = {
                active: { ...activeCounters, ...activeTelemetry },
                secondary: {
                    ...secondaryCounters,
                    ...secondaryTelemetry,
                },
            };
            outputRef.current.textContent = JSON.stringify(snapshot);
        };
        publish();
        const interval = window.setInterval(publish, 50);
        return () => window.clearInterval(interval);
    }, [
        activeCounters,
        activeTelemetry,
        secondaryCounters,
        secondaryTelemetry,
    ]);

    return (
        <main>
            <button
                data-testid="toggle-secondary-root"
                onClick={() => setSecondaryVisible((visible) => !visible)}
                type="button"
            >
                Toggle secondary root
            </button>
            <output data-testid="r3f-root-isolation-output" ref={outputRef} />
            <div
                data-testid="active-root"
                style={{ height: 180, position: 'fixed', top: 40, width: 240 }}
            >
                <IsolationRoot
                    counters={activeCounters}
                    ownsCadence
                    telemetry={activeTelemetry}
                />
            </div>
            <div
                data-testid="secondary-root"
                style={{
                    height: 180,
                    position: 'fixed',
                    top: secondaryVisible ? 240 : 20_000,
                    width: 240,
                }}
            >
                <IsolationRoot
                    counters={secondaryCounters}
                    ownsCadence={false}
                    telemetry={secondaryTelemetry}
                />
            </div>
        </main>
    );
}
