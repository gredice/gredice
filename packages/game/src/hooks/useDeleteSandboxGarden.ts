import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameState } from '../useGameState';
import { currentGardenKeys } from './useCurrentGarden';
import { useGardensKeys } from './useGardens';

type DeleteSandboxGardenVariables = {
    gardenId: number;
};

type DeleteSandboxGardenResponse = {
    success: boolean;
    complete?: boolean;
};

const mutationKey = ['gardens', 'sandboxDelete'];
const retryableTimeoutStatuses = new Set([408, 425, 429, 502, 503, 504]);
const maxDeleteAttempts = 1_000;

function waitForRetry() {
    return new Promise((resolve) => setTimeout(resolve, 250));
}

export function useDeleteSandboxGarden() {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const gardenQueryKey = currentGardenKeys(winterMode);

    return useMutation({
        mutationKey,
        mutationFn: async ({ gardenId }: DeleteSandboxGardenVariables) => {
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
                        `Failed to delete sandbox garden: ${response.status} ${response.statusText}`,
                    );
                }

                const result: DeleteSandboxGardenResponse =
                    await response.json();
                if (result.complete !== false) {
                    return result;
                }

                await waitForRetry();
            }

            if (lastError instanceof Error) {
                throw lastError;
            }

            throw new Error('Sandbox garden deletion did not complete in time');
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: useGardensKeys });
            await queryClient.invalidateQueries({ queryKey: gardenQueryKey });
        },
        onError: (error) => {
            console.error('Failed to delete sandbox garden:', error);
        },
    });
}
