import type {
    WallpaperBranding,
    WallpaperSizeKey,
    WallpaperTemplate,
} from './wallpaperComposer';

export function macOSDynamicWallpaperFileName({
    branding,
    size,
    template,
}: {
    branding: WallpaperBranding;
    size: WallpaperSizeKey;
    template: WallpaperTemplate;
}) {
    return [
        'gredice-vrt',
        template,
        size,
        branding === 'gredice' ? 'potpis' : 'cista',
        'mac-dinamicka.heic',
    ].join('-');
}
