import { clientPublic } from '@gredice/client';
import { notFound } from 'next/navigation';
import { publicGardensFlag } from '../flags';

export async function getPublicGardensForWww() {
    if (!(await publicGardensFlag())) {
        notFound();
    }

    const response = await clientPublic().api.gardens.public.$get();
    if (!response.ok) {
        notFound();
    }

    return response.json();
}

export async function getPublicGardenForWww(gardenId: number) {
    if (!(await publicGardensFlag())) {
        notFound();
    }

    const response = await clientPublic().api.gardens[':gardenId'].public.$get({
        param: { gardenId: gardenId.toString() },
    });
    if (!response.ok) {
        notFound();
    }

    return response.json();
}
