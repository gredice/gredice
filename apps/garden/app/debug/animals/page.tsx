import { GameScene } from '@gredice/game';
import type { ComponentProps } from 'react';
import { AnimalDebugActions } from './AnimalDebugActions';

const animalDebugStorageKey = 'gredice.debug.sandbox.animals.v1';

const animalDebugFlags = {
    enableDebugHudFlag: true,
    enableRainWetOverlayFlag: true,
} satisfies NonNullable<ComponentProps<typeof GameScene>['flags']>;

const animalDebugFreezeTime = new Date('2026-06-02T10:00:00+02:00');

const animalDebugWeather = {
    cloudy: 0,
    rainy: 0,
    snowy: 0,
    foggy: 0,
    thundery: 0,
    windSpeed: 0,
};

export default function DebugAnimalsPage() {
    return (
        <main className="relative h-screen w-screen overflow-hidden bg-[#e7e2cc]">
            <GameScene
                className="h-full w-full"
                dayNightCycleDisabled={false}
                deferDetails={false}
                flags={animalDebugFlags}
                freezeTime={animalDebugFreezeTime}
                localSandboxStorageKey={animalDebugStorageKey}
                noSound
                weather={animalDebugWeather}
            />
            <AnimalDebugActions storageKey={animalDebugStorageKey} />
        </main>
    );
}
