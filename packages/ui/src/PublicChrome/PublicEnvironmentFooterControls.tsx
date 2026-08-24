'use client';

import { useId } from 'react';
import { usePublicEnvironment } from './PublicEnvironmentProvider';
import {
    isPublicEnvironmentWeatherKind,
    type PublicEnvironmentWeatherKind,
    publicEnvironmentWeatherKinds,
} from './publicEnvironment';

const weatherLabels: Record<PublicEnvironmentWeatherKind, string> = {
    live: 'Trenutačni uvjeti',
    clear: 'Vedro',
    cloudy: 'Oblačno',
    rain: 'Kiša',
    snow: 'Snijeg',
    fog: 'Magla',
    storm: 'Oluja',
};

function formatTime(date: Date) {
    return new Intl.DateTimeFormat('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function PublicEnvironmentFooterControls() {
    const {
        date,
        debugEnabled,
        debugMinutes,
        enabled,
        setDebugMinutes,
        setWeatherKind,
        toggle,
        weatherKind,
    } = usePublicEnvironment();
    const timeOverrideId = useId();
    const timeSliderId = useId();
    const weatherId = useId();
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const sliderMinutes =
        debugMinutes ?? (Math.round(currentMinutes / 15) * 15) % (24 * 60);

    return (
        <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm backdrop-blur-xl sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-sm font-semibold text-foreground">
                            Ambijent vrta
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Pozadina prati doba dana, položaj Sunca i Mjeseca te
                            trenutačne uvjete na farmi.
                        </p>
                    </div>
                    <button
                        aria-checked={enabled ?? false}
                        aria-label="Ambijentalna pozadina"
                        className={`relative inline-flex h-8 w-16 shrink-0 items-center self-start rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto ${
                            enabled
                                ? 'border-emerald-800/30 bg-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-600'
                                : 'border-border bg-muted'
                        }`}
                        disabled={enabled === null}
                        onClick={toggle}
                        role="switch"
                        type="button"
                    >
                        <span
                            className={`flex size-7 items-center justify-center rounded-full bg-background text-sm shadow-sm transition-transform ${
                                enabled ? 'translate-x-8' : 'translate-x-0.5'
                            }`}
                        >
                            {enabled ? '🌤️' : '🌱'}
                        </span>
                    </button>
                </div>
                {debugEnabled ? (
                    <details className="mt-4 border-t border-border/70 pt-4">
                        <summary className="cursor-pointer text-sm font-semibold text-foreground">
                            Debug prikaza
                        </summary>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="grid gap-3 rounded-xl border border-border/70 bg-background/65 p-3">
                                <label
                                    className="flex items-center justify-between gap-3 text-sm"
                                    htmlFor={timeOverrideId}
                                >
                                    <span>Fiksiraj vrijeme</span>
                                    <input
                                        checked={debugMinutes !== null}
                                        id={timeOverrideId}
                                        onChange={(event) =>
                                            setDebugMinutes(
                                                event.currentTarget.checked
                                                    ? sliderMinutes
                                                    : null,
                                            )
                                        }
                                        type="checkbox"
                                    />
                                </label>
                                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                                    <label
                                        className="sr-only"
                                        htmlFor={timeSliderId}
                                    >
                                        Vrijeme dana
                                    </label>
                                    <input
                                        disabled={debugMinutes === null}
                                        id={timeSliderId}
                                        max={1425}
                                        min={0}
                                        onInput={(event) =>
                                            setDebugMinutes(
                                                Number(
                                                    event.currentTarget.value,
                                                ),
                                            )
                                        }
                                        step={15}
                                        type="range"
                                        value={sliderMinutes}
                                    />
                                    <output
                                        className="min-w-12 text-right text-sm tabular-nums"
                                        htmlFor={timeSliderId}
                                    >
                                        {formatTime(date)}
                                    </output>
                                </div>
                            </div>
                            <label
                                className="grid content-start gap-2 rounded-xl border border-border/70 bg-background/65 p-3 text-sm"
                                htmlFor={weatherId}
                            >
                                <span>Vremenski uvjeti</span>
                                <select
                                    className="h-10 rounded-md border border-input bg-background px-3 text-foreground"
                                    id={weatherId}
                                    onChange={(event) => {
                                        const kind = event.currentTarget.value;
                                        if (
                                            isPublicEnvironmentWeatherKind(kind)
                                        ) {
                                            setWeatherKind(kind);
                                        }
                                    }}
                                    value={weatherKind}
                                >
                                    {publicEnvironmentWeatherKinds.map(
                                        (kind) => (
                                            <option key={kind} value={kind}>
                                                {weatherLabels[kind]}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </label>
                        </div>
                    </details>
                ) : null}
            </div>
        </div>
    );
}
