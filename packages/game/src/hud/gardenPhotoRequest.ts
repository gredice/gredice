import type { createGardenPhotoScene } from '../gardenPhotoScene';
import type { WinterMode } from '../useGameState';
export type GardenPhotoRequest = ReturnType<typeof createGardenPhotoScene> & {
    key: string;
    date: Date;
    dayNightCycleDisabled: boolean;
    winterMode: WinterMode;
    appBaseUrl: string;
    spriteBaseUrl: string;
};
