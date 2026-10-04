'use client';

import type {
    PublicGardenCapturePhase,
    PublicGardenDetail,
    PublicGardenViewerProps,
} from '@gredice/game';
import dynamic from 'next/dynamic';

const PublicGardenViewerDynamic = dynamic<PublicGardenViewerProps>(
    () => import('@gredice/game').then((module) => module.PublicGardenViewer),
    { ssr: false },
);

export type WallpaperCaptureRequest = {
    garden: PublicGardenDetail;
    height: number;
    key: string;
    phase: PublicGardenCapturePhase;
    transparent: boolean;
    width: number;
};

export function WallpaperCaptureRenderer({
    onCapture,
    onError,
    request,
}: {
    onCapture: (blob: Blob) => void;
    onError: (error: Error) => void;
    request: WallpaperCaptureRequest | null;
}) {
    if (!request) {
        return null;
    }

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed top-0 -z-50 overflow-hidden opacity-0"
            data-wallpaper-capture={request.key}
            style={{
                height: request.height,
                left: -10_000,
                width: request.width,
            }}
        >
            <PublicGardenViewerDynamic
                key={request.key}
                capture={{
                    fitGarden: true,
                    fitGardenPadding: 0.68,
                    key: request.key,
                    onCapture,
                    onError,
                    output: {
                        contentType: 'image/png',
                        height: request.height,
                        width: request.width,
                    },
                    phase: request.phase,
                    transparent: request.transparent,
                }}
                className="size-full"
                deferDetails={false}
                garden={request.garden}
            />
        </div>
    );
}
