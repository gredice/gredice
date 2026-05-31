'use client';

import {
    DEFAULT_HARVEST_LABEL_PRESET,
    type FieldOperationLabelData,
    type HarvestLabelPreset,
    renderFieldOperationLabel,
} from '@gredice/label-printer';
import { type ComponentPropsWithoutRef, useEffect, useRef } from 'react';

interface FieldOperationLabelPreviewCanvasProps
    extends ComponentPropsWithoutRef<'canvas'> {
    labelData: FieldOperationLabelData;
    preset?: HarvestLabelPreset;
}

export function FieldOperationLabelPreviewCanvas({
    labelData,
    preset = DEFAULT_HARVEST_LABEL_PRESET,
    ...canvasProps
}: FieldOperationLabelPreviewCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) {
            return;
        }

        renderFieldOperationLabel(canvasRef.current, labelData, preset);
    }, [labelData, preset]);

    return <canvas ref={canvasRef} {...canvasProps} />;
}
