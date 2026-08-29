import { clientPublic } from '@gredice/client';
import 'server-only';
import {
    type LandingGardenCandidate,
    landingFeaturedGardenLimit,
} from './landingGardenCarousel';
import { comparePublicGardensByPopularity } from './vrtovi/publicGardenFormatting';

export async function getLandingFeaturedGardens(): Promise<
    LandingGardenCandidate[]
> {
    try {
        const response = await clientPublic().api.gardens.public.$get();
        if (!response.ok) {
            console.error('Failed to fetch featured gardens for landing', {
                status: response.status,
            });
            return [];
        }

        const publicGardens = await response.json();
        const featuredGardenSummaries = publicGardens.items
            .toSorted(comparePublicGardensByPopularity)
            .slice(0, landingFeaturedGardenLimit);
        const featuredGardens = await Promise.all(
            featuredGardenSummaries.map(async (garden) => {
                const gardenResponse = await clientPublic().api.gardens[
                    ':gardenId'
                ].public.$get({
                    param: { gardenId: garden.id.toString() },
                });

                if (!gardenResponse.ok) {
                    console.error('Failed to fetch featured garden details', {
                        gardenId: garden.id,
                        status: gardenResponse.status,
                    });
                    return null;
                }

                return {
                    garden: await gardenResponse.json(),
                    owner: garden.owner ?? null,
                };
            }),
        );

        return featuredGardens.filter((garden) => garden !== null);
    } catch (error) {
        console.error('Failed to prepare featured gardens for landing', error);
        return [];
    }
}
