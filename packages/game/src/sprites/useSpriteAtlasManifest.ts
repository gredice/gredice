'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGameState } from '../useGameState';
import type { SpriteAtlasManifest } from './types';

const manifestCache = new Map<string, Promise<SpriteAtlasManifest>>();

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

async function loadSpriteAtlasManifest(url: string) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Unable to load sprite atlas manifest from ${url}.`);
    }

    return (await response.json()) as SpriteAtlasManifest;
}

export function useSpriteAtlasManifest(manifestUrl: string) {
    const spriteBaseUrl = useGameState((state) => state.spriteBaseUrl);
    const resolvedManifestUrl = useMemo(
        () => resolveAppAssetUrl(spriteBaseUrl, manifestUrl),
        [spriteBaseUrl, manifestUrl],
    );
    const [manifest, setManifest] = useState<SpriteAtlasManifest | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;
        let request = manifestCache.get(resolvedManifestUrl);

        if (!request) {
            request = loadSpriteAtlasManifest(resolvedManifestUrl);
            manifestCache.set(resolvedManifestUrl, request);
        }

        request
            .then((result) => {
                if (cancelled) {
                    return;
                }

                setManifest(result);
                setError(null);
            })
            .catch((loadError) => {
                if (cancelled) {
                    return;
                }

                setManifest(null);
                setError(toError(loadError));
            });

        return () => {
            cancelled = true;
        };
    }, [resolvedManifestUrl]);

    return { error, manifest };
}
