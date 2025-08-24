import { client } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userOperationsKeys } from './useUserOperations';

export function useCancelOperation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ operationId, reason }: { operationId: number; reason: string }) => {
            try {
                const response = await client().api.operations.cancel.$post({
                    json: {
                        operationId,
                        reason
                    }
                });
                const responseJson = await response.json();

                if ('error' in responseJson) {
                    throw new Error(responseJson.error || 'Failed to cancel operation');
                }

                // Invalidate queries to refresh data
                queryClient.invalidateQueries({ queryKey: userOperationsKeys });
            } catch (error) {
                console.error('Error cancelling operation:', error);
                throw error;
            }
        }
    });
}
