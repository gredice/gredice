'use client';

import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useCallback, useState } from 'react';
import {
    type PublicGardenDetail,
    PublicGardenViewer,
} from '../../../packages/game/src/viewers/PublicGardenViewer';

const capturedAt = '2026-07-11T10:00:00.000Z';
const raisedBedId = 8_101;

const captureGarden = {
    backgroundPalette: 'current',
    farmId: 1,
    homeCamera: {
        position: [-97, 100, -98] as [number, number, number],
        target: [3, 0, 2] as [number, number, number],
        zoom: 160,
    },
    id: 8_001,
    isPublic: true,
    isSandbox: false,
    latitude: 45.815,
    longitude: 15.982,
    name: 'Vrt za provjeru 3D pregleda',
    raisedBeds: [
        {
            id: raisedBedId,
            name: 'Gredica u spremljenom središtu',
            physicalId: null,
            blockId: 'raised-bed-focused',
            status: 'active',
            weedState: null,
            abandonReason: null,
            orientation: 'vertical',
            fields: [
                {
                    id: 8_201,
                    raisedBedId,
                    positionIndex: 4,
                    createdAt: capturedAt,
                    updatedAt: capturedAt,
                    isDeleted: false,
                    plantCycles: [],
                    plantStatus: 'sprouted',
                    plantSortId: 337,
                    plantScheduledDate: undefined,
                    sowingLocation: 'direct',
                    plantSowDate: '2026-05-01T08:00:00.000Z',
                    plantGrowthDate: '2026-05-12T08:00:00.000Z',
                    plantReadyDate: undefined,
                    plantDeadDate: undefined,
                    plantHarvestedDate: undefined,
                    plantRemovedDate: undefined,
                    active: true,
                    toBeRemoved: false,
                    stoppedDate: undefined,
                    cancellationReason: undefined,
                    weedState: null,
                },
            ],
            appliedOperations: [
                {
                    id: 8_301,
                    entityId: 701,
                    raisedBedId,
                    raisedBedFieldId: null,
                    status: 'completed',
                    createdAt: '2026-06-01T08:00:00.000Z',
                    completedAt: '2026-06-01T09:00:00.000Z',
                    scheduledDate: '2026-06-01T08:00:00.000Z',
                },
            ],
            createdAt: capturedAt,
            updatedAt: capturedAt,
            isValid: true,
        },
    ],
    stacks: {
        '0': {
            '0': [
                { id: 'grass-0-0', name: 'Block_Grass', rotation: 0 },
                { id: 'water-0-0', name: 'Block_Water', rotation: 0 },
            ],
            '1': [{ id: 'grass-0-1', name: 'Block_Grass', rotation: 0 }],
            '2': [{ id: 'grass-0-2', name: 'Block_Grass', rotation: 0 }],
        },
        '1': {
            '0': [{ id: 'grass-1-0', name: 'Block_Grass', rotation: 0 }],
            '1': [{ id: 'grass-1-1', name: 'Block_Grass', rotation: 0 }],
            '2': [{ id: 'grass-1-2', name: 'Block_Grass', rotation: 0 }],
        },
        '2': {
            '0': [{ id: 'grass-2-0', name: 'Block_Grass', rotation: 0 }],
            '1': [{ id: 'grass-2-1', name: 'Block_Grass', rotation: 0 }],
            '2': [{ id: 'grass-2-2', name: 'Block_Grass', rotation: 0 }],
        },
        '3': {
            '0': [{ id: 'grass-3-0', name: 'Block_Grass', rotation: 0 }],
            '1': [{ id: 'grass-3-1', name: 'Block_Grass', rotation: 0 }],
            '2': [
                { id: 'grass-3-2', name: 'Block_Grass', rotation: 0 },
                {
                    id: 'raised-bed-focused',
                    name: 'Raised_Bed',
                    rotation: 0,
                },
            ],
        },
    },
    updatedAt: capturedAt,
} satisfies PublicGardenDetail;

type CaptureResult = {
    count: number;
    error?: string;
    height?: number;
    nonTransparentPixels?: number;
    size?: number;
    status: 'captured' | 'decoding' | 'error' | 'waiting';
    type?: string;
    uniqueColorCount?: number;
    width?: number;
};

async function inspectCapturedPreview(blob: Blob) {
    const bitmap = await createImageBitmap(blob);
    try {
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 60;
        sampleCanvas.height = 32;
        const context = sampleCanvas.getContext('2d', {
            willReadFrequently: true,
        });
        if (!context) {
            throw new Error('Preview pixel sampler is unavailable.');
        }

        context.drawImage(
            bitmap,
            0,
            0,
            sampleCanvas.width,
            sampleCanvas.height,
        );
        const pixels = context.getImageData(
            0,
            0,
            sampleCanvas.width,
            sampleCanvas.height,
        ).data;
        const colors = new Set<string>();
        let nonTransparentPixels = 0;

        for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3] ?? 0;
            if (alpha === 0) {
                continue;
            }

            nonTransparentPixels += 1;
            const red = Math.floor((pixels[index] ?? 0) / 16);
            const green = Math.floor((pixels[index + 1] ?? 0) / 16);
            const blue = Math.floor((pixels[index + 2] ?? 0) / 16);
            colors.add(
                `${red.toString(16)}${green.toString(16)}${blue.toString(16)}`,
            );
        }

        return {
            height: bitmap.height,
            nonTransparentPixels,
            size: blob.size,
            type: blob.type,
            uniqueColorCount: colors.size,
            width: bitmap.width,
        };
    } finally {
        bitmap.close();
    }
}

export function GardenPreviewCaptureStory() {
    const [result, setResult] = useState<CaptureResult>({
        count: 0,
        status: 'waiting',
    });
    const handleCapture = useCallback((blob: Blob) => {
        setResult((current) => ({
            ...current,
            count: current.count + 1,
            status: 'decoding',
        }));
        void inspectCapturedPreview(blob)
            .then((preview) => {
                setResult((current) => ({
                    ...current,
                    ...preview,
                    status: 'captured',
                }));
            })
            .catch((error) => {
                setResult((current) => ({
                    ...current,
                    error:
                        error instanceof Error ? error.message : String(error),
                    status: 'error',
                }));
            });
    }, []);
    const handleError = useCallback((error: Error) => {
        setResult((current) => ({
            ...current,
            error: error.message,
            status: 'error',
        }));
    }, []);
    const assetBaseUrl =
        typeof window === 'undefined' ? '' : window.location.origin;

    return (
        <NuqsTestingAdapter searchParams="vrt=8001">
            <output data-testid="garden-preview-capture-result">
                {JSON.stringify(result)}
            </output>
            <div
                aria-hidden
                style={{
                    height: 630,
                    left: -20_000,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    position: 'fixed',
                    top: 0,
                    width: 1200,
                    zIndex: -1,
                }}
            >
                <PublicGardenViewer
                    appBaseUrl={assetBaseUrl}
                    capture={{
                        key: 'playwright-real-capture',
                        onCapture: handleCapture,
                        onError: handleError,
                    }}
                    className="size-full"
                    deferDetails={false}
                    enableBlockGeometryMerging
                    garden={captureGarden}
                    spriteBaseUrl={assetBaseUrl}
                />
            </div>
        </NuqsTestingAdapter>
    );
}
