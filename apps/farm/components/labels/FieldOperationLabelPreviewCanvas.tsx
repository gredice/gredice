'use client';

import {
    DEFAULT_HARVEST_LABEL_PRESET,
    type FieldOperationLabelData,
    type FieldOperationLabelVersion,
    type HarvestLabelPreset,
    renderFieldOperationLabel,
    renderFieldOperationLabelV2,
} from '@gredice/label-printer';
import { type ComponentPropsWithoutRef, useEffect, useRef } from 'react';

interface FieldOperationLabelPreviewCanvasProps
    extends ComponentPropsWithoutRef<'canvas'> {
    labelData: FieldOperationLabelData;
    preset?: HarvestLabelPreset;
    version?: FieldOperationLabelVersion;
}

export function FieldOperationLabelPreviewCanvas({
    labelData,
    preset = DEFAULT_HARVEST_LABEL_PRESET,
    version = 'v1',
    ...canvasProps
}: FieldOperationLabelPreviewCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) {
            return;
        }

        if (version === 'v2') {
            renderFieldOperationLabelV2(canvasRef.current, labelData, preset);
            return;
        }

        renderFieldOperationLabel(canvasRef.current, labelData, preset);
    }, [labelData, preset, version]);

    return (
        <canvas
            ref={canvasRef}
            aria-label={`Pregled etikete ${version}: Gredica ${labelData.raisedBedPhysicalId}, polje ${labelData.fieldLabel}`}
            data-label-version={version}
            {...canvasProps}
        />
    );
}
