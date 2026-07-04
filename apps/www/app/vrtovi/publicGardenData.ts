import { clientPublic, directoriesClient } from '@gredice/client';
import { notFound } from 'next/navigation';
import { countActivePlantsFromPublicGarden } from './publicGardenFormatting';

async function getActivePlantCountFallback(gardenId: number) {
    const response = await clientPublic().api.gardens[':gardenId'].public.$get({
        param: { gardenId: gardenId.toString() },
    });
    if (!response.ok) {
        return undefined;
    }

    return countActivePlantsFromPublicGarden(await response.json());
}

export async function getPublicGardensForWww() {
    const response = await clientPublic().api.gardens.public.$get();
    if (!response.ok) {
        notFound();
    }

    const publicGardens = await response.json();
    const items = await Promise.all(
        publicGardens.items.map(async (garden) => {
            const likeCount = Number.isFinite(garden.likeCount)
                ? garden.likeCount
                : 0;

            if (Number.isFinite(garden.activePlantCount)) {
                return {
                    ...garden,
                    likeCount,
                };
            }

            // Support mixed deployments where www expects the new summary field
            // before the API serving /gardens/public has been rolled out.
            const activePlantCount = await getActivePlantCountFallback(
                garden.id,
            );
            if (typeof activePlantCount !== 'number') {
                return {
                    ...garden,
                    likeCount,
                };
            }

            return {
                ...garden,
                activePlantCount,
                likeCount,
            };
        }),
    );

    return {
        ...publicGardens,
        items,
    };
}

export async function getPublicGardenBlockDataForWww() {
    try {
        const { data, error } =
            await directoriesClient().GET('/entities/block');
        if (error) {
            console.error('Failed to fetch public garden block data', error);
            return undefined;
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch public garden block data', error);
        return undefined;
    }
}

export async function getPublicGardenForWww(gardenId: number) {
    const response = await clientPublic().api.gardens[':gardenId'].public.$get({
        param: { gardenId: gardenId.toString() },
    });
    if (!response.ok) {
        notFound();
    }

    const garden = await response.json();
    return {
        ...garden,
        likeCount: Number.isFinite(garden.likeCount) ? garden.likeCount : 0,
    };
}
