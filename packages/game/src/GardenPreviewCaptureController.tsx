'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    gardenPreviewHeight,
    gardenPreviewWidth,
    getGardenPreviewCaptureDelayMs,
    getGardenPreviewUploadHeaders,
    getGardenPreviewUploadUrl,
    shouldCaptureGardenPreview,
} from './gardenPreview';
import type { CurrentGarden } from './hooks/useCurrentGarden';
import { useGardensKeys } from './hooks/useGardens';
import { useGameState } from './useGameState';
import {
    type PublicGardenDetail,
    PublicGardenViewer,
} from './viewers/PublicGardenViewer';

type GardenPreviewCaptureControllerProps = {
    enabled: boolean;
    garden: CurrentGarden | null | undefined;
};

const idleCaptureTimeoutMs = 2500;
const idleCaptureFallbackMs = 750;
const retryBackoffMs = 1250;
const maximumRetryCount = 1;

class GardenPreviewUploadError extends Error {
    readonly retryAfterMs: number;
    readonly retryable: boolean;

    constructor(status: number, retryAfterHeader: string | null) {
        super(`Garden preview upload failed with status ${status.toString()}.`);
        this.name = 'GardenPreviewUploadError';
        const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? '', 10);
        this.retryAfterMs = Number.isFinite(retryAfterSeconds)
            ? Math.max(0, retryAfterSeconds * 1000)
            : 0;
        this.retryable =
            status === 408 || status === 425 || status === 429 || status >= 500;
    }
}

function publicGardenStacksFromCurrentGarden(
    stacks: CurrentGarden['stacks'],
): PublicGardenDetail['stacks'] {
    const result: Record<
        string,
        Record<string, CurrentGarden['stacks'][number]['blocks']>
    > = {};

    for (const stack of stacks) {
        const x = stack.position.x.toString();
        const y = stack.position.z.toString();
        const rows = result[x] ?? {};
        rows[y] = stack.blocks;
        result[x] = rows;
    }

    return result;
}

function publicGardenDetailFromCurrentGarden(
    garden: CurrentGarden,
    sourceRevision: string,
): PublicGardenDetail | null {
    if (garden.farmId == null) {
        return null;
    }

    return {
        backgroundPalette: garden.backgroundPalette,
        farmId: garden.farmId,
        homeCamera: garden.homeCamera,
        id: garden.id,
        isPublic: garden.isPublic,
        isSandbox: garden.isSandbox,
        latitude: garden.location.lat,
        longitude: garden.location.lon,
        name: garden.name,
        raisedBeds: garden.raisedBeds,
        stacks: publicGardenStacksFromCurrentGarden(garden.stacks),
        updatedAt: sourceRevision,
    };
}

async function uploadGardenPreview({
    blob,
    gardenId,
    sourceRevision,
}: {
    blob: Blob;
    gardenId: number;
    sourceRevision: string;
}) {
    const response = await fetch(getGardenPreviewUploadUrl(gardenId), {
        method: 'PUT',
        body: blob,
        credentials: 'include',
        headers: getGardenPreviewUploadHeaders(sourceRevision),
    });

    if (!response.ok) {
        throw new GardenPreviewUploadError(
            response.status,
            response.headers.get('Retry-After'),
        );
    }
}

async function uploadGardenPreviewWithRetry(
    input: Parameters<typeof uploadGardenPreview>[0],
) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maximumRetryCount; attempt += 1) {
        try {
            await uploadGardenPreview(input);
            return;
        } catch (error) {
            lastError = error;
            const retryable =
                !(error instanceof GardenPreviewUploadError) || error.retryable;
            if (retryable && attempt < maximumRetryCount) {
                const retryDelay =
                    error instanceof GardenPreviewUploadError
                        ? Math.max(retryBackoffMs, error.retryAfterMs)
                        : retryBackoffMs;
                await new Promise((resolve) =>
                    window.setTimeout(resolve, retryDelay),
                );
                continue;
            }

            break;
        }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function GardenPreviewCaptureController({
    enabled,
    garden,
}: GardenPreviewCaptureControllerProps) {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const spriteBaseUrl = useGameState((state) => state.spriteBaseUrl);
    const queryClient = useQueryClient();
    const [captureFailure, setCaptureFailure] = useState<{
        count: number;
        key: string;
    } | null>(null);
    const [idleReadyKey, setIdleReadyKey] = useState<string | null>(null);
    const [terminalKey, setTerminalKey] = useState<string | null>(null);
    const sourceRevision = garden?.previewSourceRevision ?? null;
    const captureKey =
        garden && sourceRevision
            ? `${garden.id.toString()}:${sourceRevision}`
            : null;
    const captureAttempt =
        captureFailure?.key === captureKey ? captureFailure.count : 0;
    const captureDelayMs = getGardenPreviewCaptureDelayMs({
        previewImage: garden?.previewImage,
        sourceRevision,
    });
    const captureNeeded = Boolean(
        garden &&
            captureKey &&
            captureKey !== terminalKey &&
            shouldCaptureGardenPreview({
                enabled,
                isPublic: garden.isPublic,
                previewImage: garden.previewImage,
                sourceRevision,
            }),
    );
    const captureRequestKey =
        captureNeeded && captureKey
            ? `${captureKey}:${captureAttempt.toString()}`
            : null;

    useEffect(() => {
        setIdleReadyKey(null);
        if (!captureRequestKey) {
            return;
        }

        let idleCallbackId: number | null = null;
        let fallbackTimeoutId: number | null = null;
        let retryTimeoutId: number | null = null;
        let cancelled = false;
        const markReady = () => {
            if (!cancelled) {
                setIdleReadyKey(captureRequestKey);
            }
        };
        const scheduleIdle = () => {
            if (typeof window.requestIdleCallback === 'function') {
                idleCallbackId = window.requestIdleCallback(markReady, {
                    timeout: idleCaptureTimeoutMs,
                });
                return;
            }

            fallbackTimeoutId = window.setTimeout(
                markReady,
                idleCaptureFallbackMs,
            );
        };

        retryTimeoutId = window.setTimeout(
            scheduleIdle,
            captureAttempt > 0 ? retryBackoffMs : captureDelayMs,
        );

        return () => {
            cancelled = true;
            if (idleCallbackId !== null) {
                window.cancelIdleCallback(idleCallbackId);
            }
            if (fallbackTimeoutId !== null) {
                window.clearTimeout(fallbackTimeoutId);
            }
            if (retryTimeoutId !== null) {
                window.clearTimeout(retryTimeoutId);
            }
        };
    }, [captureAttempt, captureDelayMs, captureRequestKey]);

    const captureGarden = useMemo(
        () =>
            garden &&
            sourceRevision &&
            captureNeeded &&
            idleReadyKey === captureRequestKey
                ? publicGardenDetailFromCurrentGarden(garden, sourceRevision)
                : null,
        [
            captureNeeded,
            captureRequestKey,
            garden,
            idleReadyKey,
            sourceRevision,
        ],
    );

    const markTerminal = useCallback(() => {
        if (captureKey) {
            setTerminalKey(captureKey);
        }
    }, [captureKey]);

    const handleCaptureError = useCallback(
        (error: Error) => {
            if (!captureKey || !garden) {
                return;
            }

            console.error('Failed to capture garden preview', {
                error,
                gardenId: garden.id,
            });
            if (captureAttempt < maximumRetryCount) {
                setCaptureFailure({
                    count: captureAttempt + 1,
                    key: captureKey,
                });
                return;
            }

            markTerminal();
        },
        [captureAttempt, captureKey, garden, markTerminal],
    );

    const handleCapture = useCallback(
        (blob: Blob) => {
            if (!garden || !sourceRevision) {
                return;
            }

            markTerminal();
            void uploadGardenPreviewWithRetry({
                blob,
                gardenId: garden.id,
                sourceRevision,
            })
                .then(() => {
                    void queryClient.invalidateQueries({
                        queryKey: useGardensKeys,
                    });
                })
                .catch((error) => {
                    console.error('Failed to upload garden preview', {
                        error,
                        gardenId: garden.id,
                    });
                    void queryClient.invalidateQueries({
                        queryKey: useGardensKeys,
                    });
                });
        },
        [garden, markTerminal, queryClient, sourceRevision],
    );

    if (!captureGarden || !captureRequestKey) {
        return null;
    }

    return (
        <div
            aria-hidden
            data-garden-preview-capture={captureRequestKey}
            style={{
                height: gardenPreviewHeight,
                left: -20_000,
                overflow: 'hidden',
                pointerEvents: 'none',
                position: 'fixed',
                top: 0,
                width: gardenPreviewWidth,
                zIndex: -1,
            }}
        >
            <PublicGardenViewer
                appBaseUrl={appBaseUrl}
                capture={{
                    key: captureRequestKey,
                    onCapture: handleCapture,
                    onError: handleCaptureError,
                }}
                className="size-full"
                deferDetails={false}
                enableBlockGeometryMerging
                garden={captureGarden}
                spriteBaseUrl={spriteBaseUrl}
            />
        </div>
    );
}
