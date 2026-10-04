import { type PropsWithChildren, useContext } from 'react';
import { ConnectedSceneBlockDataProvider } from './ConnectedSceneBlockDataProvider';
import { SceneBlockDataContext } from './SceneBlockDataContext';

export function SceneBlockDataBoundary({ children }: PropsWithChildren) {
    const supplied = useContext(SceneBlockDataContext);
    return supplied === null ? (
        <ConnectedSceneBlockDataProvider>
            {children}
        </ConnectedSceneBlockDataProvider>
    ) : (
        children
    );
}
