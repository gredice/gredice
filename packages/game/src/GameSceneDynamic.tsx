'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { GameLoadingContext } from './GameLoadingContext';
import type { GameSceneProps } from './GameScene';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';

const GameSceneInner = dynamic(
    () => import('./GameSceneWrapper').then((mod) => mod.GameSceneWrapper),
    {
        ssr: false,
        loading: () => null,
    },
);

const INDICATOR_DELAY_MS = 200;

export function GameSceneDynamic(props: GameSceneProps) {
    const [isReady, setIsReady] = useState(false);
    const [showIndicator, setShowIndicator] = useState(false);

    useEffect(() => {
        if (isReady) {
            setShowIndicator(false);
            return;
        }
        const timeout = setTimeout(
            () => setShowIndicator(true),
            INDICATOR_DELAY_MS,
        );
        return () => clearTimeout(timeout);
    }, [isReady]);

    const contextValue = useMemo(() => ({ setIsReady }), []);

    return (
        <GameLoadingContext.Provider value={contextValue}>
            <GameSceneInner {...props} />
            {showIndicator && !isReady && <GardenLoadingIndicator />}
        </GameLoadingContext.Provider>
    );
}
