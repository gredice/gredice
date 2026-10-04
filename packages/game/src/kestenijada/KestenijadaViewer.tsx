'use client';
import { type BlockData, directoriesClient } from '@gredice/client';
import {
    getKestenijadaAvailability,
    isKestenijadaEventActive,
    type KestenijadaEventWindow,
    kestenijadaCanonicalUrl,
    kestenijadaPhotoTitle,
} from '@gredice/js/kestenijada';
import { Button } from '@gredice/ui/Button';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Vector3 } from 'three';
import { KnownPages } from '../knownPages';
import { gameQualityProfiles } from '../scene/gameQuality';
import {
    createDateForGameTimeOfDay,
    defaultGameLocation,
    getGameTimeOfDay,
} from '../utils/timeOfDay';
import { PublicGardenViewer } from '../viewers/PublicGardenViewer';
import { getKestenijadaCollection } from './kestenijadaCollection';
import {
    getKestenijadaRenderOnlyData,
    kestenijadaStacks,
} from './kestenijadaScene';

type Phase = 'day' | 'evening' | 'night';
const phases = {
    day: { label: 'Dan', time: 0.5 },
    evening: { label: 'Sumrak', time: 0.79 },
    night: { label: 'Noć', time: 0.94 },
};
const renderData = getKestenijadaRenderOnlyData();
const desktopView = {
    cameraPosition: new Vector3(-100, 100, -100),
    cameraTarget: new Vector3(0, 0, 0),
    cameraZoom: 80,
};
const mobileView = { ...desktopView, cameraZoom: 53 };

export function KestenijadaViewer({
    referenceInstant,
    eventWindow,
    appBaseUrl,
    sceneChildren,
}: {
    referenceInstant: string;
    eventWindow: KestenijadaEventWindow | null;
    appBaseUrl?: string;
    sceneChildren?: ReactNode;
}) {
    const [phase, setPhase] = useState<Phase>('day');
    const [mobile, setMobile] = useState(false);
    const [rows, setRows] = useState<BlockData[] | null>(null);
    const [directoryState, setDirectoryState] = useState<
        'loading' | 'ready' | 'error'
    >('loading');
    const [retry, setRetry] = useState(0);
    const [now, setNow] = useState(() => Date.parse(referenceInstant));
    const [photoKey, setPhotoKey] = useState<string | null>(null);
    const activePhoto = useRef<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const photoUrlRef = useRef<string | null>(null);
    const [photoError, setPhotoError] = useState(false);
    const [shareMessage, setShareMessage] = useState('');
    const [shareError, setShareError] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 600px)');
        const update = () => setMobile(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    useEffect(() => {
        const start = performance.now();
        const baseline = Date.parse(referenceInstant);
        const timer = window.setInterval(
            () => setNow(baseline + performance.now() - start),
            1000,
        );
        return () => window.clearInterval(timer);
    }, [referenceInstant]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: Retry explicitly restarts the aborted public-directory request.
    useEffect(() => {
        const controller = new AbortController();
        setDirectoryState('loading');
        directoriesClient()
            .GET('/entities/block', {
                signal: AbortSignal.any([
                    controller.signal,
                    AbortSignal.timeout(15_000),
                ]),
            })
            .then((response) => {
                if (controller.signal.aborted) return;
                if (response.error || !Array.isArray(response.data))
                    throw new Error('directory');
                setRows(response.data);
                setDirectoryState('ready');
            })
            .catch(() => {
                if (!controller.signal.aborted) setDirectoryState('error');
            });
        return () => controller.abort();
    }, [retry]);
    const time = getGameTimeOfDay(defaultGameLocation, new Date(now));
    const available = getKestenijadaAvailability(
        directoryState === 'ready' ? rows : null,
        time <= 0.2 || time >= 0.8,
    );
    const collection = getKestenijadaCollection(
        directoryState === 'ready' ? rows : null,
        time <= 0.2 || time >= 0.8,
    );
    const active =
        isKestenijadaEventActive(eventWindow, now) &&
        directoryState === 'ready' &&
        available.every((entry) => entry.row);
    const cancelPhoto = useCallback(() => {
        activePhoto.current = null;
        setPhotoKey(null);
        if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
        setPhotoUrl(null);
    }, []);
    useEffect(() => {
        if (!active) cancelPhoto();
    }, [active, cancelPhoto]);
    useEffect(
        () => () => {
            activePhoto.current = null;
            if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
        },
        [],
    );
    const date = useMemo(
        () =>
            createDateForGameTimeOfDay(
                new Date(referenceInstant),
                phases[phase].time,
                defaultGameLocation,
            ),
        [referenceInstant, phase],
    );
    const viewerProps = {
        stacks: kestenijadaStacks,
        renderOnlyBlockData: renderData,
        fixedTime: date,
        appBaseUrl,
        noControls: true,
        noSound: true,
        noWeather: true,
        renderDetails: false,
        deferDetails: false,
        renderGroundDecorations: false,
    };
    async function share() {
        setShareError(false);
        setShareMessage('');
        try {
            if (navigator.share)
                await navigator.share({
                    title: 'Kestenijada | Gredice',
                    url: kestenijadaCanonicalUrl,
                });
            else {
                await navigator.clipboard.writeText(kestenijadaCanonicalUrl);
                setShareMessage('Poveznica je kopirana.');
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError'))
                setShareError(true);
        }
    }
    return (
        <main
            className="mx-auto max-w-4xl p-4 sm:p-6 space-y-5"
            data-kestenijada
        >
            <header>
                <h1 className="text-3xl font-semibold">Kestenijada</h1>
                <p className="mt-2">
                    Mali vrtni kutak uz kestene, čaj i toplu deku. Pogledaj
                    primjer uređenja i njegove ukrase.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                    {active
                        ? 'Jesenski susret u virtualnom vrtu.'
                        : 'Primjer uređenja za inspiraciju.'}{' '}
                    Hrana i poslužni detalji dio su ukrasa.
                </p>
            </header>
            <fieldset
                className="flex flex-wrap gap-2"
                aria-label="Svjetlo u primjeru"
            >
                {Object.entries(phases).map(([key, value]) => (
                    <Button
                        key={key}
                        variant={phase === key ? 'solid' : 'outlined'}
                        aria-pressed={phase === key}
                        onClick={() => {
                            if (
                                key === 'day' ||
                                key === 'evening' ||
                                key === 'night'
                            ) {
                                cancelPhoto();
                                setPhase(key);
                            }
                        }}
                    >
                        {value.label}
                    </Button>
                ))}
            </fieldset>
            <section
                className="w-full overflow-hidden rounded-xl border bg-muted"
                style={{
                    height: mobile ? 440 : 600,
                    width: mobile ? '100%' : 'min(100%, 780px)',
                }}
                aria-label="Primjer vrta s pet ukrasa"
                data-kestenijada-scene
            >
                <PublicGardenViewer
                    key={`${phase}-${mobile}`}
                    {...viewerProps}
                    initialView={mobile ? mobileView : desktopView}
                    qualityOverride={
                        mobile ? gameQualityProfiles.low : undefined
                    }
                    sceneChildren={sceneChildren}
                />
            </section>
            <section aria-labelledby="kestenijada-decorations">
                <h2
                    id="kestenijada-decorations"
                    className="text-xl font-semibold"
                >
                    Ukrasi u primjeru
                </h2>
                <p className="text-sm mt-1">
                    Pet zasebnih ukrasa, po jedan od svakog. Travnata podloga i
                    kamena staza prikaz su okruženja. Svaki ukras kupuje se
                    zasebno prema aktualnoj ponudi.
                </p>
                {directoryState === 'loading' && (
                    <p role="status">Provjeravamo ponudu…</p>
                )}
                {directoryState === 'error' && (
                    <div role="alert">
                        <p>Ponudu trenutačno ne možemo provjeriti.</p>
                        <Button
                            variant="outlined"
                            onClick={() => setRetry((value) => value + 1)}
                        >
                            Pokušaj ponovno
                        </Button>
                    </div>
                )}
                <ul className="mt-3 space-y-3">
                    {available.map(({ item, row, alias }) => (
                        <li
                            key={item.name}
                            className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
                        >
                            <span>
                                {item.label}{' '}
                                <span className="text-muted-foreground">
                                    × 1
                                </span>
                            </span>
                            {row ? (
                                <a
                                    className="underline"
                                    href={KnownPages.GrediceBlock(
                                        alias ?? row.information.label,
                                    )}
                                    aria-label={`Pogledaj ponudu: ${item.label}`}
                                >
                                    Pogledaj ponudu
                                </a>
                            ) : (
                                <span className="text-sm text-muted-foreground">
                                    {directoryState === 'ready'
                                        ? 'Trenutačno nije u ponudi'
                                        : 'Ponuda nije potvrđena'}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
            {collection && (
                <section aria-labelledby="kestenijada-collection">
                    <h2
                        id="kestenijada-collection"
                        className="text-xl font-semibold"
                    >
                        Kolekcija {collection.label}
                    </h2>
                    <p className="text-sm">
                        Aktualni zasebni ukrasi iz postojeće kolekcije. Neki
                        nisu prikazani u ovom primjeru.
                    </p>
                    <ul className="mt-2 space-y-2">
                        {collection.items.map(({ row, alias }) => (
                            <li key={row.id}>
                                <a
                                    className="underline"
                                    href={KnownPages.GrediceBlock(
                                        alias ?? row.information.label,
                                    )}
                                >
                                    {row.information.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <div className="flex flex-wrap gap-2">
                <Button variant="outlined" onClick={share}>
                    Podijeli primjer
                </Button>
                {active && (
                    <Button
                        onClick={() => {
                            cancelPhoto();
                            setPhotoError(false);
                            const key = crypto.randomUUID();
                            activePhoto.current = key;
                            setPhotoKey(key);
                        }}
                    >
                        {kestenijadaPhotoTitle}
                    </Button>
                )}
            </div>
            {shareMessage && <p role="status">{shareMessage}</p>}
            {shareError && (
                <p role="alert">
                    Poveznicu nije moguće podijeliti. Pokušaj ponovno.
                </p>
            )}
            {photoKey && (
                <div role="status">
                    <p>Pripremamo fotografiju…</p>
                    <Button variant="outlined" onClick={cancelPhoto}>
                        Odustani
                    </Button>
                </div>
            )}
            {photoError && (
                <p role="alert">
                    Fotografiju nije moguće pripremiti. Pokušaj ponovno gumbom „
                    {kestenijadaPhotoTitle}”.
                </p>
            )}
            {photoUrl && (
                <section aria-label={kestenijadaPhotoTitle}>
                    {/* biome-ignore lint/performance/noImgElement: Local sanitized PNG Blob URL must never pass through an image proxy. */}
                    <img
                        src={photoUrl}
                        alt="Kestenijada, primjer uređenja"
                        className="max-w-full rounded-xl"
                    />
                    <a
                        href={photoUrl}
                        download="trenutak-uz-kestene.png"
                        className="underline"
                    >
                        Preuzmi PNG
                    </a>
                    <Button variant="outlined" onClick={cancelPhoto}>
                        Zatvori fotografiju
                    </Button>
                    <p className="text-sm">
                        Fotografija ostaje na tvom uređaju. Nije objavljena ni
                        prenesena.
                    </p>
                </section>
            )}
            {photoKey && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed top-0 -z-50"
                    style={{ left: -20000, width: 780, height: 600 }}
                >
                    <PublicGardenViewer
                        key={photoKey}
                        {...viewerProps}
                        initialView={desktopView}
                        capture={{
                            key: photoKey,
                            dayNightCycleDisabled: false,
                            output: {
                                width: 780,
                                height: 600,
                                contentType: 'image/png',
                                maxSizeBytes: 16 * 1024 * 1024,
                            },
                            onCapture: (blob) => {
                                if (activePhoto.current !== photoKey) return;
                                if (
                                    blob.type !== 'image/png' ||
                                    blob.size > 16 * 1024 * 1024 ||
                                    blob.size === 0
                                ) {
                                    activePhoto.current = null;
                                    setPhotoKey(null);
                                    setPhotoError(true);
                                    return;
                                }
                                const url = URL.createObjectURL(blob);
                                photoUrlRef.current = url;
                                setPhotoUrl(url);
                                activePhoto.current = null;
                                setPhotoKey(null);
                            },
                            onError: () => {
                                if (activePhoto.current === photoKey) {
                                    activePhoto.current = null;
                                    setPhotoKey(null);
                                    setPhotoError(true);
                                }
                            },
                        }}
                    />
                </div>
            )}
        </main>
    );
}
