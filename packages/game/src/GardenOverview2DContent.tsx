'use client';

import { cx } from '@gredice/ui/utils';
import { useMemo } from 'react';
import { useGameFlags } from './GameFlagsContext';
import { GameHud } from './GameHud';
import styles from './GameScene.module.css';
import { GardenOverview2DMap } from './GardenOverview2DMap';
import { GardenStructureOverview2DPanel } from './GardenStructureOverview2DPanel';
import { useBlockData } from './hooks/useBlockData';
import { useClearSandboxEnvironmentOverrides } from './hooks/useClearSandboxEnvironmentOverrides';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useSyncGameTime } from './hooks/useSyncGameTime';
import { useSyncGardenBackgroundPalette } from './hooks/useSyncGardenBackgroundPalette';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';
import { getSolarEclipseState } from './scene/solarEclipse';
import { resolveGardenStructureBuildModeEnabled } from './structures/gardenStructureRollout';
import { useGameState } from './useGameState';
import { useRaisedBedCloseup } from './useRaisedBedCloseup';
import { defaultGameLocation } from './utils/timeOfDay';

export function GardenOverview2DContent({
    className,
    debugHud,
    hideHud,
    noWeather,
    suppressOpeningHud,
}: {
    className?: string;
    debugHud?: boolean;
    hideHud?: boolean;
    noWeather?: boolean;
    suppressOpeningHud?: boolean;
}) {
    useRaisedBedCloseup();
    const flags = useGameFlags();
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const {
        data: blockData,
        isError: blockDataError,
        isLoading: blockDataLoading,
    } = useBlockData();
    const {
        data: garden,
        isError: gardenError,
        isLoading: gardenLoading,
    } = useCurrentGarden();
    const gardenLatitude = garden?.location.lat;
    const gardenLongitude = garden?.location.lon;
    const location = useMemo(
        () => ({
            lat: gardenLatitude ?? defaultGameLocation.lat,
            lon: gardenLongitude ?? defaultGameLocation.lon,
        }),
        [gardenLatitude, gardenLongitude],
    );
    const currentTime = useSyncGameTime(location);
    const dayNightCycleDisabled = useGameState(
        (state) => state.dayNightCycleDisabled,
    );
    const solarEclipseObscuration = useMemo(
        () =>
            dayNightCycleDisabled
                ? 0
                : getSolarEclipseState(currentTime, location).obscuration,
        [currentTime, dayNightCycleDisabled, location],
    );
    useClearSandboxEnvironmentOverrides(garden);
    useSyncGardenBackgroundPalette(garden?.backgroundPalette);

    const isLoading = gardenLoading || blockDataLoading;
    const showDebugHud = debugHud ?? Boolean(flags.enableDebugHudFlag);
    const hud = !hideHud ? (
        <GameHud
            debugHud={showDebugHud}
            noWeather={noWeather}
            suppressOpeningHud={suppressOpeningHud}
            viewMode="2d"
        />
    ) : null;

    if (gardenError || blockDataError || (!isLoading && !blockData)) {
        return (
            <div
                data-garden-renderer="2d"
                className={cx(
                    styles.interactionSurface,
                    'relative flex h-full w-full items-center justify-center bg-lime-100 p-6 text-center dark:bg-emerald-950',
                    className,
                )}
            >
                <div
                    role="alert"
                    className="max-w-md rounded-2xl border border-red-900/15 bg-background/90 p-5 text-sm shadow-xl"
                >
                    2D pregled vrta trenutačno nije moguće učitati. Pokušajte
                    ponovno.
                </div>
                {hud}
            </div>
        );
    }

    if (isLoading || garden === undefined || !blockData) {
        return (
            <div
                data-garden-renderer="2d"
                className={cx(
                    styles.interactionSurface,
                    'relative h-full w-full bg-lime-100 dark:bg-emerald-950',
                    className,
                )}
            >
                <GardenLoadingIndicator />
            </div>
        );
    }

    if (garden === null) {
        return (
            <div
                data-garden-renderer="2d"
                className={cx(
                    styles.interactionSurface,
                    'relative flex h-full w-full items-center justify-center bg-lime-100 p-6 text-center dark:bg-emerald-950',
                    className,
                )}
            >
                <div className="max-w-md rounded-2xl border border-foreground/10 bg-background/90 p-5 text-sm shadow-xl">
                    Odaberite ili izradite vrt kako biste otvorili 2D pregled.
                </div>
                {hud}
            </div>
        );
    }

    const gardenStructureBuildEnabled = resolveGardenStructureBuildModeEnabled({
        fixture: isLocalSandbox,
        managedEnabled: Boolean(flags.enableGardenBuildingSystemFlag),
        serverEnabled: Boolean(garden.gardenBuildingSystem?.enabled),
    });

    return (
        <div
            data-garden-renderer="2d"
            className={cx(
                styles.interactionSurface,
                'relative h-full w-full animate-in overflow-hidden fade-in duration-500',
                className,
            )}
        >
            <GardenOverview2DMap
                blockData={blockData}
                garden={garden}
                solarEclipseObscuration={solarEclipseObscuration}
            />
            {garden.structures.length > 0 || gardenStructureBuildEnabled ? (
                <GardenStructureOverview2DPanel
                    buildEnabled={gardenStructureBuildEnabled}
                    structures={garden.structures}
                />
            ) : null}
            {hud}
            {isLocalSandbox ? null : (
                <span className="sr-only">
                    2D prikaz ne koristi 3D iscrtavanje.
                </span>
            )}
        </div>
    );
}
