'use client';

import { useId } from 'react';
import { Switch } from '../Switch';
import { usePublicEnvironment } from './PublicEnvironmentProvider';
import {
    getPublicEnvironmentMinutes,
    isPublicEnvironmentWeatherKind,
    type PublicEnvironmentWeatherKind,
    publicEnvironmentTimeZone,
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
        timeZone: publicEnvironmentTimeZone,
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
    const ambientToggleId = useId();
    const timeOverrideId = useId();
    const timeSliderId = useId();
    const weatherId = useId();
    const currentMinutes = getPublicEnvironmentMinutes(date);
    const sliderMinutes =
        debugMinutes ?? (Math.round(currentMinutes / 15) * 15) % (24 * 60);

    return (
        <div className="w-full max-w-sm">
            <div className="flex items-center justify-between gap-3 rounded-full border border-border/70 bg-background/70 py-1.5 pl-3 pr-1.5 shadow-sm backdrop-blur-xl">
                <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor={ambientToggleId}
                >
                    Ambijent vrta
                </label>
                <Switch
                    aria-label="Ambijentalna pozadina"
                    checked={enabled ?? true}
                    disabled={enabled === null}
                    id={ambientToggleId}
                    onCheckedChange={toggle}
                    size="sm"
                />
            </div>
            {debugEnabled ? (
                <details className="mt-2 rounded-xl border border-border/70 bg-background/70 p-3 text-left shadow-sm backdrop-blur-xl">
                    <summary className="cursor-pointer text-sm font-semibold text-foreground">
                        Debug prikaza
                    </summary>
                    <div className="mt-4 grid gap-4">
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
                                            Number(event.currentTarget.value),
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
                                    if (isPublicEnvironmentWeatherKind(kind)) {
                                        setWeatherKind(kind);
                                    }
                                }}
                                value={weatherKind}
                            >
                                {publicEnvironmentWeatherKinds.map((kind) => (
                                    <option key={kind} value={kind}>
                                        {weatherLabels[kind]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </details>
            ) : null}
        </div>
    );
}
