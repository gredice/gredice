import { Canvas, useFrame } from '@react-three/fiber';
import { useCallback, useRef, useState } from 'react';
import {
    HoverOutline,
    HoverOutlineEffect,
    HoverOutlineProvider,
} from '../../../packages/game/src/entities/helpers/HoverOutline';
import { SceneTimeProvider } from '../../../packages/game/src/scene/SceneTime';

function MarkFixtureReady({
    frameCount = 3,
    onReady,
}: {
    frameCount?: number;
    onReady: () => void;
}) {
    const renderedFrameCount = useRef(0);

    useFrame(() => {
        renderedFrameCount.current += 1;
        if (renderedFrameCount.current === frameCount) {
            onReady();
        }
    });

    return null;
}

export function HoverOutlineCacheFixture() {
    const [offset, setOffset] = useState(0);
    const [ready, setReady] = useState(false);
    const markReady = useCallback(() => setReady(true), []);
    const detachOutlineTargetRef = useRef<(() => void) | null>(null);
    const detachOutlineTarget = useCallback(
        () => detachOutlineTargetRef.current?.(),
        [],
    );

    return (
        <div
            data-render-ready={ready ? 'true' : 'false'}
            data-testid="hover-outline-cache-fixture"
        >
            <button
                data-testid="move-outline-target"
                onClick={() => setOffset((value) => value + 0.25)}
                type="button"
            >
                Move target
            </button>
            <button
                data-testid="move-outline-target-offscreen"
                onClick={() => setOffset(100)}
                type="button"
            >
                Move target offscreen
            </button>
            <button
                data-testid="restore-outline-target"
                onClick={() => setOffset(0)}
                type="button"
            >
                Restore target
            </button>
            <button
                data-testid="detach-outline-target"
                onClick={detachOutlineTarget}
                type="button"
            >
                Detach target
            </button>
            <div style={{ height: 240, width: 360 }}>
                <Canvas
                    flat
                    orthographic
                    camera={{
                        far: 100,
                        near: 0.1,
                        position: [0, 0, 10],
                        zoom: 80,
                    }}
                    dpr={2}
                    frameloop="always"
                    gl={{
                        alpha: false,
                        antialias: false,
                        preserveDrawingBuffer: true,
                    }}
                >
                    <color attach="background" args={['#171b24']} />
                    <SceneTimeProvider suspendWhenOffscreen={false}>
                        <HoverOutlineProvider>
                            <group
                                ref={(targetRoot) => {
                                    detachOutlineTargetRef.current = targetRoot
                                        ? () =>
                                              targetRoot
                                                  .getObjectByName(
                                                      'Interaction:HoverOutlineTarget',
                                                  )
                                                  ?.removeFromParent()
                                        : null;
                                }}
                            >
                                <HoverOutline
                                    hovered
                                    maskContentKey="static-box-v1"
                                    thickness={5}
                                >
                                    <mesh position={[offset, 0, 0]}>
                                        <planeGeometry args={[1.3, 1.05]} />
                                        <meshBasicMaterial
                                            color="#3f6585"
                                            toneMapped={false}
                                        />
                                    </mesh>
                                </HoverOutline>
                            </group>
                            <HoverOutlineEffect />
                            <MarkFixtureReady
                                frameCount={6}
                                onReady={markReady}
                            />
                        </HoverOutlineProvider>
                    </SceneTimeProvider>
                </Canvas>
            </div>
        </div>
    );
}

export function HoverOutlineVisualFixture() {
    const [ready, setReady] = useState(false);
    const markReady = useCallback(() => setReady(true), []);

    return (
        <div
            data-render-ready={ready ? 'true' : 'false'}
            data-testid="hover-outline-visual-fixture"
            style={{
                background: '#171b24',
                height: 240,
                overflow: 'hidden',
                width: 360,
            }}
        >
            <Canvas
                flat
                orthographic
                camera={{
                    far: 100,
                    near: 0.1,
                    position: [0, 0, 10],
                    zoom: 80,
                }}
                dpr={2}
                frameloop="always"
                gl={{
                    alpha: false,
                    antialias: false,
                    preserveDrawingBuffer: true,
                }}
            >
                <color attach="background" args={['#171b24']} />
                <SceneTimeProvider suspendWhenOffscreen={false}>
                    <HoverOutlineProvider>
                        <HoverOutline
                            color="#f8fafc"
                            hovered
                            opacity={1}
                            priority={0}
                            thickness={7}
                        >
                            <mesh position={[-0.65, 0, 0]}>
                                <planeGeometry args={[1.3, 1.05]} />
                                <meshBasicMaterial
                                    color="#3f6585"
                                    toneMapped={false}
                                />
                            </mesh>
                        </HoverOutline>
                        <HoverOutline
                            color="#f8fafc"
                            hovered
                            opacity={1}
                            priority={0}
                            thickness={7}
                        >
                            <mesh position={[0.65, 0, 0]}>
                                <planeGeometry args={[1.3, 1.05]} />
                                <meshBasicMaterial
                                    color="#3f6585"
                                    toneMapped={false}
                                />
                            </mesh>
                        </HoverOutline>
                        <HoverOutline
                            color="#f6c445"
                            hovered
                            opacity={0.55}
                            priority={10}
                            thickness={8}
                        >
                            <mesh position={[0, 0.52, 0.2]}>
                                <planeGeometry args={[1.25, 0.72]} />
                                <meshBasicMaterial
                                    color="#8c4a62"
                                    toneMapped={false}
                                />
                            </mesh>
                        </HoverOutline>
                        <HoverOutlineEffect />
                        <MarkFixtureReady onReady={markReady} />
                    </HoverOutlineProvider>
                </SceneTimeProvider>
            </Canvas>
        </div>
    );
}
