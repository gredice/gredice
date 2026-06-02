'use client';

import { useMemo, useState } from 'react';

const MODE_OPTIONS = [
    { value: 'baseline', label: 'Baseline', description: 'Clear sky · noon' },
    { value: 'rain', label: 'Rain', description: 'Cloudy · heavy rain' },
    { value: 'snow', label: 'Snow', description: 'Winter · snow cover' },
    { value: 'night', label: 'Night', description: '22:30 · clear' },
    { value: 'storm', label: 'Storm', description: '18:30 · thunder + wind' },
    { value: 'autumn', label: 'Autumn', description: '16:30 · breezy' },
] as const;

const QUALITY_OPTIONS = [
    { value: 'auto', label: 'Auto', description: 'Detect from device' },
    { value: 'low', label: 'Low', description: 'Cheapest preset' },
    { value: 'medium', label: 'Medium', description: 'Balanced preset' },
    { value: 'high', label: 'High', description: 'Maximum detail' },
] as const;

type Mode = (typeof MODE_OPTIONS)[number]['value'];
type Quality = (typeof QUALITY_OPTIONS)[number]['value'];

const segmentBase =
    'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors';
const segmentActive = 'border-white bg-white text-neutral-950';
const segmentInactive =
    'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-white';

function SegmentedControl<T extends string>({
    label,
    description,
    options,
    value,
    onChange,
}: {
    label: string;
    description: string;
    options: ReadonlyArray<{
        value: T;
        label: string;
        description?: string;
    }>;
    value: T;
    onChange: (value: T) => void;
}) {
    const activeDescription = options.find(
        (option) => option.value === value,
    )?.description;

    return (
        <div className="flex flex-col gap-2">
            <div>
                <span className="block text-sm font-semibold text-white">
                    {label}
                </span>
                <span className="block text-xs text-neutral-400">
                    {description}
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <button
                        type="button"
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        title={option.description}
                        className={`${segmentBase} ${
                            option.value === value
                                ? segmentActive
                                : segmentInactive
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            {activeDescription ? (
                <span className="text-xs text-neutral-500">
                    {activeDescription}
                </span>
            ) : null}
        </div>
    );
}

function ToggleButton({
    label,
    description,
    enabled,
    onToggle,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={enabled}
            className={`flex flex-1 flex-col gap-1 rounded-md border p-3 text-left transition-colors ${
                enabled
                    ? 'border-white bg-white/10'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
            }`}
        >
            <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">
                    {label}
                </span>
                <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        enabled
                            ? 'bg-white text-neutral-950'
                            : 'bg-neutral-800 text-neutral-400'
                    }`}
                >
                    {enabled ? 'On' : 'Off'}
                </span>
            </span>
            <span className="text-xs text-neutral-400">{description}</span>
        </button>
    );
}

export function GameSceneLauncher() {
    const [mode, setMode] = useState<Mode>('baseline');
    const [quality, setQuality] = useState<Quality>('auto');
    const [details, setDetails] = useState(false);
    const [hud, setHud] = useState(true);
    const [controls, setControls] = useState(true);

    const href = useMemo(() => {
        const params = new URLSearchParams();
        if (mode !== 'baseline') {
            params.set('mode', mode);
        }
        if (quality !== 'auto') {
            params.set('quality', quality);
        }
        if (details) {
            params.set('details', '1');
        }
        if (hud) {
            params.set('hud', '1');
        }
        if (!controls) {
            params.set('controls', '0');
        }
        const queryString = params.toString();
        return `/debug/profile/game${queryString ? `?${queryString}` : ''}`;
    }, [mode, quality, details, hud, controls]);

    return (
        <div className="flex flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div>
                <span className="block text-base font-semibold text-white">
                    Scene launcher
                </span>
                <span className="mt-1 block text-sm text-neutral-400">
                    Configure every query parameter the game scene accepts, then
                    open it. Replaces the fixed weather/time profiles.
                </span>
            </div>

            <SegmentedControl
                label="Weather & time"
                description="Preset weather conditions and time of day (mode)."
                options={MODE_OPTIONS}
                value={mode}
                onChange={setMode}
            />

            <SegmentedControl
                label="Render quality"
                description="Force a quality tier, or let the device decide (quality)."
                options={QUALITY_OPTIONS}
                value={quality}
                onChange={setQuality}
            />

            <div className="flex flex-col gap-2">
                <div>
                    <span className="block text-sm font-semibold text-white">
                        Options
                    </span>
                    <span className="block text-xs text-neutral-400">
                        Independent on/off flags.
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ToggleButton
                        label="Details"
                        description="Render deferred scene details: mulch, ground decoration (details)."
                        enabled={details}
                        onToggle={() => setDetails((current) => !current)}
                    />
                    <ToggleButton
                        label="HUD"
                        description="Show the in-game HUD overlay, including the debug HUD (hud)."
                        enabled={hud}
                        onToggle={() => setHud((current) => !current)}
                    />
                    <ToggleButton
                        label="Controls"
                        description="Allow camera pan, zoom and rotation (controls)."
                        enabled={controls}
                        onToggle={() => setControls((current) => !current)}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-neutral-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <code className="break-all rounded bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-400">
                    {href}
                </code>
                <a
                    href={href}
                    className="shrink-0 rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-200"
                >
                    Open scene →
                </a>
            </div>
        </div>
    );
}
