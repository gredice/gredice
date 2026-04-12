'use client';

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import {
    ClampToEdgeWrapping,
    LinearFilter,
    LinearMipmapLinearFilter,
    SRGBColorSpace,
    type Texture,
    TextureLoader,
    type WebGLRenderer,
} from 'three';
import { KTX2Loader } from 'three-stdlib';
import { useGameState } from '../useGameState';
import type { SpriteAtlasAssetPaths } from './types';

const textureCache = new Map<string, Promise<Texture>>();

function toError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

function resolveAppAssetUrl(appBaseUrl: string, assetPath: string) {
    if (/^https?:\/\//u.test(assetPath)) {
        return assetPath;
    }

    const normalizedBase = appBaseUrl.replace(/\/$/u, '');
    const normalizedPath = assetPath.startsWith('/')
        ? assetPath
        : `/${assetPath}`;

    return `${normalizedBase}${normalizedPath}`;
}

function ensureTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`;
}

function configureTexture(texture: Texture, flipY: boolean) {
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = flipY;
    texture.needsUpdate = true;

    return texture;
}

async function loadCompressedTexture(
    atlasUrl: string,
    transcoderPath: string,
    renderer: WebGLRenderer,
) {
    const loader = new KTX2Loader();
    loader.setTranscoderPath(ensureTrailingSlash(transcoderPath));
    loader.detectSupport(renderer);

    try {
        const texture = await loader.loadAsync(atlasUrl);
        return configureTexture(texture, false);
    } finally {
        loader.dispose();
    }
}

async function loadStandardTexture(atlasUrl: string) {
    const loader = new TextureLoader();
    const texture = await loader.loadAsync(atlasUrl);

    return configureTexture(texture, false);
}

async function loadSpriteAtlasTexture(options: {
    ktx2Url: string;
    pngUrl: string;
    renderer: WebGLRenderer;
    transcoderPath: string;
}) {
    try {
        return await loadCompressedTexture(
            options.ktx2Url,
            options.transcoderPath,
            options.renderer,
        );
    } catch {
        return loadStandardTexture(options.pngUrl);
    }
}

export function useSpriteAtlasTexture(
    assetPaths: SpriteAtlasAssetPaths | null,
) {
    const renderer = useThree((state) => state.gl);
    const spriteBaseUrl = useGameState((state) => state.spriteBaseUrl);
    const resolvedAssetPaths = useMemo(
        () =>
            assetPaths
                ? {
                      ktx2Url: resolveAppAssetUrl(
                          spriteBaseUrl,
                          assetPaths.ktx2Url,
                      ),
                      pngUrl: resolveAppAssetUrl(
                          spriteBaseUrl,
                          assetPaths.pngUrl,
                      ),
                      transcoderPath: resolveAppAssetUrl(
                          spriteBaseUrl,
                          '/assets/basis/',
                      ),
                  }
                : null,
        [spriteBaseUrl, assetPaths],
    );
    const [texture, setTexture] = useState<Texture | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!resolvedAssetPaths) {
            setTexture(null);
            setError(null);
            return;
        }

        const cacheKey = [
            resolvedAssetPaths.ktx2Url,
            resolvedAssetPaths.pngUrl,
            resolvedAssetPaths.transcoderPath,
        ].join('|');
        let cancelled = false;
        let request = textureCache.get(cacheKey);

        if (!request) {
            request = loadSpriteAtlasTexture({
                ktx2Url: resolvedAssetPaths.ktx2Url,
                pngUrl: resolvedAssetPaths.pngUrl,
                renderer,
                transcoderPath: resolvedAssetPaths.transcoderPath,
            });
            textureCache.set(cacheKey, request);
        }

        request
            .then((loadedTexture) => {
                if (cancelled) {
                    return;
                }

                setTexture(loadedTexture);
                setError(null);
            })
            .catch((loadError) => {
                if (cancelled) {
                    return;
                }

                setTexture(null);
                setError(toError(loadError));
            });

        return () => {
            cancelled = true;
        };
    }, [renderer, resolvedAssetPaths]);

    return { error, texture };
}
