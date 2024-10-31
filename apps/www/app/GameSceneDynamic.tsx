'use client';

import dynamic from 'next/dynamic';

export const GameSceneDynamic = dynamic(() => import('@gredice/game').then(mod => mod.GameScene), { ssr: false });
