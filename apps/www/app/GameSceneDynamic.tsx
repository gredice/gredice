'use client';

import { GardenLoadingIndicator } from '@gredice/game';
import dynamic from 'next/dynamic';

export const GameSceneDynamic = dynamic(() => import('@gredice/game').then(mod => mod.GameScene), {
    ssr: false,
    loading: () => <GardenLoadingIndicator />
});
