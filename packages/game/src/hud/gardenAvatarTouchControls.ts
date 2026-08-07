'use client';

import { useEffect, useState } from 'react';

export function shouldShowGardenAvatarTouchControls({
    coarsePointer,
    hoverNone,
    maxTouchPoints,
}: {
    coarsePointer: boolean;
    hoverNone: boolean;
    maxTouchPoints: number;
}) {
    return maxTouchPoints > 0 && (coarsePointer || hoverNone);
}

function readTouchControlCapability() {
    return shouldShowGardenAvatarTouchControls({
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        hoverNone: window.matchMedia('(hover: none)').matches,
        maxTouchPoints: navigator.maxTouchPoints,
    });
}

export function useGardenAvatarTouchControls() {
    const [showTouchControls, setShowTouchControls] = useState(false);

    useEffect(() => {
        const coarsePointer = window.matchMedia('(pointer: coarse)');
        const hoverNone = window.matchMedia('(hover: none)');
        const refreshCapability = () => {
            setShowTouchControls(readTouchControlCapability());
        };
        const rememberTouchInput = (event: PointerEvent) => {
            if (event.pointerType === 'touch') {
                setShowTouchControls(true);
            }
        };

        refreshCapability();
        coarsePointer.addEventListener('change', refreshCapability);
        hoverNone.addEventListener('change', refreshCapability);
        window.addEventListener('pointerdown', rememberTouchInput, {
            passive: true,
        });

        return () => {
            coarsePointer.removeEventListener('change', refreshCapability);
            hoverNone.removeEventListener('change', refreshCapability);
            window.removeEventListener('pointerdown', rememberTouchInput);
        };
    }, []);

    return showTouchControls;
}
