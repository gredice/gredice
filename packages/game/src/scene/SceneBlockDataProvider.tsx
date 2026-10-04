import { type PropsWithChildren, useMemo } from 'react';
import {
    type SceneBlockData,
    SceneBlockDataContext,
} from './SceneBlockDataContext';

export function SceneBlockDataProvider({
    children,
    data,
}: PropsWithChildren<{ data: SceneBlockData }>) {
    const value = useMemo(() => ({ data }), [data]);
    return (
        <SceneBlockDataContext.Provider value={value}>
            {children}
        </SceneBlockDataContext.Provider>
    );
}
