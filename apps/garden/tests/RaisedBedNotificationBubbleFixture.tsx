import {
    operationCompletedNotificationType,
    raisedBedPhotoCompletedNotificationType,
} from '@gredice/js/notifications';
import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import { RaisedBedNotificationBubble } from '../../../packages/game/src/hud/RaisedBedNotificationBubbles';
import type { SelectedRaisedBedGardenNotification } from '../../../packages/game/src/raisedBedNotifications';

const notificationImage =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22280%22 height=%22200%22 viewBox=%220 0 280 200%22%3E%3Crect width=%22280%22 height=%22200%22 fill=%22%23589b47%22/%3E%3Cpath d=%22M20 145L90 80l45 42 38-30 87 67H20z%22 fill=%22%23d9efad%22/%3E%3C/svg%3E';

function fixtureNotification({
    imageUrl = notificationImage,
}: {
    imageUrl?: string | null;
} = {}): SelectedRaisedBedGardenNotification {
    const timestamp = new Date('2026-08-11T12:00:00.000Z');
    return {
        category: 'garden',
        content: 'Stigla je nova fotografija gredice.',
        createdAt: timestamp,
        gardenId: 8,
        header: 'Nova fotografija gredice Sjever',
        iconUrl: null,
        id: 'raised-bed-photo-notification',
        imageUrl,
        kind: imageUrl ? 'raisedBedPhoto' : 'text',
        linkUrl: '/?gredica=Gredica%20Sjever',
        metadata: {},
        priority: 'normal',
        raisedBedId: 17,
        readAt: null,
        timestamp,
        type: imageUrl
            ? raisedBedPhotoCompletedNotificationType
            : operationCompletedNotificationType,
    };
}

export function RaisedBedNotificationBubbleFixture({
    imageUrl,
}: {
    imageUrl?: string | null;
}) {
    const [ready, setReady] = useState(false);
    const [bubbleOpenCount, setBubbleOpenCount] = useState(0);
    const [raisedBedClickCount, setRaisedBedClickCount] = useState(0);
    const [positionX, setPositionX] = useState(0);
    const [visible, setVisible] = useState(true);
    const notification = fixtureNotification({ imageUrl });

    return (
        <div
            data-bubble-open-count={bubbleOpenCount}
            data-position-x={positionX}
            data-raised-bed-click-count={raisedBedClickCount}
            data-render-ready={ready ? 'true' : 'false'}
            data-testid="raised-bed-notification-bubble-fixture"
            style={{ height: 280, position: 'relative', width: 400 }}
        >
            <button
                type="button"
                data-testid="move-notification-anchor"
                onClick={() =>
                    setPositionX((current) => (current === 0 ? 1 : 0))
                }
                style={{ position: 'absolute', right: 0, top: 0, zIndex: 2 }}
            >
                Pomakni obavijest
            </button>
            <Canvas
                orthographic
                camera={{ position: [0, 0, 10], zoom: 70 }}
                frameloop="always"
                onCreated={() => setReady(true)}
            >
                {/* biome-ignore lint/a11y/noStaticElementInteractions: this Three.js mesh is the underlying raised-bed hit target exercised by the interaction test */}
                <mesh
                    onClick={() => setRaisedBedClickCount((count) => count + 1)}
                >
                    <planeGeometry args={[3, 2]} />
                    <meshBasicMaterial color="#589b47" />
                </mesh>
                {visible ? (
                    <RaisedBedNotificationBubble
                        notification={notification}
                        onOpen={() => {
                            setBubbleOpenCount((count) => count + 1);
                            setVisible(false);
                        }}
                        position={[positionX, 0.25, 0]}
                    />
                ) : null}
            </Canvas>
        </div>
    );
}
