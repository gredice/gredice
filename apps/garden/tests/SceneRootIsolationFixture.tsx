import { useState } from 'react';
import { Scene } from '../../../packages/game/src/scene/Scene';
import { PublicGardenCaptureProbe } from '../../../packages/game/src/viewers/PublicGardenCaptureProbe';
import { SceneRootIsolationProbe } from './SceneRootIsolationProbe';

export function SceneRootIsolationFixture({
    capture = false,
    goal = 0,
    skipDraw = false,
    framesPerSecond = 0,
}: {
    capture?: boolean;
    goal?: number;
    skipDraw?: boolean;
    framesPerSecond?: number;
}) {
    const [captureResult, setCaptureResult] = useState('waiting');
    return (
        <div>
            <div data-testid="root-a" style={{ width: 256, height: 256 }}>
                <Scene
                    position={[0, 0, 10]}
                    zoom={80}
                    baseFramesPerSecond={framesPerSecond}
                >
                    <SceneRootIsolationProbe id="a" goal={goal} />
                </Scene>
            </div>
            <div
                data-testid="root-b"
                style={{
                    width: 256,
                    height: 256,
                    position: 'fixed',
                    top: 0,
                    left: capture ? -20000 : 300,
                }}
            >
                <Scene
                    position={[0, 0, 10]}
                    zoom={80}
                    baseFramesPerSecond={0}
                    pixelRatio={1}
                    suspendWhenOffscreen={!capture}
                    animateSprings={!capture}
                    rendererOptions={{ preserveDrawingBuffer: true }}
                >
                    <SceneRootIsolationProbe
                        id="b"
                        pulse={capture}
                        skipDraw={skipDraw}
                    />
                    {capture && (
                        <PublicGardenCaptureProbe
                            enabled
                            queriesIdle
                            output={{ width: 256, height: 256 }}
                            onCapture={(blob) =>
                                setCaptureResult(`${blob.type}:${blob.size}`)
                            }
                            onError={(error) =>
                                setCaptureResult(`error:${error.message}`)
                            }
                        />
                    )}
                </Scene>
            </div>
            <output data-testid="capture-result">{captureResult}</output>
        </div>
    );
}
