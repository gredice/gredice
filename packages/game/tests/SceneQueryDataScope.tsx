import type { PropsWithChildren } from 'react';
import { ConnectedSceneBlockDataProvider } from '../src/scene/ConnectedSceneBlockDataProvider';
import type { SceneBlockData } from '../src/scene/SceneBlockDataContext';
import { SceneBlockDataProvider } from '../src/scene/SceneBlockDataProvider';
import type { SceneQueryDataMode } from './sceneQueryDataWitness';

export function SceneQueryDataScope({
    children,
    mode,
    data,
}: PropsWithChildren<{ mode: SceneQueryDataMode; data: SceneBlockData }>) {
    if (mode === 'owner') {
        return (
            <ConnectedSceneBlockDataProvider>
                {children}
            </ConnectedSceneBlockDataProvider>
        );
    }
    if (mode.startsWith('supplied')) {
        return (
            <SceneBlockDataProvider
                data={
                    mode === 'supplied-undefined'
                        ? undefined
                        : mode === 'supplied-null'
                          ? null
                          : data
                }
            >
                {children}
            </SceneBlockDataProvider>
        );
    }
    return children;
}
