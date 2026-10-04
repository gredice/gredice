'use client';
import { PublicGardenViewer } from '../viewers/PublicGardenViewer';
import type { GardenPhotoRequest } from './gardenPhotoRequest';

export default function GardenPhotoCaptureRenderer({
    request,
    onCapture,
    onError,
}: {
    request: GardenPhotoRequest;
    onCapture: (blob: Blob) => void;
    onError: (error: Error) => void;
}) {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed top-0 -z-50 overflow-hidden"
            data-private-photo-renderer
            style={{
                left: -20000,
                width: request.width,
                height: request.height,
            }}
        >
            <PublicGardenViewer
                key={request.key}
                garden={request.garden}
                fixedTime={request.date}
                appBaseUrl={request.appBaseUrl}
                spriteBaseUrl={request.spriteBaseUrl}
                className="size-full"
                deferDetails={false}
                capture={{
                    key: request.key,
                    onCapture,
                    onError,
                    dayNightCycleDisabled: request.dayNightCycleDisabled,
                    winterMode: request.winterMode,
                    output: {
                        contentType: 'image/png',
                        width: request.width,
                        height: request.height,
                        maxSizeBytes: 16 * 1024 * 1024,
                    },
                }}
            />
        </div>
    );
}
