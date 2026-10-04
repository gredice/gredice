'use client';

import dynamic from 'next/dynamic';

const DebugHud = dynamic(
    () => import('./DebugHud').then((module) => module.DebugHud),
    {
        ssr: false,
    },
);

export function DebugHudDynamic() {
    return <DebugHud />;
}
