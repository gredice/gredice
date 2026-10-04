import { useEffect, useState } from 'react';
import type { GardenPhotoRequest } from './gardenPhotoRequest';

export function GardenPhotoRendererLoader(props: {
    request: GardenPhotoRequest;
    onCapture: (blob: Blob) => void;
    onError: (error: Error) => void;
}) {
    const [Renderer, setRenderer] = useState<
        typeof import('./GardenPhotoCaptureRenderer').default | null
    >(null);
    const { onError } = props;
    useEffect(() => {
        let active = true;
        void import('./GardenPhotoCaptureRenderer')
            .then((module) => {
                if (active) setRenderer(() => module.default);
            })
            .catch(() => {
                if (active) onError(new Error('Capture renderer unavailable'));
            });
        return () => {
            active = false;
        };
    }, [onError]);
    return Renderer ? <Renderer {...props} /> : null;
}
