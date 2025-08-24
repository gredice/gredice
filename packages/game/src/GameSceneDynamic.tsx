'use client';

import dynamic from 'next/dynamic';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';

export const GameSceneDynamic = dynamic(
    () => import('./GameSceneWrapper').then((mod) => mod.GameSceneWrapper),
    {
        ssr: false,
        loading: () => <GardenLoadingIndicator />,
    },
);
