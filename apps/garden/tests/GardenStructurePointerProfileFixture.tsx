'use client';

import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    readGameProfileMetadata,
    setGardenStructureProfileTelemetryEnabled,
} from '../../../packages/game/src/scene/gameProfileMetadata';
import { useGardenStructurePointerProfileHandlers } from '../../../packages/game/src/structures/useGardenStructurePointerProfileHandlers';

type PointerProfileSnapshot = Readonly<{
    count: number;
    durationMaxMs: number;
    durationTotalMs: number;
    order: string;
}>;

const emptySnapshot: PointerProfileSnapshot = Object.freeze({
    count: 0,
    durationMaxMs: 0,
    durationTotalMs: 0,
    order: '',
});

export function GardenStructurePointerProfileFixture() {
    const eventsRef = useRef<string[]>([]);
    const [canvasReady, setCanvasReady] = useState(false);
    const [snapshot, setSnapshot] = useState(emptySnapshot);

    useEffect(() => {
        setGardenStructureProfileTelemetryEnabled(true);
        return () => setGardenStructureProfileTelemetryEnabled(false);
    }, []);

    const publishSnapshot = useCallback(() => {
        queueMicrotask(() => {
            const profile = readGameProfileMetadata();
            setSnapshot({
                count:
                    profile?.gardenStructureEditorPointerResolutionCount ?? 0,
                durationMaxMs:
                    profile?.gardenStructureEditorPointerResolutionMaxMs ?? 0,
                durationTotalMs:
                    profile?.gardenStructureEditorPointerResolutionTotalMs ?? 0,
                order: eventsRef.current.join(','),
            });
        });
    }, []);
    const { handleClick, handleClickCapture } =
        useGardenStructurePointerProfileHandlers({
            enabled: true,
            onClick: () => {
                eventsRef.current.push('bubble');
                publishSnapshot();
            },
            onClickCapture: () => {
                eventsRef.current = ['capture'];
            },
        });

    return (
        // This fixture mirrors GameScene's passive Canvas profiler boundary.
        // biome-ignore lint/a11y/noStaticElementInteractions: passive profiler boundary, not an interactive control
        // biome-ignore lint/a11y/useKeyWithClickEvents: Canvas click timing has no equivalent keyboard event
        <div
            className="h-[240px] w-[320px]"
            data-canvas-ready={canvasReady ? 'true' : 'false'}
            data-pointer-count={snapshot.count}
            data-pointer-duration-max-ms={snapshot.durationMaxMs}
            data-pointer-duration-total-ms={snapshot.durationTotalMs}
            data-pointer-order={snapshot.order}
            data-testid="garden-structure-pointer-profile"
            onClick={handleClick}
            onClickCapture={handleClickCapture}
        >
            <Canvas
                camera={{ position: [0, 0, 4] }}
                onCreated={() => setCanvasReady(true)}
            >
                {/* biome-ignore lint/a11y/noStaticElementInteractions: R3F mesh target is exercised through the Canvas */}
                <mesh
                    onClick={() => {
                        eventsRef.current.push('target');
                        const startedAt = performance.now();
                        while (performance.now() - startedAt < 6) {
                            // Bounded synchronous target work proves the outer
                            // sample encloses R3F event resolution/handling.
                        }
                    }}
                >
                    <boxGeometry args={[1.5, 1.5, 0.4]} />
                    <meshBasicMaterial color="#7f9f70" />
                </mesh>
            </Canvas>
        </div>
    );
}
