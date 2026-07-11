'use client';

import type { GardenResponse } from '@gredice/client';
import type { PublicGardenViewerProps } from '@gredice/game';
import {
    gardenPreviewContentType,
    gardenPreviewHeight,
    gardenPreviewRendererVersion,
    gardenPreviewRendererVersionHeader,
    gardenPreviewSourceRevisionHeader,
    gardenPreviewWidth,
} from '@gredice/js/gardenPreviews';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { PublicGardenViewerDynamic } from './PublicGardenViewerDynamic';
import {
    PublicGardenPreviewBackfillHttpError,
    type PublicGardenPreviewBackfillSource,
    runSequentialPublicGardenPreviewBackfill,
} from './publicGardenPreviewBackfillQueue';

type BackfillGarden = NonNullable<PublicGardenViewerProps['garden']>;
type BackfillSource = PublicGardenPreviewBackfillSource<BackfillGarden>;
type ActiveCapture = BackfillSource & { key: string };
type PendingCapture = {
    abort: () => void;
    key: string;
    reject: (error: Error) => void;
    resolve: (blob: Blob) => void;
    timeout: number;
};

const gameAssetBaseUrl = 'https://vrt.gredice.com';
const captureTimeoutMs = 40_000;

function retryAfterMilliseconds(response: Response) {
    const retryAfter = response.headers.get('Retry-After');
    if (!retryAfter) {
        return undefined;
    }

    const seconds = Number.parseFloat(retryAfter);
    return Number.isFinite(seconds) && seconds >= 0
        ? seconds * 1000
        : undefined;
}

function gardenForCapture(garden: GardenResponse): BackfillGarden {
    return {
        backgroundPalette: garden.backgroundPalette,
        farmId: garden.farmId,
        homeCamera: garden.homeCamera,
        id: garden.id,
        isPublic: garden.isPublic,
        isSandbox: garden.isSandbox,
        latitude: garden.latitude,
        longitude: garden.longitude,
        name: garden.name,
        raisedBeds: garden.raisedBeds,
        stacks: garden.stacks,
        updatedAt: garden.updatedAt,
    };
}

async function loadGardenForBackfill(
    gardenId: number,
    signal: AbortSignal,
): Promise<BackfillSource> {
    const response = await fetch(
        `/api/gredice/api/gardens/${gardenId.toString()}`,
        {
            cache: 'no-store',
            credentials: 'include',
            signal,
        },
    );
    if (!response.ok) {
        throw new PublicGardenPreviewBackfillHttpError(response.status, 'load');
    }

    const garden: GardenResponse = await response.json();
    if (!garden.isPublic || !garden.previewSourceRevision) {
        throw new PublicGardenPreviewBackfillHttpError(409, 'load');
    }

    return {
        garden: gardenForCapture(garden),
        previewImage: garden.previewImage,
        sourceRevision: garden.previewSourceRevision,
    };
}

async function uploadGardenPreview(
    gardenId: number,
    sourceRevision: string,
    blob: Blob,
    signal: AbortSignal,
) {
    const response = await fetch(
        `/api/gredice/api/gardens/${gardenId.toString()}/preview`,
        {
            body: blob,
            credentials: 'include',
            headers: {
                'Content-Type': gardenPreviewContentType,
                [gardenPreviewRendererVersionHeader]:
                    gardenPreviewRendererVersion,
                [gardenPreviewSourceRevisionHeader]: sourceRevision,
            },
            method: 'PUT',
            signal,
        },
    );
    if (!response.ok) {
        throw new PublicGardenPreviewBackfillHttpError(
            response.status,
            'upload',
            retryAfterMilliseconds(response),
        );
    }
}

export function PublicGardenPreviewBackfill({
    gardenIds,
}: {
    gardenIds: number[];
}) {
    const router = useRouter();
    const { data: currentUser } = useCurrentUser();
    const [activeCapture, setActiveCapture] = useState<ActiveCapture | null>(
        null,
    );
    const pendingCaptureRef = useRef<PendingCapture | null>(null);
    const captureSequenceRef = useRef(0);
    const queueKey = useMemo(
        () => [...new Set(gardenIds)].join(','),
        [gardenIds],
    );
    const queuedGardenIds = useMemo(
        () =>
            queueKey
                .split(',')
                .filter(Boolean)
                .map((gardenId) => Number.parseInt(gardenId, 10)),
        [queueKey],
    );

    const clearPendingCapture = useCallback(
        (pending: PendingCapture, error?: Error) => {
            window.clearTimeout(pending.timeout);
            pending.abort();
            if (pendingCaptureRef.current?.key === pending.key) {
                pendingCaptureRef.current = null;
                setActiveCapture((current) =>
                    current?.key === pending.key ? null : current,
                );
            }
            if (error) {
                pending.reject(error);
            }
        },
        [],
    );

    const requestCapture = useCallback(
        (source: BackfillSource, signal: AbortSignal) =>
            new Promise<Blob>((resolve, reject) => {
                signal.throwIfAborted();
                captureSequenceRef.current += 1;
                const key = `${source.garden.id.toString()}:${source.sourceRevision}:${captureSequenceRef.current.toString()}`;
                const handleAbort = () => {
                    const pending = pendingCaptureRef.current;
                    if (pending?.key === key) {
                        clearPendingCapture(
                            pending,
                            new DOMException(
                                'Garden preview capture aborted.',
                                'AbortError',
                            ),
                        );
                    }
                };
                const timeout = window.setTimeout(() => {
                    const pending = pendingCaptureRef.current;
                    if (pending?.key === key) {
                        clearPendingCapture(
                            pending,
                            new Error('Garden preview capture timed out.'),
                        );
                    }
                }, captureTimeoutMs);
                const pending: PendingCapture = {
                    abort: () =>
                        signal.removeEventListener('abort', handleAbort),
                    key,
                    reject,
                    resolve,
                    timeout,
                };
                pendingCaptureRef.current = pending;
                signal.addEventListener('abort', handleAbort, { once: true });
                setActiveCapture({ ...source, key });
            }),
        [clearPendingCapture],
    );

    const handleCapture = useCallback(
        (blob: Blob) => {
            const pending = pendingCaptureRef.current;
            if (!pending) {
                return;
            }
            clearPendingCapture(pending);
            pending.resolve(blob);
        },
        [clearPendingCapture],
    );

    const handleCaptureError = useCallback(
        (error: Error) => {
            const pending = pendingCaptureRef.current;
            if (pending) {
                clearPendingCapture(pending, error);
            }
        },
        [clearPendingCapture],
    );

    useEffect(() => {
        if (currentUser?.role !== 'admin' || queuedGardenIds.length === 0) {
            return;
        }

        const abortController = new AbortController();
        let completedCount = 0;
        void runSequentialPublicGardenPreviewBackfill({
            captureGarden: requestCapture,
            gardenIds: queuedGardenIds,
            loadGarden: loadGardenForBackfill,
            onGardenError: (gardenId, error) => {
                console.error('Failed to backfill public garden preview', {
                    error,
                    gardenId,
                });
            },
            onGardenSuccess: () => {
                completedCount += 1;
            },
            signal: abortController.signal,
            uploadPreview: uploadGardenPreview,
        })
            .then(() => {
                if (!abortController.signal.aborted && completedCount > 0) {
                    router.refresh();
                }
            })
            .catch((error) => {
                if (!abortController.signal.aborted) {
                    console.error(
                        'Failed to run public garden preview backfill',
                        {
                            error,
                        },
                    );
                }
            });

        return () => {
            abortController.abort();
        };
    }, [currentUser?.role, queuedGardenIds, requestCapture, router]);

    if (!activeCapture) {
        return null;
    }

    return (
        <div
            aria-hidden
            data-public-garden-preview-backfill={activeCapture.key}
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
            <PublicGardenViewerDynamic
                key={activeCapture.key}
                appBaseUrl={gameAssetBaseUrl}
                capture={{
                    key: activeCapture.key,
                    onCapture: handleCapture,
                    onError: handleCaptureError,
                }}
                className="size-full"
                deferDetails={false}
                enableBlockGeometryMerging
                garden={activeCapture.garden}
                spriteBaseUrl={gameAssetBaseUrl}
            />
        </div>
    );
}
