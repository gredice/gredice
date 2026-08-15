import { useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useCallback, useLayoutEffect } from 'react';
import type { Group } from 'three';
import { useGameState } from '../useGameState';
import { resolvePrecipitationFieldPosition } from './precipitationFieldPosition';

export function usePrecipitationFieldPosition({
    fieldRef,
    followCamera,
}: {
    fieldRef: RefObject<Group | null>;
    followCamera: boolean;
}) {
    const activeCamera = useThree((state) => state.camera);
    const avatarView = useGameState((state) => state.gardenAvatarView);
    const gameCamera = useGameState((state) => state.gameCamera);

    const updateFieldPosition = useCallback(
        ({ x, z }: { x: number; z: number }) => {
            fieldRef.current?.position.set(x, 0, z);
        },
        [fieldRef],
    );

    useLayoutEffect(() => {
        if (!followCamera) {
            fieldRef.current?.position.set(0, 0, 0);
            return;
        }

        const snapshot = gameCamera?.getSnapshot();
        const position = resolvePrecipitationFieldPosition({
            activeCameraPosition: activeCamera.position,
            avatarView,
            followCamera,
            overviewTarget: snapshot?.target,
        });
        if (position) {
            updateFieldPosition(position);
        }

        if (avatarView !== 'overview' || !gameCamera) {
            return;
        }

        return gameCamera.subscribe((nextSnapshot) => {
            const nextPosition = resolvePrecipitationFieldPosition({
                activeCameraPosition: activeCamera.position,
                avatarView,
                followCamera,
                overviewTarget: nextSnapshot.target,
            });
            if (nextPosition) {
                updateFieldPosition(nextPosition);
            }
        });
    }, [
        activeCamera,
        avatarView,
        fieldRef,
        followCamera,
        gameCamera,
        updateFieldPosition,
    ]);

    useFrame(({ camera }) => {
        if (!followCamera || avatarView === 'overview') {
            return;
        }

        const position = resolvePrecipitationFieldPosition({
            activeCameraPosition: camera.position,
            avatarView,
            followCamera,
        });
        if (position) {
            updateFieldPosition(position);
        }
    }, -90);
}
