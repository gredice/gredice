import type { SpriteAtlasAssetPaths } from './types';

function stripKnownExtension(basePath: string) {
    return basePath.replace(/\.(png|webp|json)$/u, '');
}

export function resolveSpriteAtlasAssetPaths(
    basePath: string,
): SpriteAtlasAssetPaths {
    const normalizedBasePath = stripKnownExtension(basePath);

    return {
        basePath: normalizedBasePath,
        manifestUrl: `${normalizedBasePath}.json`,
        pngUrl: `${normalizedBasePath}.png`,
        webpUrl: `${normalizedBasePath}.webp`,
    };
}
