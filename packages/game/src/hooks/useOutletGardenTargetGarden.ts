import { clientAuthenticated, type GardenResponse } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { createGardenPosition, type GardenStack } from '../types/Stack';

export const outletGardenTargetGardenQueryKey = (gardenId: number | null) => [
    'gardens',
    'outlet-target',
    gardenId,
];

type OutletGardenTargetGardenResponse = Pick<
    GardenResponse,
    'id' | 'isSandbox' | 'raisedBeds' | 'stacks'
>;

export class OutletGardenAuthenticationRequiredError extends Error {
    override readonly name = 'OutletGardenAuthenticationRequiredError';
}

export function normalizeOutletGardenTargetGarden(
    garden: OutletGardenTargetGardenResponse,
) {
    const stacks: GardenStack[] = [];

    for (const [x, yPositions] of Object.entries(garden.stacks ?? {})) {
        for (const [y, blocks] of Object.entries(yPositions)) {
            stacks.push({
                position: createGardenPosition(Number(x), 0, Number(y)),
                blocks: (blocks ?? []).map((block) => ({
                    id: block.id,
                    message: block.message,
                    name: block.name,
                    rotation: block.rotation ?? 0,
                    variant: block.variant,
                })),
            });
        }
    }

    return {
        id: garden.id,
        isSandbox: garden.isSandbox,
        raisedBeds: garden.raisedBeds,
        stacks,
    };
}

export function useOutletGardenTargetGarden(gardenId: number | null) {
    return useQuery({
        enabled:
            gardenId !== null && Number.isSafeInteger(gardenId) && gardenId > 0,
        queryFn: async () => {
            if (gardenId === null) {
                return null;
            }

            const response = await clientAuthenticated().api.gardens[
                ':gardenId'
            ].$get({
                param: { gardenId: gardenId.toString() },
            });
            if (response.status === 401) {
                throw new OutletGardenAuthenticationRequiredError(
                    'Outlet target garden authentication expired',
                );
            }
            if (response.status === 404) {
                return null;
            }
            if (response.status !== 200) {
                throw new Error('Failed to fetch Outlet target garden');
            }

            return normalizeOutletGardenTargetGarden(await response.json());
        },
        queryKey: outletGardenTargetGardenQueryKey(gardenId),
        retry: false,
        staleTime: 60_000,
    });
}
