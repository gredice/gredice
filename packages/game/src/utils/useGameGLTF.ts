import { useGLTF } from '@react-three/drei';
import { models } from '../data/models';
import type { GLTFResult } from '../models/GameAssets';
import { useGameState } from '../useGameState';

export function useGameGLTF() {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    return useGLTF(appBaseUrl + models.GameAssets.url) as unknown as GLTFResult;
}
