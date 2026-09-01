'use client';

import { type MouseEvent, type MouseEventHandler, useCallback } from 'react';
import {
    beginGardenStructurePointerResolution,
    recordGardenStructurePointerResolution,
} from '../scene/gameProfileMetadata';

export function useGardenStructurePointerProfileHandlers({
    enabled,
    onClick,
    onClickCapture,
}: Readonly<{
    enabled: boolean;
    onClick?: MouseEventHandler<HTMLDivElement>;
    onClickCapture?: MouseEventHandler<HTMLDivElement>;
}>) {
    const handleClickCapture = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            if (enabled && event.target instanceof HTMLCanvasElement) {
                beginGardenStructurePointerResolution(performance.now());
            }
            onClickCapture?.(event);
        },
        [enabled, onClickCapture],
    );
    const handleClick = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            onClick?.(event);
            if (enabled && event.target instanceof HTMLCanvasElement) {
                recordGardenStructurePointerResolution(performance.now());
            }
        },
        [enabled, onClick],
    );

    return { handleClick, handleClickCapture };
}
