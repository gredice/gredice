import { useGameState } from "../useGameState";
import { useGLTF } from '@react-three/drei';

export function useGameGLTF(url: string) {
    const appBaseUrl = useGameState(state => state.appBaseUrl);
    return useGLTF(appBaseUrl + url);
}
