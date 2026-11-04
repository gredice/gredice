/** CSS size the capture scene is laid out at; camera framing depends on it. */
export const gardenPreviewLayoutWidth = 1200;
export const gardenPreviewLayoutHeight = 630;
/**
 * Previews render at 2× the layout so they stay sharp on high-density screens
 * and when cropped into taller frames such as the landing hero.
 */
export const gardenPreviewPixelRatio = 2;
/** Stored WebP size in pixels. */
export const gardenPreviewWidth =
    gardenPreviewLayoutWidth * gardenPreviewPixelRatio;
export const gardenPreviewHeight =
    gardenPreviewLayoutHeight * gardenPreviewPixelRatio;
export const gardenPreviewContentType = 'image/webp';
/** Below Vercel's 4.5 MB request body limit for the upload route. */
export const gardenPreviewMaxSizeBytes = 4 * 1024 * 1024;
export const gardenPreviewMinimumUploadIntervalMs = 30 * 1000;
/** v3: 2× resolution and no decorative snowfall frozen into the image. */
export const gardenPreviewRendererVersion = 'garden-preview-v3';
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
