export const gardenPreviewWidth = 1200;
export const gardenPreviewHeight = 630;
export const gardenPreviewContentType = 'image/webp';
export const gardenPreviewMaxSizeBytes = 2 * 1024 * 1024;
export const gardenPreviewMinimumUploadIntervalMs = 30 * 1000;
export const gardenPreviewRendererVersion = 'garden-preview-v2';
export type GardenPreviewPhase = 'day' | 'night';
export const gardenPreviewPhases: readonly GardenPreviewPhase[] = [
    'day',
    'night',
];
export const gardenPreviewDefaultPhase: GardenPreviewPhase = 'day';
export const gardenPreviewPhaseHeader = 'X-Garden-Preview-Phase';
export const gardenPreviewSourceRevisionHeader =
    'X-Garden-Preview-Source-Revision';
export const gardenPreviewRendererVersionHeader =
    'X-Garden-Preview-Renderer-Version';

export function isGardenPreviewPhase(
    value: string | undefined,
): value is GardenPreviewPhase {
    return value === 'day' || value === 'night';
}
