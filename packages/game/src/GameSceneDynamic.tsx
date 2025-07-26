'use client';

import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import dynamic from 'next/dynamic';

export const GameSceneDynamic = dynamic(() => import('./GameSceneWrapper').then(mod => mod.GameSceneWrapper), {
    ssr: false,
    loading: () => <GardenLoadingIndicator />
});
