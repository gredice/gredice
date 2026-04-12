import type { SpriteAtlasAssetPaths } from './types';

function stripKnownExtension(basePath: string) {
    return basePath.replace(/\.(png|ktx2|json)$/u, '');
}

export function resolveSpriteAtlasAssetPaths(
    basePath: string,
): SpriteAtlasAssetPaths {
    const normalizedBasePath = stripKnownExtension(basePath);

    return {
        basePath: normalizedBasePath,
        ktx2Url: `${normalizedBasePath}.ktx2`,
        manifestUrl: `${normalizedBasePath}.json`,
        pngUrl: `${normalizedBasePath}.png`,
    };
}
