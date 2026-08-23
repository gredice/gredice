import {
    gardenPreviewContentType,
    gardenPreviewHeight,
    gardenPreviewRendererVersion,
    gardenPreviewRendererVersionHeader,
    gardenPreviewSourceRevisionHeader,
    gardenPreviewWidth,
} from '@gredice/js/gardenPreviews';

export {
    gardenPreviewHeight,
    gardenPreviewMaxSizeBytes,
    gardenPreviewRendererVersion,
    gardenPreviewRendererVersionHeader,
    gardenPreviewSourceRevisionHeader,
    gardenPreviewWidth,
} from '@gredice/js/gardenPreviews';

export type GardenPreviewImage = {
    url: string;
    width: number;
    height: number;
    capturedAt: string;
    sourceRevision: string;
    rendererVersion: string;
};

const recentlyCapturedPreviewWindowMs = 5 * 60 * 1000;
export const staleGardenPreviewQuietPeriodMs = 10 * 1000;

type GardenPreviewCaptureState = {
    enabled: boolean;
    isPublic: boolean;
    previewImage?: GardenPreviewImage | null;
    sourceRevision?: string | null;
};

export function shouldCaptureGardenPreview({
    enabled,
    isPublic,
    previewImage,
    sourceRevision,
}: GardenPreviewCaptureState) {
    if (!enabled || !isPublic || !sourceRevision) {
        return false;
    }

    return (
        !previewImage ||
        previewImage.sourceRevision !== sourceRevision ||
        previewImage.rendererVersion !== gardenPreviewRendererVersion ||
        previewImage.width !== gardenPreviewWidth ||
        previewImage.height !== gardenPreviewHeight
    );
}

export function getGardenPreviewCaptureDelayMs({
    now = Date.now(),
    previewImage,
    sourceRevision,
}: {
    now?: number;
    previewImage?: GardenPreviewImage | null;
    sourceRevision?: string | null;
}) {
    if (
        !previewImage ||
        !sourceRevision ||
        previewImage.sourceRevision === sourceRevision
    ) {
        return 0;
    }

    const ageMs = now - Date.parse(previewImage.capturedAt);
    return Number.isFinite(ageMs) &&
        ageMs >= 0 &&
        ageMs < recentlyCapturedPreviewWindowMs
        ? staleGardenPreviewQuietPeriodMs
        : 0;
}

export function getGardenPreviewUploadUrl(gardenId: number) {
    return `/api/gredice/api/gardens/${gardenId.toString()}/preview`;
}

export function getGardenPreviewUploadHeaders(sourceRevision: string) {
    return {
        'Content-Type': gardenPreviewContentType,
        [gardenPreviewSourceRevisionHeader]: sourceRevision,
        [gardenPreviewRendererVersionHeader]: gardenPreviewRendererVersion,
    };
}
