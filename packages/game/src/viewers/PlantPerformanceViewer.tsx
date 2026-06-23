'use client';

import { GameSceneDynamic } from '../GameSceneDynamic';

export interface PlantPerformanceViewerProps {
    className?: string;
    debugHud?: boolean;
}

const plantDebugFlags = {
    enableDebugHudFlag: true,
    enableRainWetOverlayFlag: true,
};

const plantDebugFreezeTime = new Date('2026-06-02T12:00:00+02:00');

const plantDebugWeather = {
    cloudy: 0,
    rainy: 0,
    snowy: 0,
    foggy: 0,
    thundery: 0,
    windSpeed: 0,
};

export function PlantPerformanceViewer({
    className,
    debugHud,
}: PlantPerformanceViewerProps) {
    const flags = debugHud
        ? plantDebugFlags
        : {
              enableRainWetOverlayFlag: true,
          };

    return (
        <GameSceneDynamic
            className={className}
            dayNightCycleDisabled={false}
            debugHud={debugHud}
            deferDetails={false}
            flags={flags}
            freezeTime={plantDebugFreezeTime}
            initialQualitySetting="medium"
            mockGarden
            mockGardenProfile="plant-heavy"
            noSound
            weather={plantDebugWeather}
            zoom="far"
        />
    );
}
