import { KnownPages } from '../../src/KnownPages';

const publicGardenOgImageVersion = '2';

export function getPublicGardenOgImageUrl(gardenId: number) {
    const url = new URL(
        `${KnownPages.GardenApp}${KnownPages.PublicGarden(gardenId)}/opengraph-image`,
    );
    url.searchParams.set('v', publicGardenOgImageVersion);
    return url.toString();
}
