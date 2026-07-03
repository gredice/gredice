import { KnownPages } from '../../src/KnownPages';

export function getPublicGardenOgImageUrl(gardenId: number) {
    return `${KnownPages.GardenApp}${KnownPages.PublicGarden(gardenId)}/opengraph-image`;
}
