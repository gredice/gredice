import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { useCurrentGardenIdParam } from '../useUrlState';
import { currentGardenKeys } from './useCurrentGarden';
import { useGardensKeys } from './useGardens';
import { tutorialChecklistKeys } from './useTutorialChecklist';

type DeleteGardenVariables = {
    gardenId: number;
};

type DeleteGardenResponse = {
    complete?: boolean;
};

const mutationKey = ['gardens', 'delete'];
const GARDEN_DELETE_FAILED_MESSAGE =
    'Došlo je do greške prilikom brisanja vrta. Pokušaj ponovno.';
const GARDEN_DELETE_TIMEOUT_MESSAGE =
    'Brisanje vrta nije završilo na vrijeme. Pokušaj ponovno.';
const retryableTimeoutStatuses = new Set([408, 425, 429, 502, 503, 504]);
const maxDeleteAttempts = 1_000;

function waitForRetry() {
    return new Promise((resolve) => setTimeout(resolve, 250));
}

function activeRaisedBedsMessage(count: number) {
    return count === 1
        ? 'Prije brisanja vrta napusti 1 aktivnu gredicu.'
        : `Prije brisanja vrta napusti ${count.toString()} aktivnih gredica.`;
}

async function getDeleteGardenErrorMessage(response: Response) {
    try {
        const body: unknown = await response.json();
        if (
            typeof body === 'object' &&
            body !== null &&
            'activeRaisedBedCount' in body
        ) {
            const { activeRaisedBedCount } = body;
            if (
                typeof activeRaisedBedCount === 'number' &&
                activeRaisedBedCount > 0
            ) {
                return activeRaisedBedsMessage(activeRaisedBedCount);
            }
        }

        if (typeof body === 'object' && body !== null && 'error' in body) {
            const { error } = body;
            if (typeof error === 'string' && error.trim()) {
                return error;
            }
        }
    } catch {
        return GARDEN_DELETE_FAILED_MESSAGE;
    }

    return GARDEN_DELETE_FAILED_MESSAGE;
}

async function getDeleteGardenResponse(
    response: Response,
): Promise<DeleteGardenResponse> {
    try {
        const body: unknown = await response.json();
        if (
            typeof body !== 'object' ||
            body === null ||
            !('complete' in body)
        ) {
            return {};
        }

        const { complete } = body;
        return {
            complete: typeof complete === 'boolean' ? complete : undefined,
        } satisfies DeleteGardenResponse;
    } catch {
        return {};
    }
}

export function useDeleteGarden() {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const [selectedGardenId, setSelectedGardenId] = useCurrentGardenIdParam();

    return useMutation({
        mutationKey,
        mutationFn: async ({ gardenId }: DeleteGardenVariables) => {
            let lastError: unknown;

            for (let attempt = 0; attempt < maxDeleteAttempts; attempt += 1) {
                let response: Awaited<
                    ReturnType<
                        ReturnType<
                            typeof clientAuthenticated
                        >['api']['gardens'][':gardenId']['$delete']
                    >
                >;

                try {
                    response = await clientAuthenticated().api.gardens[
                        ':gardenId'
                    ].$delete({
                        param: {
                            gardenId: gardenId.toString(),
                        },
                    });
                } catch (error) {
                    lastError = error;
                    await waitForRetry();
                    continue;
                }

                if (!response.ok) {
                    if (retryableTimeoutStatuses.has(response.status)) {
                        await waitForRetry();
                        continue;
                    }

                    throw new Error(
                        await getDeleteGardenErrorMessage(response),
                    );
                }

                const result = await getDeleteGardenResponse(response);
                if (result.complete !== false) {
                    return result;
                }

                await waitForRetry();
            }

            if (lastError instanceof Error) {
                throw lastError;
            }

            throw new Error(GARDEN_DELETE_TIMEOUT_MESSAGE);
        },
        onSuccess: async (_data, { gardenId }) => {
            if (selectedGardenId === gardenId) {
                void setSelectedGardenId(null);
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: useGardensKeys }),
                queryClient.invalidateQueries({
                    queryKey: currentGardenKeys(winterMode),
                }),
                queryClient.invalidateQueries({
                    queryKey: tutorialChecklistKeys,
                }),
            ]);
        },
        onError: (error) => {
            console.error('Failed to delete garden:', error);
        },
    });
}
