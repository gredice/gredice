import type { PropsWithChildren } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { SceneBlockDataProvider } from './SceneBlockDataProvider';

export function ConnectedSceneBlockDataProvider({
    children,
}: PropsWithChildren) {
    const { data } = useBlockData();
    return (
        <SceneBlockDataProvider data={data}>{children}</SceneBlockDataProvider>
    );
}
