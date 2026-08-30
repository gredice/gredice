'use client';

import { Canvas } from '@react-three/fiber';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { GardenStructureCatalogEntry } from '../src/structures/catalog/gardenStructureKitV1Catalog';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { GardenStructureKitV1CatalogSnapshotScene } from './GardenStructureKitV1CatalogSnapshotScene';
import { createGardenStructureKitV1CatalogSnapshot } from './gardenStructureKitV1CatalogSnapshot';

export function GardenStructureKitV1CatalogSnapshotViewer({
    entry,
    size,
}: Readonly<{
    entry: GardenStructureCatalogEntry;
    size: number;
}>) {
    const [ready, setReady] = useState(false);
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: '',
            freezeTime: null,
            isMock: true,
        });
    }
    useDisposeGameStateStore(storeRef.current);
    const snapshot = useMemo(
        () => createGardenStructureKitV1CatalogSnapshot(entry),
        [entry],
    );
    const markReady = useCallback(() => setReady(true), []);

    return (
        <div
            data-catalog-entry={entry.key}
            data-render-state={ready ? 'ready' : 'loading'}
            style={{ height: size, width: size }}
        >
            <GameStateContext.Provider value={storeRef.current}>
                <Canvas
                    camera={{
                        far: 100,
                        near: 0.1,
                        position: [4.8, 4.1, 5.7],
                        zoom: snapshot.zoom,
                    }}
                    dpr={1}
                    flat
                    frameloop="demand"
                    gl={{
                        alpha: false,
                        antialias: true,
                        preserveDrawingBuffer: true,
                    }}
                    orthographic
                    style={{ height: size, width: size }}
                >
                    <GardenStructureKitV1CatalogSnapshotScene
                        entry={entry}
                        onReady={markReady}
                    />
                </Canvas>
            </GameStateContext.Provider>
        </div>
    );
}
