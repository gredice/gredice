import type { StaticImageData } from 'next/image';
import blossom from './assets/blossom.webp';
import calendar from './assets/calendar.webp';
import firstFruits from './assets/first-fruits.webp';
import harvestCrate from './assets/harvest-crate.webp';
import harvestReady from './assets/harvest-ready.webp';
import information from './assets/information.webp';
import magnifier from './assets/magnifier.webp';
import raisedBed from './assets/raised-bed.webp';
import seedPacket from './assets/seed-packet.webp';
import seedling from './assets/seedling.webp';
import shovel from './assets/shovel.webp';
import sownSeed from './assets/sown-seed.webp';
import statusCross from './assets/status-cross.webp';
import wiltedPlant from './assets/wilted-plant.webp';

type StatusArtwork = {
    source: string | StaticImageData;
    overlay?: string | StaticImageData;
};

const artwork: Record<string, StatusArtwork> = {
    new: { source: seedPacket },
    planned: { source: seedPacket, overlay: calendar },
    pendingVerification: { source: sownSeed, overlay: magnifier },
    sowed: { source: sownSeed },
    sprouted: { source: seedling },
    firstFlowers: { source: blossom },
    firstFruitSet: { source: firstFruits },
    notSprouted: { source: sownSeed, overlay: statusCross },
    ready: { source: harvestReady },
    harvested: { source: harvestCrate },
    died: { source: wiltedPlant },
    removed: { source: raisedBed, overlay: shovel },
};

export function getPlantStatusArtwork(
    status: string | null | undefined,
): StatusArtwork {
    return status && Object.hasOwn(artwork, status)
        ? artwork[status]
        : { source: information };
}
