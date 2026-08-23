'use client';

import { clientAuthenticated, type GardenResponse } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { ButtonGroup, buttonGroupItemClassName } from '@gredice/ui/ButtonGroup';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ArrowDownToLine, Info, Navigate, Warning } from '@gredice/ui/icons';
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
    wallpaperTemplateLabels,
    wallpaperThemeLabels,
} from './wallpaperComposer';

type PendingCapture = {
    reject: (error: Error) => void;
    resolve: (blob: Blob) => void;
};

type WallpaperActivity = 'download' | 'idle' | 'macos' | 'preview';

const wallpaperTemplates: WallpaperTemplate[] = ['minimal', 'standard'];
const wallpaperThemes: WallpaperTheme[] = ['water', 'grass', 'sand', 'dirt'];
const wallpaperPhases: WallpaperPhase[] = [
    'morning',
    'day',
    'evening',
    'night',
];
const wallpaperSizeKeys: WallpaperSizeKey[] = ['uhd', 'ultrawide'];

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

export function WallpaperStudio() {
    const queryClient = useQueryClient();
    const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
    const [showLogin, setShowLogin] = useState(false);
    const [selectedGardenId, setSelectedGardenId] = useState<number | null>(
        null,
    );
    const [template, setTemplate] = useState<WallpaperTemplate>('minimal');
    const [theme, setTheme] = useState<WallpaperTheme>('grass');
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
        template,
        theme,
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
                template,
                theme,
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
                    transparent: template === 'minimal',
                    width,
                });
            });
        },
        [template, theme],
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
                template,
                theme,
                width,
            });
        },
        [
            branding,
            gardenQuery.data,
            phase,
            requestSceneCapture,
            template,
            theme,
        ],
    );

    async function handlePreview() {
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
    }

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
                    template,
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
        try {
            const {
                createMacOSDynamicWallpaperBundle,
                macOSDynamicWallpaperFileName,
            } = await import('./macOSDynamicWallpaper');
            const size = wallpaperSizes[sizeKey];
            const frames: Array<{ blob: Blob; phase: WallpaperPhase }> = [];

            for (const wallpaperPhase of wallpaperPhases) {
                frames.push({
                    blob: await createWallpaper({
                        ...size,
                        phase: wallpaperPhase,
                    }),
                    phase: wallpaperPhase,
                });
            }

            const bundle = await createMacOSDynamicWallpaperBundle({ frames });
            downloadBlob(
                bundle,
                macOSDynamicWallpaperFileName({
                    branding,
                    size: sizeKey,
                    template,
                }),
            );
        } catch (downloadError) {
            setError(captureErrorMessage(downloadError));
        } finally {
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
                        <div className="flex items-start justify-between gap-3">
                            <CardTitle>Pozadina iz tvog vrta</CardTitle>
                            <Chip color="success" variant="soft">
                                Besplatno
                            </Chip>
                        </div>
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
                        <div className="flex items-start justify-between gap-3">
                            <CardTitle>Postavke</CardTitle>
                            <Chip color="success" size="sm" variant="soft">
                                Besplatno
                            </Chip>
                        </div>
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
                                    Predložak
                                </Typography>
                                <ButtonGroup
                                    className="grid w-full grid-cols-2"
                                    legend="Predložak pozadine"
                                    size="md"
                                >
                                    {wallpaperTemplates.map((value) => (
                                        <Button
                                            aria-pressed={template === value}
                                            className={buttonGroupItemClassName(
                                                {
                                                    className: 'w-full',
                                                    size: 'md',
                                                },
                                            )}
                                            disabled={isBusy}
                                            key={value}
                                            onClick={() => setTemplate(value)}
                                            variant={
                                                template === value
                                                    ? 'soft'
                                                    : 'plain'
                                            }
                                        >
                                            {wallpaperTemplateLabels[value]}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </div>

                            {template === 'minimal' ? (
                                <div className="grid gap-2">
                                    <Typography level="body2" bold>
                                        Rub vrta
                                    </Typography>
                                    <ButtonGroup
                                        className="grid w-full grid-cols-4"
                                        legend="Tonalna tema"
                                        size="sm"
                                    >
                                        {wallpaperThemes.map((value) => (
                                            <Button
                                                aria-pressed={theme === value}
                                                className={buttonGroupItemClassName(
                                                    {
                                                        className: 'w-full',
                                                        size: 'sm',
                                                    },
                                                )}
                                                disabled={isBusy}
                                                key={value}
                                                onClick={() => setTheme(value)}
                                                variant={
                                                    theme === value
                                                        ? 'soft'
                                                        : 'plain'
                                                }
                                            >
                                                {wallpaperThemeLabels[value]}
                                            </Button>
                                        ))}
                                    </ButtonGroup>
                                </div>
                            ) : null}

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

                            <div className="grid gap-2">
                                <Typography level="body2" bold>
                                    Veličina
                                </Typography>
                                <ButtonGroup
                                    className="grid w-full grid-cols-2"
                                    legend="Veličina pozadine"
                                    size="md"
                                >
                                    {wallpaperSizeKeys.map((value) => (
                                        <Button
                                            aria-pressed={sizeKey === value}
                                            className={buttonGroupItemClassName(
                                                {
                                                    className: 'w-full',
                                                    size: 'md',
                                                },
                                            )}
                                            disabled={isBusy}
                                            key={value}
                                            onClick={() => setSizeKey(value)}
                                            variant={
                                                sizeKey === value
                                                    ? 'soft'
                                                    : 'plain'
                                            }
                                        >
                                            {wallpaperSizes[value].shortLabel}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                                <Typography level="body3" secondary>
                                    {selectedSize.label}
                                </Typography>
                            </div>

                            <Switch
                                checked={branding === 'gredice'}
                                disabled={isBusy}
                                label="Gredice potpis"
                                description="Veliki službeni logotip usklađen s kompozicijom."
                                onCheckedChange={(checked) =>
                                    setBranding(checked ? 'gredice' : 'clean')
                                }
                            />
                        </Stack>
                    </CardContent>
                </Card>

                <Stack spacing={4}>
                    <Card className="overflow-hidden p-0">
                        <div
                            className="relative flex w-full items-center justify-center overflow-hidden bg-muted"
                            style={{
                                aspectRatio: `${selectedSize.width} / ${selectedSize.height}`,
                            }}
                        >
                            {previewUrl ? (
                                // biome-ignore lint/performance/noImgElement: Browser-generated Blob URLs cannot be optimized by next/image.
                                <img
                                    alt={`Pregled pozadine: ${wallpaperTemplateLabels[template]}, ${wallpaperPhaseLabels[phase]}`}
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
                            ) : (
                                <div className="grid max-w-sm gap-2 px-6 text-center">
                                    <Typography level="body1" bold>
                                        Pregled je spreman za izradu
                                    </Typography>
                                    <Typography level="body2" secondary>
                                        Izrada koristi isti renderer kao tvoj
                                        vrt i može potrajati nekoliko sekundi.
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
                    <Alert
                        color="info"
                        startDecorator={<Info className="size-4" />}
                    >
                        Pozadina se izrađuje samo u tvom pregledniku. Za
                        Windows, macOS i Linux možeš preuzeti obični PNG. Mac
                        dinamički paket uključuje jutro, dan, večer i noć te
                        upute za izradu nativne HEIC pozadine na Macu.
                    </Alert>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                        <Button
                            disabled={!gardenQuery.data || isBusy}
                            loading={activity === 'preview'}
                            onClick={handlePreview}
                            variant="outlined"
                        >
                            Izradi pregled
                        </Button>
                        <Button
                            disabled={!gardenQuery.data || isBusy}
                            loading={activity === 'macos'}
                            onClick={handleMacOSDynamicDownload}
                            startDecorator={
                                <ArrowDownToLine className="size-4" />
                            }
                            variant="outlined"
                        >
                            Mac dinamički paket
                        </Button>
                        <Button
                            disabled={!gardenQuery.data || isBusy}
                            loading={activity === 'download'}
                            onClick={handleDownload}
                            startDecorator={
                                <ArrowDownToLine className="size-4" />
                            }
                        >
                            Preuzmi {selectedSize.shortLabel} PNG
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
