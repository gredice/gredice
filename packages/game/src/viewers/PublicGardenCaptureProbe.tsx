'use client';

import { useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
    gardenPreviewHeight,
    gardenPreviewMaxSizeBytes,
    gardenPreviewRendererVersion,
    gardenPreviewWidth,
} from '../gardenPreview';

const minimumWarmupMs = 1500;
const minimumStableMs = 500;
const minimumStableFrames = 12;
const snapshotTimeoutMs = 45_000;
const encodeTimeoutMs = 30_000;
const maximumCaptureWaitMs = 30_000;
const webpQuality = 0.9;

type PublicGardenCaptureProbeProps = {
    enabled: boolean;
    onCapture: (blob: Blob) => void;
    onError: (error: Error) => void;
    queriesIdle: boolean;
};

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

function validateSourceCanvas(sourceCanvas: HTMLCanvasElement) {
    if (
        sourceCanvas.width !== gardenPreviewWidth ||
        sourceCanvas.height !== gardenPreviewHeight
    ) {
        throw new Error(
            `Garden preview canvas has invalid dimensions ${sourceCanvas.width.toString()}x${sourceCanvas.height.toString()}.`,
        );
    }
}

function validateEncodedBlob(blob: Blob) {
    if (blob.type !== 'image/webp') {
        throw new Error(
            `Garden preview encoder returned unsupported content type ${blob.type || 'unknown'} for ${gardenPreviewRendererVersion}.`,
        );
    }
    if (blob.size < 1 || blob.size > gardenPreviewMaxSizeBytes) {
        throw new Error(
            `Garden preview size is outside the 1-${gardenPreviewMaxSizeBytes.toString()} byte upload range.`,
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

function canvasElementToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
        try {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                        return;
                    }
                    reject(
                        new Error('Garden preview encoder returned no image.'),
                    );
                },
                'image/webp',
                webpQuality,
            );
        } catch (error) {
            reject(toError(error));
        }
    });
}

function encodeWithHtmlCanvas(
    source: CanvasImageSource,
    width: number,
    height: number,
) {
    const encodingCanvas = document.createElement('canvas');
    encodingCanvas.width = width;
    encodingCanvas.height = height;
    const context = encodingCanvas.getContext('2d');
    if (!context) {
        return Promise.reject(
            new Error('Garden preview encoder is unavailable.'),
        );
    }

    context.drawImage(source, 0, 0, width, height);
    return canvasElementToBlob(encodingCanvas);
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

async function canvasToWebp(sourceCanvas: HTMLCanvasElement) {
    validateSourceCanvas(sourceCanvas);

    if (typeof window.createImageBitmap !== 'function') {
        const blob = await withTimeout(
            canvasElementToBlob(sourceCanvas),
            encodeTimeoutMs,
            'Garden preview encoding timed out.',
        );
        return validateEncodedBlob(blob);
    }

    let snapshot: ImageBitmap;
    try {
        snapshot = await createSnapshot(sourceCanvas);
    } catch (error) {
        if (error instanceof GardenPreviewSnapshotTimeoutError) {
            throw error;
        }
        const blob = await withTimeout(
            canvasElementToBlob(sourceCanvas),
            encodeTimeoutMs,
            'Garden preview encoding timed out.',
        );
        return validateEncodedBlob(blob);
    }

    try {
        if (typeof OffscreenCanvas !== 'undefined') {
            const encodingCanvas = new OffscreenCanvas(
                sourceCanvas.width,
                sourceCanvas.height,
            );
            const context = encodingCanvas.getContext('2d');
            if (context) {
                // ImageBitmap moves the expensive WebGL readback off the main
                // thread. The 2D copy keeps the exact rendered frame, including
                // shader output, without reimplementing the renderer.
                context.drawImage(snapshot, 0, 0);
                try {
                    const blob = await withTimeout(
                        encodingCanvas.convertToBlob({
                            quality: webpQuality,
                            type: 'image/webp',
                        }),
                        encodeTimeoutMs,
                        'Garden preview encoding timed out.',
                    );
                    return validateEncodedBlob(blob);
                } catch {
                    // Some browsers expose OffscreenCanvas without WebP
                    // encoding support. Fall through to HTML canvas encoding.
                }
            }
        }

        const blob = await withTimeout(
            encodeWithHtmlCanvas(
                snapshot,
                sourceCanvas.width,
                sourceCanvas.height,
            ),
            encodeTimeoutMs,
            'Garden preview encoding timed out.',
        );
        return validateEncodedBlob(blob);
    } finally {
        snapshot.close();
    }
}

export function PublicGardenCaptureProbe({
    enabled,
    onCapture,
    onError,
    queriesIdle,
}: PublicGardenCaptureProbeProps) {
    const gl = useThree((state) => state.gl);
    const assetsLoading = useProgress((state) => state.active);
    const attemptedRef = useRef(false);
    const eligibleSinceRef = useRef<number | null>(null);
    const firstFrameRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    const secondFrameRef = useRef<number | null>(null);
    const stableFramesRef = useRef(0);
    const stableSinceRef = useRef<number | null>(null);
    const signatureRef = useRef<string | null>(null);
    const onCaptureRef = useRef(onCapture);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onCaptureRef.current = onCapture;
        onErrorRef.current = onError;
    }, [onCapture, onError]);

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
        };
    }, []);

    useFrame(() => {
        if (attemptedRef.current) {
            return;
        }

        const now = performance.now();
        if (!enabled || !queriesIdle || assetsLoading) {
            eligibleSinceRef.current = null;
            stableFramesRef.current = 0;
            stableSinceRef.current = null;
            signatureRef.current = null;
            return;
        }

        eligibleSinceRef.current ??= now;
        if (
            gl.info.render.calls < 1 ||
            gl.info.render.triangles < 1 ||
            gl.info.memory.geometries < 1
        ) {
            stableFramesRef.current = 0;
            stableSinceRef.current = null;
            signatureRef.current = null;
            return;
        }
        const signature = frameSignature({
            calls: gl.info.render.calls,
            geometries: gl.info.memory.geometries,
            points: gl.info.render.points,
            textures: gl.info.memory.textures,
            triangles: gl.info.render.triangles,
        });
        if (signatureRef.current !== signature) {
            signatureRef.current = signature;
            stableFramesRef.current = 0;
            stableSinceRef.current = now;
            return;
        }

        stableFramesRef.current += 1;
        stableSinceRef.current ??= now;
        if (
            now - eligibleSinceRef.current < minimumWarmupMs ||
            now - stableSinceRef.current < minimumStableMs ||
            stableFramesRef.current < minimumStableFrames
        ) {
            return;
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
                void canvasToWebp(gl.domElement)
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
