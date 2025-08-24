import { useGLTF } from '@react-three/drei';
import { useGameState } from '../useGameState';

export function useGameGLTF(url: string) {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    return useGLTF(appBaseUrl + url);
}
