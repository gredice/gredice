import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import { useGameState } from '../useGameState';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useControls } from 'leva';
import { CameraController } from '../controllers/CameraController';

function useCameraRotate() {
    const orbitControls = useGameState(state => state.orbitControls);
    const worldRotation = useGameState(state => state.worldRotation);

    useEffect(() => {
        orbitControls?.setAzimuthalAngle(worldRotation * (Math.PI / 2) + Math.PI / 4 + Math.PI);
    }, [worldRotation, orbitControls]);
}

const up = new Vector3(0, 1, 0);

function useCameraPan(direction: [number, number] | null) {
    const dir = useRef(new Vector3());
    const camera = useThree(state => state.camera);
    const orbitControls = useGameState(state => state.orbitControls);

    useFrame(() => {
        if (direction === null) return;

        camera.getWorldDirection(dir.current);
        const vel = dir.current
            .projectOnPlane(up)
            .applyAxisAngle(up, Math.atan2(direction[0], direction[1]))
            .normalize()
            .multiplyScalar(0.2);

        camera.position.add(vel);
        if (orbitControls) {
            orbitControls.target.add(vel);
            orbitControls.update();
        }
    });
}

const rotateKeys: Record<string, 'cw' | 'ccw'> = {
    KeyQ: 'cw',
    KeyW: 'ccw',
}

const panKeys: Record<string, [number, number]> = {
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
    ArrowLeft: [1, 0],
    ArrowRight: [-1, 0],
}

const rotateValueByKey = (key: string) => rotateKeys[key];

const useKeyboardControls = () => {
    const [panDir, setPanDir] = useState<[number, number] | null>(null);
    const worldRotate = useGameState(state => state.worldRotate);
    useCameraPan(panDir);

    useEffect(() => {
        console.debug('Keyboard controls initialized');

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

            // Handle rotation
            const rotateValue = rotateValueByKey(e.code);
            if (rotateValue) worldRotate(rotateValue);

            // Handle panning
            const panValue = panKeys[e.code];
            if (panValue) setPanDir(panValue);
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            const panValue = panKeys[e.code];
            if (panValue) {
                setPanDir(null);
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keyup', handleKeyUp)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('keyup', handleKeyUp)
        }
    }, [setPanDir]);
}

export function Controls({ isDevelopment }: { isDevelopment?: boolean }) {
    const setOrbitControls = useGameState(state => state.setOrbitControls);
    const setIsDragging = useGameState(state => state.setIsDragging);
    useCameraRotate();
    useKeyboardControls();
    const [isAnimating, setIsAnimating] = useState(false);

    // Closeup
    const { isCloseUp, targetPosition } = isDevelopment ? useControls({
        isCloseUp: { value: false, label: "Closeup" },
        targetPosition: { value: [0, 0, 0], label: "Target Position" },
    }) : { isCloseUp: false, targetPosition: [0, 0, 0] as [number, number, number] };

    return (
        <>
            <CameraController
                isCloseUp={isCloseUp}
                targetPosition={targetPosition}
                onAnimationStart={() => setIsAnimating(true)}
                onAnimationComplete={() => setIsAnimating(false)}
            />
            <OrbitControls
                ref={setOrbitControls}
                enabled={!isCloseUp && !isAnimating}
                enableRotate={false}
                screenSpacePanning={false}
                onStart={() => setIsDragging(true)}
                onEnd={() => setIsDragging(false)}
                minZoom={50}
                maxZoom={200} />
        </>
    )
}