import { createContext, useContext } from 'react';
import type { useBlockData } from '../hooks/useBlockData';

export type SceneBlockData = ReturnType<typeof useBlockData>['data'];

export const SceneBlockDataContext = createContext<{
    data: SceneBlockData;
} | null>(null);

export function useSceneBlockData() {
    const value = useContext(SceneBlockDataContext);
    if (value === null) {
        throw new Error('Missing SceneBlockDataBoundary in the tree');
    }
    return value.data;
}
