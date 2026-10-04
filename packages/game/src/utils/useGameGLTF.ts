import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { type GameAssetName, gameAssetModels } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import {
    getGameResourceCache,
    loadGameGLTF,
    trackGameGLTF,
} from '../scene/resources/gameGLTFResources';
import { useGameState } from '../useGameState';
import { configureGameGLTFColorPaletteMaterials } from './configureGameGLTFMaterials';

export function resolveGameAssetModelUrl(
    appBaseUrl: string,
    assetName: GameAssetName,
) {
    return appBaseUrl + gameAssetModels[assetName].url;
}

export function preloadGameAssetModels(
    appBaseUrl: string,
    assetNames: readonly GameAssetName[],
) {
    for (const assetName of assetNames) {
        // Failures surface through the suspending consumer's error boundary.
        loadGameGLTF(resolveGameAssetModelUrl(appBaseUrl, assetName)).catch(
            () => undefined,
        );
    }
}

export function useGameGLTF(assetName: GameAssetName) {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const url = resolveGameAssetModelUrl(appBaseUrl, assetName);
    const gltf = useGLTF(url) as unknown as GLTFResult;

    // Mounted consumers hold a reference so the shared cache never evicts
    // geometry, materials, or textures that are still on screen.
    useEffect(() => {
        trackGameGLTF(url, gltf);
        return getGameResourceCache().acquire(url, 'gltf');
    }, [gltf, url]);

    return useMemo(() => {
        configureGameGLTFColorPaletteMaterials(gltf);
        return gltf;
    }, [gltf]);
}
