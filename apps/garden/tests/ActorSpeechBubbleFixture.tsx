import { Canvas } from '@react-three/fiber';
import { useRef, useState } from 'react';
import {
    type ActorSpeechAnchor,
    ActorSpeechBubble,
    useActorHoverSpeech,
} from '../../../packages/game/src/entities/animals/ActorSpeechBubble';

const fixtureMessages = ['Lijep dan u vrtu!', 'Vrt izgleda prekrasno!'];

export function ActorSpeechBubbleFixture({
    cameraZoom = 80,
    interactive = false,
}: {
    cameraZoom?: number;
    interactive?: boolean;
}) {
    const [ready, setReady] = useState(false);
    const [actorX, setActorX] = useState(0);
    const [bubbleClicks, setBubbleClicks] = useState(0);
    const actorRef = useRef<ActorSpeechAnchor>(null);
    const { message, showMessage } = useActorHoverSpeech(
        fixtureMessages,
        3_000,
    );

    function moveActor() {
        const nextActorX = actorX === 0 ? 0.75 : 0;
        if (actorRef.current) {
            actorRef.current.position.x = nextActorX;
            setActorX(actorRef.current.position.x);
            return;
        }
        setActorX(Number.NaN);
    }

    return (
        <div
            data-actor-x={actorX}
            data-bubble-clicks={bubbleClicks}
            data-message={message ?? ''}
            data-render-ready={ready ? 'true' : 'false'}
            data-testid="actor-speech-bubble-fixture"
            style={{ height: 240, position: 'relative', width: 360 }}
        >
            <button
                type="button"
                data-testid="move-actor"
                onClick={moveActor}
                style={{ position: 'absolute', right: 0, top: 0, zIndex: 1 }}
            >
                Pomakni glumca
            </button>
            <Canvas
                orthographic
                camera={{ position: [0, 0, 10], zoom: cameraZoom }}
                frameloop="always"
                onCreated={() => setReady(true)}
            >
                <group
                    ref={actorRef}
                    onPointerOver={(event) => {
                        event.stopPropagation();
                        showMessage();
                    }}
                >
                    <mesh>
                        <planeGeometry args={[2.5, 2.5]} />
                        <meshBasicMaterial color="#3f6585" />
                    </mesh>
                </group>
                {message ? (
                    <ActorSpeechBubble
                        actionLabel={interactive ? 'Otvori poruku' : undefined}
                        actorRef={actorRef}
                        message={message}
                        offsetY={1.2}
                        onClick={
                            interactive
                                ? () => setBubbleClicks((count) => count + 1)
                                : undefined
                        }
                    />
                ) : null}
            </Canvas>
        </div>
    );
}
