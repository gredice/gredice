import { useGLTF } from '@react-three/drei';
import { type GameAssetName, gameAssetModels } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { useGameState } from '../useGameState';

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
        useGLTF.preload(resolveGameAssetModelUrl(appBaseUrl, assetName));
    }
}

export function useGameGLTF(assetName: GameAssetName) {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    return useGLTF(
        resolveGameAssetModelUrl(appBaseUrl, assetName),
    ) as unknown as GLTFResult;
}
