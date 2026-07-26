import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const harvestScheduleQueryKey = ['shopping-cart', 'harvest-schedule'];

export function useHarvestSchedule(
    deliverySlotId: number | undefined,
    enabled = true,
) {
    return useQuery({
        queryKey: [...harvestScheduleQueryKey, deliverySlotId],
        queryFn: async () => {
            if (deliverySlotId === undefined) {
                throw new Error('Delivery slot is required');
            }

            const response = await clientAuthenticated().api['shopping-cart'][
                'harvest-schedule'
            ].$get({
                query: {
                    slotId: deliverySlotId.toString(),
                },
            });

            if (!response.ok) {
                throw new Error(
                    'Nije moguće provjeriti raspored branja za odabrani termin.',
                );
            }

            return response.json();
        },
        enabled: enabled && deliverySlotId !== undefined,
        retry: false,
        staleTime: 0,
    });
}

export type HarvestScheduleData = NonNullable<
    Awaited<ReturnType<typeof useHarvestSchedule>['data']>
>;
