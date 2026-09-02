'use client';

import { clientAuthenticated, type GardenResponse } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { ButtonGroup, buttonGroupItemClassName } from '@gredice/ui/ButtonGroup';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Desktop, Laptop, Mobile, Navigate, Warning } from '@gredice/ui/icons';
import { Logotype } from '@gredice/ui/PublicChrome';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { Typography } from '@gredice/ui/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InlineLoginDialog } from '../../components/auth/InlineLoginDialog';
import {
    currentUserQueryKey,
    useCurrentUser,
} from '../../hooks/useCurrentUser';
import { KnownPages } from '../../src/KnownPages';
import {
    WallpaperCaptureRenderer,
    type WallpaperCaptureRequest,
} from './WallpaperCaptureRenderer';
import {
    composeWallpaper,
    getWallpaperCaptureSize,
    getWallpaperPreviewSize,
    type WallpaperBranding,
    type WallpaperPhase,
    type WallpaperSizeKey,
    type WallpaperTemplate,
    type WallpaperTheme,
    wallpaperFileName,
    wallpaperPhaseLabels,
    wallpaperSizes,
} from './wallpaperComposer';

type PendingCapture = {
    reject: (error: Error) => void;
    resolve: (blob: Blob) => void;
};

type WallpaperActivity = 'download' | 'idle' | 'macos' | 'preview';

const wallpaperTemplate: WallpaperTemplate = 'standard';
const wallpaperTheme: WallpaperTheme = 'grass';
const wallpaperPhases = [
    'morning',
    'day',
    'evening',
    'night',
] satisfies WallpaperPhase[];
const wallpaperSizeKeys = [
    'uhd',
    'fullHd',
    'ultrawide',
    'tablet',
    'mobile',
] satisfies WallpaperSizeKey[];

function captureErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Pozadina se nije mogla izraditi. Pokušaj ponovno.';
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function wallpaperDownloadError(response: Response) {
    const fallback =
        'Dinamička HEIC pozadina nije se mogla izraditi. Pokušaj ponovno.';
    try {
        const body: unknown = await response.json();
        if (
            typeof body === 'object' &&
            body !== null &&
            'error' in body &&
            typeof body.error === 'string'
        ) {
            return body.error;
        }
    } catch {
        return fallback;
    }
    return fallback;
}

function macOSDynamicWallpaperResponse(body: unknown) {
    if (
        typeof body !== 'object' ||
        body === null ||
        !('downloadUrl' in body) ||
        typeof body.downloadUrl !== 'string' ||
        !('fileName' in body) ||
        typeof body.fileName !== 'string' ||
        !('pathname' in body) ||
        typeof body.pathname !== 'string' ||
        !body.pathname.startsWith('wallpapers/macos-dynamic/output/') ||
        !body.pathname.endsWith('.bin')
    ) {
        return null;
    }

    try {
        const url = new URL(body.downloadUrl);
        if (
            url.protocol !== 'https:' ||
            !url.hostname.endsWith('.blob.vercel-storage.com')
        ) {
            return null;
        }
    } catch {
        return null;
    }
    return {
        downloadUrl: body.downloadUrl,
        fileName: body.fileName,
        pathname: body.pathname,
    };
}

export function WallpaperStudio() {
    const queryClient = useQueryClient();
    const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
    const [showLogin, setShowLogin] = useState(false);
    const [selectedGardenId, setSelectedGardenId] = useState<number | null>(
        null,
    );
    const [phase, setPhase] = useState<WallpaperPhase>('day');
    const [sizeKey, setSizeKey] = useState<WallpaperSizeKey>('ultrawide');
    const [branding, setBranding] = useState<WallpaperBranding>('gredice');
    const [activity, setActivity] = useState<WallpaperActivity>('idle');
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [captureRequest, setCaptureRequest] =
        useState<WallpaperCaptureRequest | null>(null);
    const pendingCaptureRef = useRef<PendingCapture | null>(null);
    const captureSequenceRef = useRef(0);
    const previewConfigurationKey = [
        branding,
        phase,
        selectedGardenId?.toString() ?? 'none',
        sizeKey,
    ].join(':');

    const gardensQuery = useQuery({
        queryKey: ['wallpapers', 'gardens', currentUser?.id ?? null],
        queryFn: async () => {
            const response = await clientAuthenticated().api.gardens.$get();
            if (response.status === 401) {
                queryClient.setQueryData(currentUserQueryKey, null);
                throw new Error('Prijava je istekla. Prijavi se ponovno.');
            }
            if (!response.ok) {
                throw new Error('Tvoji vrtovi trenutačno nisu dostupni.');
            }
            return response.json();
        },
        enabled: Boolean(currentUser),
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    const gardenQuery = useQuery({
        queryKey: [
            'wallpapers',
            'garden',
            currentUser?.id ?? null,
            selectedGardenId,
        ],
        queryFn: async () => {
            if (selectedGardenId === null) {
                return null;
            }
            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].$get({
                param: { gardenId: selectedGardenId.toString() },
            });
            if (response.status === 401) {
                queryClient.setQueryData(currentUserQueryKey, null);
                throw new Error('Prijava je istekla. Prijavi se ponovno.');
            }
            if (!response.ok) {
                throw new Error('Odabrani vrt nije moguće učitati.');
            }
            return response.json();
        },
        enabled: Boolean(currentUser && selectedGardenId !== null),
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        const gardens = gardensQuery.data;
        if (!gardens?.length) {
            return;
        }

        const selectedExists = gardens.some(
            (garden) => garden.id === selectedGardenId,
        );
        if (!selectedExists) {
            setSelectedGardenId(gardens[0]?.id ?? null);
        }
    }, [gardensQuery.data, selectedGardenId]);

    useEffect(() => {
        if (!previewConfigurationKey) {
            return;
        }
        setPreviewUrl(null);
        setError(null);
    }, [previewConfigurationKey]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    useEffect(() => {
        return () => {
            pendingCaptureRef.current?.reject(
                new Error('Izrada pozadine je prekinuta.'),
            );
            pendingCaptureRef.current = null;
        };
    }, []);

    const requestSceneCapture = useCallback(
        ({
            garden,
            height,
            phase: capturePhase,
            width,
        }: {
            garden: GardenResponse;
            height: number;
            phase: WallpaperPhase;
            width: number;
        }) => {
            if (pendingCaptureRef.current) {
                return Promise.reject(
                    new Error('Prethodna pozadina još se izrađuje.'),
                );
            }

            captureSequenceRef.current += 1;
            const key = [
                garden.id.toString(),
                wallpaperTemplate,
                wallpaperTheme,
                capturePhase,
                width.toString(),
                height.toString(),
                captureSequenceRef.current.toString(),
            ].join(':');

            return new Promise<Blob>((resolve, reject) => {
                pendingCaptureRef.current = { reject, resolve };
                setCaptureRequest({
                    garden,
                    height,
                    key,
                    phase: capturePhase,
                    transparent: false,
                    width,
                });
            });
        },
        [],
    );

    const handleSceneCapture = useCallback((blob: Blob) => {
        const pending = pendingCaptureRef.current;
        pendingCaptureRef.current = null;
        setCaptureRequest(null);
        pending?.resolve(blob);
    }, []);

    const handleSceneError = useCallback((captureError: Error) => {
        const pending = pendingCaptureRef.current;
        pendingCaptureRef.current = null;
        setCaptureRequest(null);
        pending?.reject(captureError);
    }, []);

    const createWallpaper = useCallback(
        async ({
            height,
            phase: wallpaperPhase = phase,
            width,
        }: {
            height: number;
            phase?: WallpaperPhase;
            width: number;
        }) => {
            const garden = gardenQuery.data;
            if (!garden) {
                throw new Error('Najprije odaberi vrt.');
            }

            const captureSize = getWallpaperCaptureSize({ height, width });
            const scene = await requestSceneCapture({
                garden,
                ...captureSize,
                phase: wallpaperPhase,
            });
            return composeWallpaper({
                branding,
                height,
                phase: wallpaperPhase,
                scene,
                template: wallpaperTemplate,
                theme: wallpaperTheme,
                width,
            });
        },
        [branding, gardenQuery.data, phase, requestSceneCapture],
    );

    const handlePreview = useCallback(async () => {
        setActivity('preview');
        setError(null);
        try {
            const previewSize = getWallpaperPreviewSize(sizeKey);
            const blob = await createWallpaper(previewSize);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (previewError) {
            setError(captureErrorMessage(previewError));
        } finally {
            setActivity('idle');
        }
    }, [createWallpaper, sizeKey]);

    useEffect(() => {
        if (!gardenQuery.data) {
            return;
        }
        void handlePreview();
    }, [gardenQuery.data, handlePreview]);

    async function handleDownload() {
        setActivity('download');
        setError(null);
        try {
            const size = wallpaperSizes[sizeKey];
            const blob = await createWallpaper(size);
            downloadBlob(
                blob,
                wallpaperFileName({
                    branding,
                    phase,
                    size: sizeKey,
                    template: wallpaperTemplate,
                }),
            );
        } catch (downloadError) {
            setError(captureErrorMessage(downloadError));
        } finally {
            setActivity('idle');
        }
    }

    async function handleMacOSDynamicDownload() {
        setActivity('macos');
        setError(null);
        let cleanupRequest: Record<string, string | number> | null = null;
        try {
            if (sizeKey === 'tablet' || sizeKey === 'mobile') {
                throw new Error(
                    'Mac dinamička pozadina dostupna je za računalne veličine.',
                );
            }

            const [{ upload }, macOSDynamicWallpaper] = await Promise.all([
                import('@vercel/blob/client'),
                import('./macOSDynamicWallpaper'),
            ]);
            const size = wallpaperSizes[sizeKey];
            if (selectedGardenId === null) {
                throw new Error('Najprije odaberi vrt.');
            }

            const conversionId = crypto.randomUUID();
            const encryption =
                await macOSDynamicWallpaper.createMacOSDynamicWallpaperEncryption();
            cleanupRequest = {
                branding,
                conversionId,
                encryptionKey: encryption.encodedKey,
                gardenId: selectedGardenId,
                size: sizeKey,
                template: wallpaperTemplate,
            };

            for (const wallpaperPhase of wallpaperPhases) {
                const frame = await createWallpaper({
                    ...size,
                    phase: wallpaperPhase,
                });
                const pathname =
                    macOSDynamicWallpaper.macOSDynamicWallpaperInputPath({
                        conversionId,
                        gardenId: selectedGardenId,
                        phase: wallpaperPhase,
                    });
                const encryptedFrame =
                    await macOSDynamicWallpaper.encryptMacOSDynamicWallpaperBlob(
                        {
                            blob: frame,
                            key: encryption.key,
                            pathname,
                        },
                    );
                const uploaded = await upload(pathname, encryptedFrame, {
                    access: 'public',
                    clientPayload: JSON.stringify({
                        conversionId,
                        gardenId: selectedGardenId,
                        phase: wallpaperPhase,
                    }),
                    contentType: 'application/octet-stream',
                    handleUploadUrl:
                        '/api/gredice/api/wallpapers/macos-dynamic/uploads',
                    multipart: encryptedFrame.size > 5 * 1024 * 1024,
                });
                if (uploaded.pathname !== pathname) {
                    throw new Error(
                        'Prijenos slike za HEIC pozadinu nije potvrđen.',
                    );
                }
            }

            const response = await fetch(
                '/api/gredice/api/wallpapers/macos-dynamic',
                {
                    body: JSON.stringify(cleanupRequest),
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                },
            );
            if (response.status === 401) {
                queryClient.setQueryData(currentUserQueryKey, null);
                throw new Error('Prijava je istekla. Prijavi se ponovno.');
            }
            if (!response.ok) {
                throw new Error(await wallpaperDownloadError(response));
            }

            const conversion = macOSDynamicWallpaperResponse(
                await response.json(),
            );
            const expectedFileName =
                macOSDynamicWallpaper.macOSDynamicWallpaperFileName({
                    branding,
                    size: sizeKey,
                    template: wallpaperTemplate,
                });
            if (!conversion || conversion.fileName !== expectedFileName) {
                throw new Error(
                    'Poslužitelj nije vratio valjanu HEIC pozadinu.',
                );
            }

            const downloadResponse = await fetch(conversion.downloadUrl, {
                cache: 'no-store',
            });
            if (!downloadResponse.ok) {
                throw new Error(
                    'Preuzimanje gotove HEIC pozadine nije uspjelo.',
                );
            }
            const encryptedHeic = await downloadResponse.blob();
            if (
                encryptedHeic.size === 0 ||
                encryptedHeic.type !== 'application/octet-stream'
            ) {
                throw new Error(
                    'Poslužitelj nije vratio valjanu HEIC pozadinu.',
                );
            }
            const heic =
                await macOSDynamicWallpaper.decryptMacOSDynamicWallpaperBlob({
                    blob: encryptedHeic,
                    contentType: 'image/heic',
                    key: encryption.key,
                    pathname: conversion.pathname,
                });
            downloadBlob(heic, expectedFileName);
        } catch (downloadError) {
            setError(captureErrorMessage(downloadError));
        } finally {
            if (cleanupRequest) {
                const cleanupController = new AbortController();
                const cleanupTimeout = window.setTimeout(
                    () => cleanupController.abort(),
                    3000,
                );
                try {
                    await fetch('/api/gredice/api/wallpapers/macos-dynamic', {
                        body: JSON.stringify(cleanupRequest),
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        method: 'DELETE',
                        signal: cleanupController.signal,
                    });
                } catch {
                    // Cleanup is best effort; the server cron removes leftovers.
                } finally {
                    window.clearTimeout(cleanupTimeout);
                }
            }
            setActivity('idle');
        }
    }

    if (isLoadingUser) {
        return (
            <div className="flex min-h-64 items-center justify-center">
                <Spinner loadingLabel="Provjera prijave" className="size-6" />
            </div>
        );
    }

    if (!currentUser) {
        return (
            <>
                <Card className="border-tertiary border-b-4">
                    <CardHeader>
                        <CardTitle>Pozadina iz tvog vrta</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Stack spacing={4}>
                            <Typography level="body1">
                                Prijavi se kako bismo učitali tvoje vrtove i
                                izradili pozadinu lokalno u pregledniku.
                            </Typography>
                            <Typography level="body2" secondary>
                                Slika vrta ne šalje se AI servisu i ne
                                objavljuje se na javnoj poveznici.
                            </Typography>
                            <Button onClick={() => setShowLogin(true)}>
                                Prijavi se za izradu
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
                <InlineLoginDialog
                    description="Prijavi se za izradu besplatne pozadine iz svog vrta."
                    onOpenChange={setShowLogin}
                    open={showLogin}
                    returnTo="/pozadine"
                />
            </>
        );
    }

    if (gardensQuery.isLoading) {
        return (
            <div className="flex min-h-64 items-center justify-center gap-3">
                <Spinner loadingLabel="Učitavanje vrtova" />
                <Typography level="body2" secondary>
                    Učitavamo tvoje vrtove…
                </Typography>
            </div>
        );
    }

    if (gardensQuery.isError) {
        return (
            <Alert
                color="danger"
                startDecorator={<Warning className="size-4" />}
            >
                {captureErrorMessage(gardensQuery.error)}
            </Alert>
        );
    }

    if (!gardensQuery.data?.length) {
        return (
            <Card className="border-tertiary border-b-4">
                <CardHeader>
                    <CardTitle>Najprije izradi vrt</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={4}>
                        <Typography level="body2" secondary>
                            Pozadina koristi stvarni raspored gredica, biljaka i
                            ukrasa iz tvog Gredice vrta.
                        </Typography>
                        <Button
                            href={KnownPages.GardenApp}
                            endDecorator={<Navigate className="size-4" />}
                        >
                            Otvori vrt
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    const isBusy = activity !== 'idle';
    const selectedSize = wallpaperSizes[sizeKey];

    return (
        <>
            <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
                <Card className="h-fit border-tertiary border-b-4">
                    <CardHeader>
                        <CardTitle>Postavke</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Stack spacing={5}>
                            <label className="grid gap-2 text-sm font-medium">
                                Vrt
                                <select
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                    disabled={isBusy}
                                    onChange={(event) => {
                                        const value = Number.parseInt(
                                            event.currentTarget.value,
                                            10,
                                        );
                                        setSelectedGardenId(
                                            Number.isFinite(value)
                                                ? value
                                                : null,
                                        );
                                    }}
                                    value={selectedGardenId ?? ''}
                                >
                                    {gardensQuery.data.map((garden) => (
                                        <option
                                            key={garden.id}
                                            value={garden.id}
                                        >
                                            {garden.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="grid gap-2">
                                <Typography level="body2" bold>
                                    Doba dana
                                </Typography>
                                <ButtonGroup
                                    className="grid w-full grid-cols-4"
                                    legend="Doba dana"
                                    size="sm"
                                >
                                    {wallpaperPhases.map((value) => (
                                        <Button
                                            aria-pressed={phase === value}
                                            className={buttonGroupItemClassName(
                                                {
                                                    className: 'w-full',
                                                    size: 'sm',
                                                },
                                            )}
                                            disabled={isBusy}
                                            key={value}
                                            onClick={() => setPhase(value)}
                                            variant={
                                                phase === value
                                                    ? 'soft'
                                                    : 'plain'
                                            }
                                        >
                                            {wallpaperPhaseLabels[value]}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </div>

                            <label className="grid gap-2 text-sm font-medium">
                                Veličina
                                <select
                                    aria-label="Veličina pozadine"
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                    disabled={isBusy}
                                    onChange={(event) => {
                                        const selectedSizeKey =
                                            wallpaperSizeKeys.find(
                                                (value) =>
                                                    value ===
                                                    event.currentTarget.value,
                                            );
                                        if (selectedSizeKey) {
                                            setSizeKey(selectedSizeKey);
                                        }
                                    }}
                                    value={sizeKey}
                                >
                                    {wallpaperSizeKeys.map((value) => (
                                        <option key={value} value={value}>
                                            {wallpaperSizes[value].label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <Switch
                                checked={branding === 'gredice'}
                                disabled={isBusy}
                                label="Gredice logo"
                                onCheckedChange={(checked) =>
                                    setBranding(checked ? 'gredice' : 'clean')
                                }
                            />
                        </Stack>
                    </CardContent>
                </Card>

                <Stack spacing={4}>
                    <Card className="flex justify-center overflow-hidden bg-muted p-0">
                        <div
                            className="relative flex max-w-full items-center justify-center overflow-hidden bg-muted"
                            style={{
                                aspectRatio: `${selectedSize.width} / ${selectedSize.height}`,
                                width:
                                    selectedSize.width < selectedSize.height
                                        ? `${
                                              (70 * selectedSize.width) /
                                              selectedSize.height
                                          }vh`
                                        : '100%',
                            }}
                        >
                            {previewUrl ? (
                                // biome-ignore lint/performance/noImgElement: Browser-generated Blob URLs cannot be optimized by next/image.
                                <img
                                    alt={`Pregled pozadine: U vrtu, ${wallpaperPhaseLabels[phase]}`}
                                    className="size-full object-contain"
                                    src={previewUrl}
                                />
                            ) : gardenQuery.isLoading ? (
                                <div className="flex items-center gap-3">
                                    <Spinner loadingLabel="Učitavanje vrta" />
                                    <Typography level="body2" secondary>
                                        Učitavamo vrt…
                                    </Typography>
                                </div>
                            ) : activity === 'preview' ? (
                                <div className="flex items-center gap-3 px-6 text-center">
                                    <Spinner loadingLabel="Izrada pregleda" />
                                    <Typography level="body2" secondary>
                                        Izrađujemo pregled…
                                    </Typography>
                                </div>
                            ) : (
                                <div className="grid max-w-sm gap-2 px-6 text-center">
                                    <Typography level="body1" bold>
                                        Pregled trenutačno nije dostupan
                                    </Typography>
                                    <Typography level="body2" secondary>
                                        Promijeni postavku kako bismo ga ponovno
                                        pokušali izraditi.
                                    </Typography>
                                </div>
                            )}
                        </div>
                    </Card>

                    {gardenQuery.isError ? (
                        <Alert
                            color="danger"
                            startDecorator={<Warning className="size-4" />}
                        >
                            {captureErrorMessage(gardenQuery.error)}
                        </Alert>
                    ) : null}
                    {error ? (
                        <Alert
                            color="danger"
                            startDecorator={<Warning className="size-4" />}
                        >
                            {error}
                        </Alert>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                        {sizeKey !== 'tablet' && sizeKey !== 'mobile' ? (
                            <Button
                                aria-label="Preuzmi gotovu Mac dinamičku HEIC pozadinu"
                                disabled={!gardenQuery.data || isBusy}
                                loading={activity === 'macos'}
                                onClick={handleMacOSDynamicDownload}
                                startDecorator={
                                    <svg
                                        aria-hidden="true"
                                        className="size-4 fill-current"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                                    </svg>
                                }
                            >
                                Preuzmi Mac HEIC
                            </Button>
                        ) : null}
                        <Button
                            aria-label={`Preuzmi ${selectedSize.shortLabel} za Windows, Linux ili Android`}
                            disabled={!gardenQuery.data || isBusy}
                            loading={activity === 'download'}
                            onClick={handleDownload}
                            startDecorator={
                                <span
                                    aria-hidden="true"
                                    className="flex items-end -space-x-1"
                                >
                                    <Laptop className="size-4" />
                                    <Desktop className="size-4" />
                                    <Mobile className="size-3.5" />
                                </span>
                            }
                        >
                            Preuzmi {selectedSize.shortLabel}
                        </Button>
                    </div>
                </Stack>
            </div>

            <WallpaperCaptureRenderer
                onCapture={handleSceneCapture}
                onError={handleSceneError}
                request={captureRequest}
            />
            <Logotype
                aria-hidden="true"
                className="pointer-events-none fixed size-px opacity-0"
                data-wallpaper-logo-source=""
            />
        </>
    );
}
