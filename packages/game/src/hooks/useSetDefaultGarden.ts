import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    type GardenAccountGroups,
    gardenAccountGroupsKeys,
} from './useGardenAccountGroups';

type SetDefaultGardenVariables = {
    gardenId: number;
};

export function useSetDefaultGarden() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ gardenId }: SetDefaultGardenVariables) => {
            const response =
                await clientAuthenticated().api.accounts.gardens.default.$put({
                    json: { gardenId },
                });
            if (!response.ok) {
                throw new Error(
                    `Failed to set default garden: ${response.status} ${response.statusText}`,
                );
            }
            return response.json();
        },
        onMutate: async ({ gardenId }) => {
            await queryClient.cancelQueries({
                queryKey: gardenAccountGroupsKeys,
            });
            const previousGroups =
                queryClient.getQueryData<GardenAccountGroups>(
                    gardenAccountGroupsKeys,
                );

            queryClient.setQueryData<GardenAccountGroups>(
                gardenAccountGroupsKeys,
                (groups) =>
                    groups?.map((group) => ({
                        ...group,
                        gardens: group.gardens.map((garden) => ({
                            ...garden,
                            isDefault: garden.id === gardenId,
                        })),
                    })),
            );

            return { previousGroups };
        },
        onError: (error, _variables, context) => {
            console.error('Failed to set default garden:', error);
            queryClient.setQueryData(
                gardenAccountGroupsKeys,
                context?.previousGroups,
            );
        },
        onSettled: () => {
            void queryClient.invalidateQueries({
                exact: true,
                queryKey: gardenAccountGroupsKeys,
            });
        },
    });
}
