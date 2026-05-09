'use client';

import {
    DEFAULT_HARVEST_LABEL_PRESET,
    type HarvestLabelData,
    type HarvestLabelPreset,
    renderHarvestLabel,
} from '@gredice/label-printer';
import { type ComponentPropsWithoutRef, useEffect, useRef } from 'react';

interface HarvestLabelPreviewCanvasProps
    extends ComponentPropsWithoutRef<'canvas'> {
    labelData: HarvestLabelData;
    preset?: HarvestLabelPreset;
}

export function HarvestLabelPreviewCanvas({
    labelData,
    preset = DEFAULT_HARVEST_LABEL_PRESET,
    ...canvasProps
}: HarvestLabelPreviewCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) {
            return;
        }

        renderHarvestLabel(canvasRef.current, labelData, preset);
    }, [labelData, preset]);

    return <canvas ref={canvasRef} {...canvasProps} />;
}
