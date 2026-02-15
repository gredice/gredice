import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MOUSE, TOUCH, Vector3 } from 'three';
import { CameraController } from '../controllers/CameraController';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useIsEditMode } from '../hooks/useIsEditMode';
import { useGameState } from '../useGameState';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../utils/raisedBedBlocks';

function useCameraRotate() {
    const orbitControls = useGameState((state) => state.orbitControls);
    const worldRotation = useGameState((state) => state.worldRotation);

    useEffect(() => {
        orbitControls?.setAzimuthalAngle(
            worldRotation * (Math.PI / 2) + Math.PI / 4 + Math.PI,
        );
    }, [worldRotation, orbitControls]);
}

const up = new Vector3(0, 1, 0);

function useCameraPan(direction: [number, number] | null) {
    const dir = useRef(new Vector3());
    const camera = useThree((state) => state.camera);
    const orbitControls = useGameState((state) => state.orbitControls);

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
};

const panKeys: Record<string, [number, number]> = {
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
    ArrowLeft: [1, 0],
    ArrowRight: [-1, 0],
};

const rotateValueByKey = (key: string) => rotateKeys[key];

const useKeyboardControls = () => {
    const [panDir, setPanDir] = useState<[number, number] | null>(null);
    const worldRotate = useGameState((state) => state.worldRotate);
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
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const panValue = panKeys[e.code];
            if (panValue) {
                setPanDir(null);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [worldRotate]);
};

export function Controls() {
    const isEditMode = useIsEditMode();
    const setOrbitControls = useGameState((state) => state.setOrbitControls);
    const setIsDragging = useGameState((state) => state.setIsDragging);
    const garden = useCurrentGarden();
    useCameraRotate();
    useKeyboardControls();
    const [isAnimating, setIsAnimating] = useState(false);

    // Closeup
    const isCloseUp = useGameState((state) => state.view) === 'closeup';
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const closeupOrientation = useMemo(() => {
        const currentGarden = garden.data;
        if (!closeupBlock || !currentGarden) {
            return undefined;
        }

        const raisedBed = findRaisedBedByBlockId(currentGarden, closeupBlock.id);
        return raisedBed?.orientation;
    }, [closeupBlock, garden.data]);

    const targetPosition: [number, number, number] = useMemo(() => {
        const currentGarden = garden.data;
        if (!closeupBlock || !currentGarden) {
            return [0, 0, 0];
        }

        const getStackPositionByBlockId = (blockId: string) =>
            currentGarden.stacks.find((stack) =>
                stack.blocks.some((block) => block.id === blockId),
            )?.position;

        const closeupBlockPosition = getStackPositionByBlockId(closeupBlock.id);
        if (!closeupBlockPosition) {
            return [0, 0, 0];
        }

        const raisedBed = findRaisedBedByBlockId(
            currentGarden,
            closeupBlock.id,
        );
        if (!raisedBed) {
            return [
                closeupBlockPosition.x,
                closeupBlockPosition.y,
                closeupBlockPosition.z,
            ];
        }

        const raisedBedBlockIds = getRaisedBedBlockIds(
            currentGarden,
            raisedBed.id,
        );
        if (raisedBedBlockIds.length !== 2) {
            return [
                closeupBlockPosition.x,
                closeupBlockPosition.y,
                closeupBlockPosition.z,
            ];
        }

        const connectedBlockPositions = raisedBedBlockIds
            .map((blockId) => getStackPositionByBlockId(blockId))
            .filter((position): position is Vector3 => Boolean(position));

        if (connectedBlockPositions.length !== 2) {
            return [
                closeupBlockPosition.x,
                closeupBlockPosition.y,
                closeupBlockPosition.z,
            ];
        }

        return [
            (connectedBlockPositions[0].x + connectedBlockPositions[1].x) / 2,
            (connectedBlockPositions[0].y + connectedBlockPositions[1].y) / 2,
            (connectedBlockPositions[0].z + connectedBlockPositions[1].z) / 2,
        ];
    }, [closeupBlock, garden.data]);

    return (
        <>
            <CameraController
                isCloseUp={isCloseUp}
                targetPosition={targetPosition}
                closeupOrientation={closeupOrientation}
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
                maxZoom={500}
                mouseButtons={{
                    LEFT: isEditMode ? undefined : MOUSE.PAN,
                    MIDDLE: MOUSE.DOLLY,
                    RIGHT: isEditMode ? MOUSE.PAN : undefined,
                }}
                touches={{
                    ONE: isEditMode ? undefined : TOUCH.PAN,
                    TWO: isEditMode ? TOUCH.DOLLY_PAN : TOUCH.DOLLY_PAN,
                }}
            />
        </>
    );
}
