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
const encodeTimeoutMs = 10_000;
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

function withEncodeTimeout(promise: Promise<Blob>) {
    return new Promise<Blob>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            reject(new Error('Garden preview encoding timed out.'));
        }, encodeTimeoutMs);

        void promise.then(
            (blob) => {
                window.clearTimeout(timeout);
                resolve(blob);
            },
            (error: unknown) => {
                window.clearTimeout(timeout);
                reject(toError(error));
            },
        );
    });
}

function encodeWithHtmlCanvas(sourceCanvas: HTMLCanvasElement) {
    const encodingCanvas = document.createElement('canvas');
    encodingCanvas.width = sourceCanvas.width;
    encodingCanvas.height = sourceCanvas.height;
    const context = encodingCanvas.getContext('2d');
    if (!context) {
        throw new Error('Garden preview encoder is unavailable.');
    }

    context.drawImage(sourceCanvas, 0, 0);
    const dataUrl = encodingCanvas.toDataURL('image/webp', webpQuality);
    const prefix = 'data:image/webp;base64,';
    if (!dataUrl.startsWith(prefix)) {
        throw new Error(
            `Garden preview encoder returned unsupported content type for ${gardenPreviewRendererVersion}.`,
        );
    }

    const binary = window.atob(dataUrl.slice(prefix.length));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: 'image/webp' });
}

async function canvasToWebp(sourceCanvas: HTMLCanvasElement) {
    validateSourceCanvas(sourceCanvas);

    if (typeof OffscreenCanvas === 'undefined') {
        return validateEncodedBlob(encodeWithHtmlCanvas(sourceCanvas));
    }

    const encodingCanvas = new OffscreenCanvas(
        sourceCanvas.width,
        sourceCanvas.height,
    );
    const context = encodingCanvas.getContext('2d');
    if (!context) {
        return validateEncodedBlob(encodeWithHtmlCanvas(sourceCanvas));
    }

    // WebGL canvases cannot be encoded reliably across browsers. Copy the
    // preserved frame to a 2D canvas so the exact rendered scene, including
    // shader output, can be encoded without reimplementing the renderer.
    context.drawImage(sourceCanvas, 0, 0);
    try {
        const blob = await withEncodeTimeout(
            encodingCanvas.convertToBlob({
                quality: webpQuality,
                type: 'image/webp',
            }),
        );
        return validateEncodedBlob(blob);
    } catch {
        return validateEncodedBlob(encodeWithHtmlCanvas(sourceCanvas));
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
