import { clientPublic } from '@gredice/client';
import type { PublicGardenDetail } from '@gredice/game';
import 'server-only';
import { comparePublicGardensByPopularity } from './vrtovi/publicGardenFormatting';

const landingFeaturedGardenLimit = 4;

export async function getLandingFeaturedGardens(): Promise<
    PublicGardenDetail[]
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

                return gardenResponse.json();
            }),
        );

        return featuredGardens.filter((garden) => garden !== null);
    } catch (error) {
        console.error('Failed to prepare featured gardens for landing', error);
        return [];
    }
}
