import { clientAuthenticated } from './hono';

export type SetGardenLikeInput = {
    gardenId: number;
    liked: boolean;
};

export type GardenLikeState = {
    liked: boolean;
    likeCount: number;
};

export async function listGardenLikeIds(): Promise<number[]> {
    const response = await clientAuthenticated().api.gardens.likes.$get();

    if (!response.ok) {
        throw new Error('Failed to fetch liked gardens');
    }

    return (await response.json()).gardenIds;
}

export async function setGardenLike({
    gardenId,
    liked,
}: SetGardenLikeInput): Promise<GardenLikeState> {
    const response = await clientAuthenticated().api.gardens[
        ':gardenId'
    ].like.$put({
        param: { gardenId: gardenId.toString() },
        json: { liked },
    });

    if (response.status === 403) {
        throw new Error('Cannot like own garden');
    }

    if (response.status === 404) {
        throw new Error('Garden was not found');
    }

    if (!response.ok) {
        throw new Error('Failed to update garden like');
    }

    return await response.json();
}
