import { clientAuthenticated } from '@gredice/client';
import { useMutation } from '@tanstack/react-query';

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
    return useMutation({
        mutationFn: async (data: CheckoutData) => {
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
                window.location.href = '/?placanje=uspjesno';
                return;
            }

            const { url } = responseData;
            if (!url) {
                throw new Error(
                    'Poslužitelj nije vratio poveznicu za plaćanje.',
                );
            }

            // If a URL is provided, redirect the user to that URL
            window.location.href = url;
        },
        // Prevent the mutation from being run in parallel
        scope: {
            id: 'checkout',
        },
    });
}
