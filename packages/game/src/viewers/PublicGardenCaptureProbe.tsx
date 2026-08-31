'use client';

import { useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Box3, OrthographicCamera, Vector3 } from 'three';
import {
    gardenPreviewHeight,
    gardenPreviewMaxSizeBytes,
    gardenPreviewRendererVersion,
    gardenPreviewWidth,
} from '../gardenPreview';

const minimumWarmupMs = 1500;
const minimumStableMs = 500;
const minimumStableFrames = 2;
const minimumFallbackFrames = 2;
const fallbackStabilityWaitMs = 5000;
const snapshotTimeoutMs = 45_000;
const encodeTimeoutMs = 30_000;
const maximumCaptureWaitMs = 30_000;
const webpQuality = 0.9;

export type PublicGardenCaptureOutput = {
    contentType?: 'image/png' | 'image/webp';
    height?: number;
    maxSizeBytes?: number;
    quality?: number;
    width?: number;
};

type PublicGardenCaptureProbeProps = {
    enabled: boolean;
    fitSceneObjectName?: string;
    fitScenePadding?: number;
    onCapture: (blob: Blob) => void;
    onError: (error: Error) => void;
    output?: PublicGardenCaptureOutput;
    queriesIdle: boolean;
};

type CaptureViewBounds = {
    bottom: number;
    left: number;
    right: number;
    top: number;
};

export function resolveCaptureCameraZoom({
    bounds,
    cameraHeight,
    cameraWidth,
    padding,
}: {
    bounds: CaptureViewBounds;
    cameraHeight: number;
    cameraWidth: number;
    padding: number;
}) {
    const halfWidth = Math.max(Math.abs(bounds.left), Math.abs(bounds.right));
    const halfHeight = Math.max(Math.abs(bounds.bottom), Math.abs(bounds.top));
    if (halfWidth <= 0 || halfHeight <= 0) {
        return null;
    }

    return Math.min(
        (cameraWidth * 0.5 * padding) / halfWidth,
        (cameraHeight * 0.5 * padding) / halfHeight,
    );
}

function viewBoundsSignature(bounds: CaptureViewBounds) {
    return [bounds.bottom, bounds.left, bounds.right, bounds.top]
        .map((value) => value.toFixed(3))
        .join('|');
}

type ResolvedCaptureOutput = {
    contentType: 'image/png' | 'image/webp';
    height: number;
    maxSizeBytes?: number;
    quality: number;
    width: number;
};

function resolveCaptureOutput(
    output: PublicGardenCaptureOutput | undefined,
): ResolvedCaptureOutput {
    return {
        contentType: output?.contentType ?? 'image/webp',
        height: output?.height ?? gardenPreviewHeight,
        maxSizeBytes: output ? output.maxSizeBytes : gardenPreviewMaxSizeBytes,
        quality: output?.quality ?? webpQuality,
        width: output?.width ?? gardenPreviewWidth,
    };
}

function toError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

function frameSignature({
    calls,
    geometries,
    points,
    textures,
    triangles,
}: {
    calls: number;
    geometries: number;
    points: number;
    textures: number;
    triangles: number;
}) {
    return `${calls}|${triangles}|${points}|${geometries}|${textures}`;
}

export type CaptureStabilityState = {
    eligibleSince: number | null;
    firstNonBlankAt: number | null;
    signature: string | null;
    stableFrames: number;
    stableSince: number | null;
    validFrames: number;
};

export function createCaptureStabilityState(): CaptureStabilityState {
    return {
        eligibleSince: null,
        firstNonBlankAt: null,
        signature: null,
        stableFrames: 0,
        stableSince: null,
        validFrames: 0,
    };
}

export function resetCaptureStabilityState(state: CaptureStabilityState) {
    state.eligibleSince = null;
    state.firstNonBlankAt = null;
    state.signature = null;
    state.stableFrames = 0;
    state.stableSince = null;
    state.validFrames = 0;
}

export function observeCaptureStability(
    state: CaptureStabilityState,
    {
        now,
        signature,
    }: {
        now: number;
        signature: string;
    },
) {
    state.eligibleSince ??= now;
    state.firstNonBlankAt ??= now;
    state.validFrames += 1;

    if (state.signature !== signature) {
        state.signature = signature;
        state.stableFrames = 1;
        state.stableSince = now;
    } else {
        state.stableFrames += 1;
        state.stableSince ??= now;
    }

    const warmupReady = now - state.eligibleSince >= minimumWarmupMs;
    const normalStabilityReady =
        state.stableFrames >= minimumStableFrames &&
        state.stableSince !== null &&
        now - state.stableSince >= minimumStableMs;
    const fallbackStabilityReady =
        state.validFrames >= minimumFallbackFrames &&
        now - state.firstNonBlankAt >= fallbackStabilityWaitMs;

    return warmupReady && (normalStabilityReady || fallbackStabilityReady);
}

export function getNextCaptureStabilityFrameDelay(
    state: CaptureStabilityState,
    now: number,
) {
    if (
        state.eligibleSince === null ||
        state.firstNonBlankAt === null ||
        state.stableSince === null
    ) {
        return 0;
    }

    const normalReadyAt = Math.max(
        state.eligibleSince + minimumWarmupMs,
        state.stableSince + minimumStableMs,
    );
    const fallbackReadyAt = Math.max(
        state.eligibleSince + minimumWarmupMs,
        state.firstNonBlankAt + fallbackStabilityWaitMs,
    );

    return Math.max(0, Math.min(normalReadyAt, fallbackReadyAt) - now);
}

function validateSourceCanvas(
    sourceCanvas: HTMLCanvasElement,
    output: ResolvedCaptureOutput,
) {
    if (
        sourceCanvas.width !== output.width ||
        sourceCanvas.height !== output.height
    ) {
        throw new Error(
            `Garden capture canvas has invalid dimensions ${sourceCanvas.width.toString()}x${sourceCanvas.height.toString()}; expected ${output.width.toString()}x${output.height.toString()}.`,
        );
    }
}

function validateEncodedBlob(blob: Blob, output: ResolvedCaptureOutput) {
    if (blob.type !== output.contentType) {
        throw new Error(
            `Garden capture encoder returned unsupported content type ${blob.type || 'unknown'} for ${gardenPreviewRendererVersion}.`,
        );
    }
    if (
        blob.size < 1 ||
        (output.maxSizeBytes !== undefined && blob.size > output.maxSizeBytes)
    ) {
        const maximumLabel = output.maxSizeBytes?.toString() ?? 'unlimited';
        throw new Error(
            `Garden capture size is outside the 1-${maximumLabel} byte range.`,
        );
    }
    return blob;
}

function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
) {
    return new Promise<T>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, timeoutMs);

        void promise.then(
            (value) => {
                window.clearTimeout(timeout);
                resolve(value);
            },
            (error: unknown) => {
                window.clearTimeout(timeout);
                reject(toError(error));
            },
        );
    });
}

function canvasElementToBlob(
    canvas: HTMLCanvasElement,
    output: ResolvedCaptureOutput,
) {
    return new Promise<Blob>((resolve, reject) => {
        try {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                        return;
                    }
                    reject(
                        new Error('Garden capture encoder returned no image.'),
                    );
                },
                output.contentType,
                output.quality,
            );
        } catch (error) {
            reject(toError(error));
        }
    });
}

function encodeWithHtmlCanvas(
    source: CanvasImageSource,
    output: ResolvedCaptureOutput,
) {
    const encodingCanvas = document.createElement('canvas');
    encodingCanvas.width = output.width;
    encodingCanvas.height = output.height;
    const context = encodingCanvas.getContext('2d');
    if (!context) {
        return Promise.reject(
            new Error('Garden preview encoder is unavailable.'),
        );
    }

    context.drawImage(source, 0, 0, output.width, output.height);
    return canvasElementToBlob(encodingCanvas, output);
}

class GardenPreviewSnapshotTimeoutError extends Error {}

function createSnapshot(sourceCanvas: HTMLCanvasElement) {
    const snapshotPromise = window.createImageBitmap(sourceCanvas);
    let timedOut = false;

    return new Promise<ImageBitmap>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            timedOut = true;
            reject(
                new GardenPreviewSnapshotTimeoutError(
                    'Garden preview snapshot timed out.',
                ),
            );
        }, snapshotTimeoutMs);

        void snapshotPromise.then(
            (bitmap) => {
                window.clearTimeout(timeout);
                if (timedOut) {
                    bitmap.close();
                    return;
                }
                resolve(bitmap);
            },
            (error: unknown) => {
                window.clearTimeout(timeout);
                if (!timedOut) {
                    reject(toError(error));
                }
            },
        );
    });
}

async function encodeCapture(
    sourceCanvas: HTMLCanvasElement,
    output: ResolvedCaptureOutput,
) {
    validateSourceCanvas(sourceCanvas, output);

    if (typeof window.createImageBitmap !== 'function') {
        const blob = await withTimeout(
            canvasElementToBlob(sourceCanvas, output),
            encodeTimeoutMs,
            'Garden capture encoding timed out.',
        );
        return validateEncodedBlob(blob, output);
    }

    let snapshot: ImageBitmap;
    try {
        snapshot = await createSnapshot(sourceCanvas);
    } catch (error) {
        if (error instanceof GardenPreviewSnapshotTimeoutError) {
            throw error;
        }
        const blob = await withTimeout(
            canvasElementToBlob(sourceCanvas, output),
            encodeTimeoutMs,
            'Garden capture encoding timed out.',
        );
        return validateEncodedBlob(blob, output);
    }

    try {
        if (typeof OffscreenCanvas !== 'undefined') {
            const encodingCanvas = new OffscreenCanvas(
                sourceCanvas.width,
                sourceCanvas.height,
            );
            const context = encodingCanvas.getContext('2d');
            if (context) {
                // The bitmap already contains the WebGL snapshot. The 2D copy
                // preserves that exact shader output without re-rendering the
                // scene.
                context.drawImage(snapshot, 0, 0);
                try {
                    const blob = await withTimeout(
                        encodingCanvas.convertToBlob({
                            quality: output.quality,
                            type: output.contentType,
                        }),
                        encodeTimeoutMs,
                        'Garden capture encoding timed out.',
                    );
                    return validateEncodedBlob(blob, output);
                } catch {
                    // Some browsers expose OffscreenCanvas without support for
                    // the requested encoder. Fall through to HTML canvas.
                }
            }
        }

        const blob = await withTimeout(
            encodeWithHtmlCanvas(snapshot, output),
            encodeTimeoutMs,
            'Garden capture encoding timed out.',
        );
        return validateEncodedBlob(blob, output);
    } finally {
        snapshot.close();
    }
}

export function PublicGardenCaptureProbe({
    enabled,
    fitSceneObjectName,
    fitScenePadding = 0.56,
    onCapture,
    onError,
    output,
    queriesIdle,
}: PublicGardenCaptureProbeProps) {
    const attemptedRef = useRef(false);
    const firstFrameRef = useRef<number | null>(null);
    const invalidationTimerRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    const nextStabilityFrameAtRef = useRef<number | null>(null);
    const secondFrameRef = useRef<number | null>(null);
    const stabilityRef = useRef(createCaptureStabilityState());
    const fitBoundsSignatureRef = useRef<string | null>(null);
    const fitBoxRef = useRef(new Box3());
    const fitPointRef = useRef(new Vector3());
    const onCaptureRef = useRef(onCapture);
    const onErrorRef = useRef(onError);
    const resolvedOutput = resolveCaptureOutput(output);
    const invalidate = useThree((state) => state.invalidate);

    useEffect(() => {
        onCaptureRef.current = onCapture;
        onErrorRef.current = onError;
    }, [onCapture, onError]);

    useEffect(() => {
        if (enabled && queriesIdle) {
            invalidate();
            return;
        }

        if (invalidationTimerRef.current !== null) {
            window.clearTimeout(invalidationTimerRef.current);
            invalidationTimerRef.current = null;
        }
        nextStabilityFrameAtRef.current = null;
        resetCaptureStabilityState(stabilityRef.current);
    }, [enabled, invalidate, queriesIdle]);

    useEffect(() => {
        mountedRef.current = true;
        const timeout = window.setTimeout(() => {
            if (!attemptedRef.current && mountedRef.current) {
                attemptedRef.current = true;
                onErrorRef.current(
                    new Error('Garden preview scene did not become ready.'),
                );
            }
        }, maximumCaptureWaitMs);
        return () => {
            mountedRef.current = false;
            window.clearTimeout(timeout);
            if (firstFrameRef.current !== null) {
                window.cancelAnimationFrame(firstFrameRef.current);
            }
            if (secondFrameRef.current !== null) {
                window.cancelAnimationFrame(secondFrameRef.current);
            }
            if (invalidationTimerRef.current !== null) {
                window.clearTimeout(invalidationTimerRef.current);
            }
        };
    }, []);

    useFrame(({ camera, gl, scene }) => {
        if (attemptedRef.current) {
            return;
        }

        const assetsLoading = useProgress.getState().active;
        const now = performance.now();
        const resetStability = () => {
            if (invalidationTimerRef.current !== null) {
                window.clearTimeout(invalidationTimerRef.current);
                invalidationTimerRef.current = null;
            }
            nextStabilityFrameAtRef.current = null;
            resetCaptureStabilityState(stabilityRef.current);
        };
        const keepHardGateFrameTrainAlive = () => {
            resetStability();
            invalidate();
        };
        if (!enabled || !queriesIdle) {
            resetStability();
            return;
        }

        // Public capture scenes render on demand. Keep immediate frames alive
        // while hard gates settle, then schedule valid frames at the next
        // readiness deadline so snapshot readback has less queued GPU work.
        if (assetsLoading) {
            keepHardGateFrameTrainAlive();
            return;
        }

        if (fitSceneObjectName && camera instanceof OrthographicCamera) {
            const target = scene.getObjectByName(fitSceneObjectName);
            if (!target) {
                keepHardGateFrameTrainAlive();
                return;
            }

            const box = fitBoxRef.current.setFromObject(target, true);
            if (box.isEmpty()) {
                keepHardGateFrameTrainAlive();
                return;
            }

            camera.updateMatrixWorld(true);
            const viewBounds = {
                bottom: Number.POSITIVE_INFINITY,
                left: Number.POSITIVE_INFINITY,
                right: Number.NEGATIVE_INFINITY,
                top: Number.NEGATIVE_INFINITY,
            };
            const point = fitPointRef.current;
            for (const x of [box.min.x, box.max.x]) {
                for (const y of [box.min.y, box.max.y]) {
                    for (const z of [box.min.z, box.max.z]) {
                        point
                            .set(x, y, z)
                            .applyMatrix4(camera.matrixWorldInverse);
                        viewBounds.left = Math.min(viewBounds.left, point.x);
                        viewBounds.right = Math.max(viewBounds.right, point.x);
                        viewBounds.bottom = Math.min(
                            viewBounds.bottom,
                            point.y,
                        );
                        viewBounds.top = Math.max(viewBounds.top, point.y);
                    }
                }
            }

            const fitSignature = viewBoundsSignature(viewBounds);
            if (fitBoundsSignatureRef.current !== fitSignature) {
                fitBoundsSignatureRef.current = fitSignature;
                const zoom = resolveCaptureCameraZoom({
                    bounds: viewBounds,
                    cameraHeight: camera.top - camera.bottom,
                    cameraWidth: camera.right - camera.left,
                    padding: fitScenePadding,
                });
                if (zoom !== null) {
                    camera.zoom = Math.max(24, Math.min(500, zoom));
                    camera.updateProjectionMatrix();
                }
                keepHardGateFrameTrainAlive();
                return;
            }
        }

        if (
            gl.info.render.calls < 1 ||
            gl.info.render.triangles < 1 ||
            gl.info.memory.geometries < 1
        ) {
            keepHardGateFrameTrainAlive();
            return;
        }
        const signature = frameSignature({
            calls: gl.info.render.calls,
            geometries: gl.info.memory.geometries,
            points: gl.info.render.points,
            textures: gl.info.memory.textures,
            triangles: gl.info.render.triangles,
        });
        const signatureChanged =
            stabilityRef.current.signature !== null &&
            stabilityRef.current.signature !== signature;
        if (
            nextStabilityFrameAtRef.current !== null &&
            now < nextStabilityFrameAtRef.current &&
            !signatureChanged
        ) {
            return;
        }
        nextStabilityFrameAtRef.current = null;
        if (
            !observeCaptureStability(stabilityRef.current, { now, signature })
        ) {
            if (invalidationTimerRef.current !== null) {
                window.clearTimeout(invalidationTimerRef.current);
            }
            const nextFrameDelay = getNextCaptureStabilityFrameDelay(
                stabilityRef.current,
                now,
            );
            invalidationTimerRef.current = window.setTimeout(() => {
                invalidationTimerRef.current = null;
                if (mountedRef.current && !attemptedRef.current) {
                    invalidate();
                }
            }, nextFrameDelay);
            nextStabilityFrameAtRef.current = now + nextFrameDelay;
            return;
        }

        if (invalidationTimerRef.current !== null) {
            window.clearTimeout(invalidationTimerRef.current);
            invalidationTimerRef.current = null;
        }
        attemptedRef.current = true;
        firstFrameRef.current = window.requestAnimationFrame(() => {
            firstFrameRef.current = null;
            if (!mountedRef.current) {
                return;
            }
            secondFrameRef.current = window.requestAnimationFrame(() => {
                secondFrameRef.current = null;
                if (!mountedRef.current) {
                    return;
                }
                void encodeCapture(gl.domElement, resolvedOutput)
                    .then((blob) => {
                        if (mountedRef.current) {
                            onCaptureRef.current(blob);
                        }
                    })
                    .catch((error) => {
                        if (mountedRef.current) {
                            onErrorRef.current(toError(error));
                        }
                    });
            });
        });
    });

    return null;
}
