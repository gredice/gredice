'use client';

import { useEffect, useState } from 'react';

const detailDelayMs = 250;

export function useDeferredSceneDetails(deferDetails = false) {
    const [renderDetails, setRenderDetails] = useState(!deferDetails);

    useEffect(() => {
        if (!deferDetails) {
            setRenderDetails(true);
            return;
        }

        setRenderDetails(false);

        let firstFrame = 0;
        let secondFrame = 0;
        let timeout: number | undefined;

        firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                timeout = window.setTimeout(() => {
                    setRenderDetails(true);
                }, detailDelayMs);
            });
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.cancelAnimationFrame(secondFrame);
            if (timeout !== undefined) {
                window.clearTimeout(timeout);
            }
        };
    }, [deferDetails]);

    return renderDetails;
}
