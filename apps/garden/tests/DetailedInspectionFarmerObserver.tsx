import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

export function DetailedInspectionFarmerObserver({
    onFrame,
}: {
    onFrame: (position: { x: number; y: number; z: number }) => void;
}) {
    const scene = useThree((state) => state.scene);
    const lastReportAtRef = useRef(Number.NEGATIVE_INFINITY);

    useFrame(({ clock }) => {
        if (clock.elapsedTime - lastReportAtRef.current < 0.1) {
            return;
        }

        const actor = scene.getObjectByName('DetailedInspectionFarmer');
        if (!actor) {
            return;
        }

        lastReportAtRef.current = clock.elapsedTime;
        onFrame({
            x: actor.position.x,
            y: actor.position.y,
            z: actor.position.z,
        });
    });

    return null;
}
