import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import {
    ActorSpeechBubble,
    useActorHoverSpeech,
} from '../../../packages/game/src/entities/animals/ActorSpeechBubble';

const fixtureMessages = ['Lijep dan u vrtu!', 'Vrt izgleda prekrasno!'];

export function ActorSpeechBubbleFixture() {
    const [ready, setReady] = useState(false);
    const { hideMessage, message, showMessage } =
        useActorHoverSpeech(fixtureMessages);

    return (
        <div
            data-message={message ?? ''}
            data-render-ready={ready ? 'true' : 'false'}
            data-testid="actor-speech-bubble-fixture"
            style={{ height: 240, width: 360 }}
        >
            <Canvas
                orthographic
                camera={{ position: [0, 0, 10], zoom: 80 }}
                frameloop="always"
                onCreated={() => setReady(true)}
            >
                <group
                    onPointerOver={(event) => {
                        event.stopPropagation();
                        showMessage();
                    }}
                    onPointerOut={(event) => {
                        event.stopPropagation();
                        hideMessage();
                    }}
                >
                    <mesh>
                        <planeGeometry args={[2.5, 2.5]} />
                        <meshBasicMaterial color="#3f6585" />
                    </mesh>
                    {message ? (
                        <ActorSpeechBubble
                            message={message}
                            position={[0, 1.2, 0]}
                        />
                    ) : null}
                </group>
            </Canvas>
        </div>
    );
}
