'use client';

import { GameScene, type GameSceneProps } from '@gredice/game';
import { useMemo } from 'react';
import { restoreGameProfileDate } from '../profile/game/profileDate';

export function DebugGameScene({
    freezeTime,
    ...props
}: Omit<GameSceneProps, 'freezeTime'> & { freezeTime?: string }) {
    const date = useMemo(
        () => restoreGameProfileDate(freezeTime),
        [freezeTime],
    );
    return <GameScene {...props} freezeTime={date} />;
}
