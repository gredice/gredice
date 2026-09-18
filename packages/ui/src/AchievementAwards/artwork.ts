/// <reference types="next/image-types/global" />
import type { AchievementArtworkKey } from '@gredice/js/achievements';
import type { StaticImageData } from 'next/image';
import award28 from './assets/community-edit-1.webp';
import award29 from './assets/community-edit-5.webp';
import award30 from './assets/community-edit-10.webp';
import award31 from './assets/community-edit-25.webp';
import award32 from './assets/community-edit-50.webp';
import award33 from './assets/community-edit-100.webp';
import award19 from './assets/harvest-1.webp';
import award20 from './assets/harvest-10.webp';
import award21 from './assets/harvest-20.webp';
import award22 from './assets/harvest-50.webp';
import award23 from './assets/harvest-100.webp';
import award24 from './assets/harvest-150.webp';
import award25 from './assets/harvest-200.webp';
import award26 from './assets/harvest-300.webp';
import award27 from './assets/harvest-500.webp';
import award1 from './assets/planting-1.webp';
import award2 from './assets/planting-10.webp';
import award3 from './assets/planting-20.webp';
import award4 from './assets/planting-50.webp';
import award5 from './assets/planting-100.webp';
import award6 from './assets/planting-150.webp';
import award7 from './assets/planting-200.webp';
import award8 from './assets/planting-300.webp';
import award9 from './assets/planting-500.webp';
import award0 from './assets/registration.webp';
import award10 from './assets/watering-1.webp';
import award11 from './assets/watering-10.webp';
import award12 from './assets/watering-20.webp';
import award13 from './assets/watering-50.webp';
import award14 from './assets/watering-100.webp';
import award15 from './assets/watering-150.webp';
import award16 from './assets/watering-200.webp';
import award17 from './assets/watering-300.webp';
import award18 from './assets/watering-500.webp';

export const achievementArtwork: Partial<
    Record<AchievementArtworkKey, string | StaticImageData>
> = {
    registration: award0,
    planting_1: award1,
    planting_10: award2,
    planting_20: award3,
    planting_50: award4,
    planting_100: award5,
    planting_150: award6,
    planting_200: award7,
    planting_300: award8,
    planting_500: award9,
    watering_1: award10,
    watering_10: award11,
    watering_20: award12,
    watering_50: award13,
    watering_100: award14,
    watering_150: award15,
    watering_200: award16,
    watering_300: award17,
    watering_500: award18,
    harvest_1: award19,
    harvest_10: award20,
    harvest_20: award21,
    harvest_50: award22,
    harvest_100: award23,
    harvest_150: award24,
    harvest_200: award25,
    harvest_300: award26,
    harvest_500: award27,
    community_edit_1: award28,
    community_edit_5: award29,
    community_edit_10: award30,
    community_edit_25: award31,
    community_edit_50: award32,
    community_edit_100: award33,
};
