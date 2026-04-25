'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    ClampToEdgeWrapping,
    LinearFilter,
    LinearMipmapLinearFilter,
    SRGBColorSpace,
    type Texture,
    TextureLoader,
} from 'three';
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

async function loadTexture(url: string, fallbackUrl?: string) {
    const loader = new TextureLoader();
    let texture: Texture;
    try {
        texture = await loader.loadAsync(url);
    } catch (error) {
        if (!fallbackUrl || fallbackUrl === url) {
            throw error;
        }

        texture = await loader.loadAsync(fallbackUrl);
    }

    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
}

export function useSpriteAtlasTexture(
    assetPaths: SpriteAtlasAssetPaths | null,
) {
    const spriteBaseUrl = useGameState((state) => state.spriteBaseUrl);
    const resolvedUrls = useMemo(
        () =>
            assetPaths
                ? {
                      primary: resolveAppAssetUrl(
                          spriteBaseUrl,
                          assetPaths.webpUrl,
                      ),
                      fallback: resolveAppAssetUrl(
                          spriteBaseUrl,
                          assetPaths.pngUrl,
                      ),
                  }
                : null,
        [spriteBaseUrl, assetPaths],
    );
    const [texture, setTexture] = useState<Texture | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!resolvedUrls) {
            setTexture(null);
            setError(null);
            return;
        }

        let cancelled = false;
        const cacheKey = `${resolvedUrls.primary}|${resolvedUrls.fallback}`;
        let request = textureCache.get(cacheKey);

        if (!request) {
            request = loadTexture(resolvedUrls.primary, resolvedUrls.fallback);
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
    }, [resolvedUrls]);

    return { error, texture };
}
