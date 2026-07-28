import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    usePaymentStatusParam,
    useShoppingCartOpenParam,
} from '../useUrlState';

export interface CheckoutData {
    cartId: number;
    deliveryInfo?: {
        slotId: number;
        mode: 'delivery' | 'pickup';
        addressId?: number;
        locationId?: number;
        notes?: string;
    };
    harvestDates?: Array<{
        cartItemId: number;
        scheduledDate: string;
    }>;
}

type CheckoutResult =
    | { kind: 'completed-in-app' }
    | { kind: 'stripe'; url: string };

// Type guard to check if delivery selection is complete
export function isCompleteDeliverySelection(
    selection:
        | Partial<NonNullable<CheckoutData['deliveryInfo']>>
        | null
        | undefined,
): selection is CheckoutData['deliveryInfo'] {
    return (
        Boolean(selection) &&
        selection !== null &&
        selection !== undefined &&
        typeof selection.slotId === 'number' &&
        (selection.mode === 'delivery' || selection.mode === 'pickup') &&
        (selection.mode === 'delivery'
            ? typeof selection.addressId === 'number'
            : typeof selection.locationId === 'number')
    );
}

export function useCheckout() {
    const queryClient = useQueryClient();
    const [, setShoppingCartOpen] = useShoppingCartOpenParam();
    const [, setPaymentStatus] = usePaymentStatusParam();

    return useMutation({
        mutationFn: async (data: CheckoutData): Promise<CheckoutResult> => {
            const response =
                await clientAuthenticated().api.checkout.checkout.$post({
                    json: data,
                });
            if (!response.ok) {
                throw new Error(
                    response.statusText ||
                        'Nije moguće pokrenuti plaćanje. Provjeri odabrane datume.',
                );
            }

            const responseData = await response.json();
            if (!responseData) {
                throw new Error(
                    'Poslužitelj nije vratio podatke za pokretanje plaćanja.',
                );
            }

            if ('success' in responseData) {
                return { kind: 'completed-in-app' };
            }

            const { url } = responseData;
            if (!url) {
                throw new Error(
                    'Poslužitelj nije vratio poveznicu za plaćanje.',
                );
            }

            return { kind: 'stripe', url };
        },
        onSuccess: (result) => {
            if (result.kind === 'stripe') {
                window.location.href = result.url;
                return;
            }

            setShoppingCartOpen(false);
            setPaymentStatus('uspjesno');
            void queryClient.invalidateQueries();
        },
        // Prevent the mutation from being run in parallel
        scope: {
            id: 'checkout',
        },
    });
}
