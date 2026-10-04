'use client';
import {
    isPumpkinTrailComplete,
    lightPumpkinTrailStop,
    pumpkinTrailStops,
} from '@gredice/js/pumpkinTrail';
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
import { resolveCaptureCameraZoom } from '../controls/orthographicCameraFit';
import { PumpkinLightOverrideContext } from '../entities/helpers/PumpkinLightOverrideContext';
import { gameQualityProfiles } from '../scene/gameQuality';
import {
    createDateForGameTimeOfDay,
    defaultGameLocation,
} from '../utils/timeOfDay';
import { PublicGardenViewer } from '../viewers/PublicGardenViewer';
import { PumpkinTrailMarker } from './PumpkinTrailMarker';
import { PumpkinTrailSceneBoundary } from './PumpkinTrailSceneBoundary';
import {
    getPumpkinTrailRenderOnlyData,
    pumpkinTrailStacks,
} from './pumpkinTrailScene';

const data = getPumpkinTrailRenderOnlyData();
const stopIds = new Set(pumpkinTrailStops.map((stop) => stop.id));
const phases = [
    { label: 'Sumrak', time: 0.79 },
    { label: 'Noć', time: 0.94 },
    { label: 'Dan', time: 0.5 },
];
export function PumpkinTrailViewer({
    appBaseUrl = '',
    sceneChildren,
}: {
    appBaseUrl?: string;
    sceneChildren?: ReactNode;
}) {
    const [started, setStarted] = useState(false);
    const [lit, setLit] = useState<readonly string[]>([]);
    const [focused, setFocused] = useState<string | null>(null);
    const [phase, setPhase] = useState(0);
    const [generation, setGeneration] = useState(0);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [size, setSize] = useState({ width: 780, height: 560 });
    const section = useRef<HTMLElement>(null);
    const main = useRef<HTMLElement>(null);
    useEffect(() => {
        const element = section.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry)
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (started)
            main.current
                ?.querySelector<HTMLButtonElement>('[data-pumpkin-stop]')
                ?.focus();
    }, [started]);
    useEffect(() => {
        if (!started && ready && generation > 0)
            main.current
                ?.querySelector<HTMLButtonElement>('[data-pumpkin-start]')
                ?.focus();
    }, [started, ready, generation]);
    useEffect(() => {
        const onPageHide = () => {
            setLit([]);
            setStarted(false);
            setFocused(null);
            setReady(false);
            setGeneration((value) => value + 1);
        };
        window.addEventListener('pagehide', onPageHide);
        return () => window.removeEventListener('pagehide', onPageHide);
    }, []);
    const view = useMemo(
        () => ({
            cameraPosition: new Vector3(-100, 100, -100),
            cameraTarget: new Vector3(0, 0.893, 0),
            cameraZoom: Math.min(
                82,
                resolveCaptureCameraZoom({
                    bounds: {
                        left: -3.53555,
                        right: 3.53555,
                        top: 2.77075,
                        bottom: -2.77075,
                    },
                    cameraWidth: size.width,
                    cameraHeight: size.height,
                    padding: 0.88,
                }) ?? 1,
            ),
        }),
        [size],
    );
    const date = useMemo(
        () =>
            createDateForGameTimeOfDay(
                new Date('2026-10-03T12:00:00Z'),
                phases[phase]?.time ?? 0.79,
                defaultGameLocation,
            ),
        [phase],
    );
    const overrides = useMemo(
        () =>
            new Map(
                pumpkinTrailStops.map((stop) => [
                    stop.id,
                    lit.includes(stop.id),
                ]),
            ),
        [lit],
    );
    const complete = isPumpkinTrailComplete(lit);
    const lightStop = useCallback(
        (id: string) => {
            if (!started || !ready || failed || !stopIds.has(id)) return;
            setLit((current) => lightPumpkinTrailStop(current, id));
        },
        [started, ready, failed],
    );
    const onReady = useCallback(() => setReady(true), []);
    const onError = useCallback(() => {
        setFailed(true);
        setReady(false);
    }, []);
    function reset() {
        setLit([]);
        setStarted(false);
        setFocused(null);
        setReady(false);
        setGeneration((value) => value + 1);
        main.current
            ?.querySelector<HTMLButtonElement>('[data-pumpkin-start]')
            ?.focus();
    }
    return (
        <main
            className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6"
            data-pumpkin-trail
            ref={main}
        >
            <header>
                <h1 className="text-3xl font-semibold">Staza bundeva</h1>
                <p className="mt-2">
                    Upali pet bundeva, kojim god redom želiš.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Kratka igra svjetla u primjeru vrta. Bez kupnje i nagrada;
                    tvoj vrt ostaje isti.
                </p>
            </header>
            <fieldset className="flex gap-2" aria-label="Svjetlo na stazi">
                {phases.map((entry, index) => (
                    <Button
                        key={entry.label}
                        variant={phase === index ? 'solid' : 'outlined'}
                        aria-pressed={phase === index}
                        onClick={() => {
                            if (phase !== index) {
                                setReady(false);
                                setPhase(index);
                            }
                        }}
                    >
                        {entry.label}
                    </Button>
                ))}
            </fieldset>
            <section
                ref={section}
                aria-label="Staza s pet numeriranih bundeva"
                data-pumpkin-trail-scene
                className="h-[360px] w-full overflow-hidden rounded-xl border bg-muted sm:h-[560px]"
                style={{ maxWidth: 780 }}
            >
                {!failed && (
                    <PumpkinTrailSceneBoundary
                        key={`${generation}-${phase}-${size.width}-${size.height}`}
                        onError={onError}
                    >
                        <PumpkinLightOverrideContext.Provider
                            value={{
                                lights: overrides,
                                onSelect:
                                    started && ready ? lightStop : undefined,
                            }}
                        >
                            <PublicGardenViewer
                                appBaseUrl={appBaseUrl}
                                stacks={pumpkinTrailStacks}
                                renderOnlyBlockData={data}
                                initialView={view}
                                cameraMinZoom={1}
                                fixedTime={date}
                                qualityOverride={
                                    size.width < 600
                                        ? gameQualityProfiles.low
                                        : gameQualityProfiles.medium
                                }
                                noControls
                                noSound
                                noWeather
                                renderDetails={false}
                                deferDetails={false}
                                renderGroundDecorations={false}
                                onSceneReady={onReady}
                                onSceneContextLost={onError}
                                sceneChildren={
                                    <>
                                        {pumpkinTrailStops.map((stop) => (
                                            <PumpkinTrailMarker
                                                key={stop.id}
                                                {...stop}
                                                lit={lit.includes(stop.id)}
                                                focused={focused === stop.id}
                                            />
                                        ))}
                                        {sceneChildren}
                                    </>
                                }
                            />
                        </PumpkinLightOverrideContext.Provider>
                    </PumpkinTrailSceneBoundary>
                )}
            </section>
            {failed ? (
                <div role="alert">
                    <p>
                        Stazu nije moguće prikazati. Osvježi stranicu i pokušaj
                        ponovno.
                    </p>
                    <Button
                        variant="outlined"
                        onClick={() => window.location.reload()}
                    >
                        Osvježi stranicu
                    </Button>
                </div>
            ) : (
                <>
                    {!ready && <p role="status">Pripremamo stazu…</p>}
                    <p
                        role="status"
                        aria-live="polite"
                        data-pumpkin-trail-status
                    >
                        {complete
                            ? 'Svih pet bundeva svijetli. Staza je osvijetljena!'
                            : started
                              ? `Upaljeno ${lit.length} od 5 bundeva.`
                              : 'Staza čeka tvoj prvi korak.'}
                    </p>
                    <Button
                        data-pumpkin-start=""
                        disabled={!ready || started}
                        onClick={() => {
                            setStarted(true);
                            setFocused(pumpkinTrailStops[0]?.id ?? null);
                        }}
                    >
                        Započni stazu
                    </Button>
                    <fieldset
                        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
                        aria-label="Bundeve na stazi"
                    >
                        {pumpkinTrailStops.map((stop) => (
                            <Button
                                key={stop.id}
                                data-pumpkin-stop={stop.id}
                                aria-pressed={lit.includes(stop.id)}
                                disabled={!ready || !started}
                                variant={
                                    lit.includes(stop.id) ? 'solid' : 'outlined'
                                }
                                onFocus={() => setFocused(stop.id)}
                                onBlur={() => setFocused(null)}
                                onClick={() => lightStop(stop.id)}
                            >
                                Bundeva {stop.number}
                                {lit.includes(stop.id) ? ' ✓' : ''}
                            </Button>
                        ))}
                    </fieldset>
                    <Button variant="outlined" onClick={reset}>
                        Kreni ispočetka
                    </Button>
                    <p className="text-sm text-muted-foreground">
                        Svjetla su mirna, bez zvuka. Napredak traje samo dok je
                        ova staza otvorena.
                    </p>
                </>
            )}
        </main>
    );
}
