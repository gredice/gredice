import { useEffect, useMemo, useState } from 'react';
import { useClearSandboxEnvironmentOverrides } from '../../../packages/game/src/hooks/useClearSandboxEnvironmentOverrides';
import { SandboxEnvironmentHud } from '../../../packages/game/src/hud/SandboxEnvironmentHud';
import {
    createGameState,
    GameStateContext,
    useGameState,
} from '../../../packages/game/src/useGameState';

function formatLocalDate(date: Date | null | undefined) {
    if (!date) {
        return '';
    }

    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatLocalTime(date: Date | null | undefined) {
    if (!date) {
        return '';
    }

    return date.toLocaleTimeString('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function SandboxEnvironmentHudStatus() {
    const freezeTime = useGameState((state) => state.freezeTime);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const weather = useGameState((state) => state.weather);

    return (
        <div className="absolute bottom-4 left-4 grid gap-1 rounded-md border bg-background p-3 text-xs">
            <output data-testid="sandbox-date-value">
                {formatLocalDate(freezeTime)}
            </output>
            <output data-testid="sandbox-time-value">
                {formatLocalTime(freezeTime)}
            </output>
            <output data-testid="sandbox-timeofday-value">
                {timeOfDay.toFixed(3)}
            </output>
            <output data-testid="sandbox-weather-value">
                {JSON.stringify(weather ?? null)}
            </output>
        </div>
    );
}

export function SandboxEnvironmentHudStory() {
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date(2026, 5, 21, 12, 0, 0),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <GameStateContext.Provider value={gameStore}>
            <div className="relative h-screen w-screen overflow-hidden">
                <div className="absolute right-2 top-2">
                    <SandboxEnvironmentHud />
                </div>
                <SandboxEnvironmentHudStatus />
            </div>
        </GameStateContext.Provider>
    );
}

function SandboxEnvironmentResetControls({
    garden,
    onNormalGardenSelect,
}: {
    garden: { id: number; isSandbox: boolean };
    onNormalGardenSelect: () => void;
}) {
    const setWeather = useGameState((state) => state.setWeather);
    useClearSandboxEnvironmentOverrides(garden);

    useEffect(() => {
        setWeather({
            cloudy: 0.9,
            rainy: 1,
            snowy: 0,
            foggy: 0.2,
            thundery: 1,
            windSpeed: 3,
            snowAccumulation: 0,
        });
    }, [setWeather]);

    return (
        <div className="relative h-screen w-screen overflow-hidden">
            <button
                data-testid="select-normal-garden"
                type="button"
                onClick={onNormalGardenSelect}
            >
                Select normal garden
            </button>
            <output data-testid="garden-mode-value">
                {garden.isSandbox ? 'sandbox' : 'normal'}
            </output>
            <SandboxEnvironmentHudStatus />
        </div>
    );
}

export function SandboxEnvironmentResetStory() {
    const [garden, setGarden] = useState({ id: 1, isSandbox: true });
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date(2026, 5, 21, 22, 0, 0),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <GameStateContext.Provider value={gameStore}>
            <SandboxEnvironmentResetControls
                garden={garden}
                onNormalGardenSelect={() =>
                    setGarden({ id: 2, isSandbox: false })
                }
            />
        </GameStateContext.Provider>
    );
}
