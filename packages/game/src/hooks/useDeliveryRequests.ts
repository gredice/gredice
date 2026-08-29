import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';
import { useOptionalGameState } from '../useGameState';

export const deliveryRequestsQueryKey = ['delivery', 'requests'];

export function useDeliveryRequests(options: { enabled?: boolean } = {}) {
    const authenticatedGardenQueriesEnabled = useOptionalGameState(
        (state) => state.authenticatedGardenQueriesEnabled,
        true,
    );

    return useQuery({
        queryKey: deliveryRequestsQueryKey,
        enabled: authenticatedGardenQueriesEnabled && (options.enabled ?? true),
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.delivery.requests.$get();
            if (response.status !== 200) {
                throw new Error('Failed to fetch delivery requests');
            }
            return await response.json();
        },
    });
}

export type DeliveryRequestData = NonNullable<
    Awaited<ReturnType<typeof useDeliveryRequests>['data']>
>[0];
