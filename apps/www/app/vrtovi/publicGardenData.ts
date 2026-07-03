import { clientPublic, type PublicGardenResponse } from '@gredice/client';
import { notFound } from 'next/navigation';

function countActivePlantsFromPublicGarden(garden: PublicGardenResponse) {
    return garden.raisedBeds.reduce(
        (total, raisedBed) =>
            total +
            raisedBed.fields.filter(
                (field) =>
                    field.active && typeof field.plantSortId === 'number',
            ).length,
        0,
    );
}

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
            if (Number.isFinite(garden.activePlantCount)) {
                return garden;
            }

            // Support mixed deployments where www expects the new summary field
            // before the API serving /gardens/public has been rolled out.
            const activePlantCount = await getActivePlantCountFallback(
                garden.id,
            );
            if (typeof activePlantCount !== 'number') {
                return garden;
            }

            return {
                ...garden,
                activePlantCount,
            };
        }),
    );

    return {
        ...publicGardens,
        items,
    };
}

export async function getPublicGardenForWww(gardenId: number) {
    const response = await clientPublic().api.gardens[':gardenId'].public.$get({
        param: { gardenId: gardenId.toString() },
    });
    if (!response.ok) {
        notFound();
    }

    return response.json();
}
