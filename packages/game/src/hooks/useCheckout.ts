import { client } from '@gredice/client';
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
}

// Type guard to check if delivery selection is complete
export function isCompleteDeliverySelection(
    // biome-ignore lint/suspicious/noExplicitAny: Valid for validation
    selection: any,
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
            const response = await client().api.checkout.checkout.$post({
                json: data,
            });
            if (!response.ok) {
                console.error(
                    'Failed to create checkout session:',
                    response.statusText,
                );
                // TODO: Show notification to user
                return;
            }

            const responseData = await response.json();
            if (!responseData) {
                console.error('Failed to create checkout session');
                return;
            }

            if ('success' in responseData) {
                window.location.href = '/?placanje=uspijesno';
                return;
            }

            const { url } = responseData;
            if (!url) {
                console.error('No URL returned from checkout session');
                // TODO: Show notification to user
                return;
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
