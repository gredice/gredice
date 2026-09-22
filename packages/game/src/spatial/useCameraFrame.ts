'use client';

import { useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect } from 'react';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import { getCameraFrame } from './cameraFrame';

export function useCameraFrame() {
    const get = useThree((state) => state.get);
    const read = useCallback(() => {
        const { camera, size } = get();
        return getCameraFrame(camera, size);
    }, [get]);
    useLayoutEffect(() => {
        updateGameProfileMetadata({ spatialCamera: read().metrics });
    }, [read]);
    return read;
}
