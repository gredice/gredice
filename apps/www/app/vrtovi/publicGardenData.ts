import { clientPublic } from '@gredice/client';
import { notFound } from 'next/navigation';

export async function getPublicGardensForWww() {
    const response = await clientPublic().api.gardens.public.$get();
    if (!response.ok) {
        notFound();
    }

    return response.json();
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
