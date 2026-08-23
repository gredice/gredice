import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    usePaymentStatusParam,
    useShoppingCartOpenParam,
} from '../useUrlState';

export const temporaryAccountUpgradeRequiredEvent =
    'gredice:temporary-account-upgrade-required';

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
    | { kind: 'upgrade-required' }
    | { kind: 'stripe'; url: string };

async function getCheckoutError(response: Response) {
    try {
        const responseData: unknown = await response.json();
        if (responseData && typeof responseData === 'object') {
            const errorCode =
                'errorCode' in responseData &&
                typeof responseData.errorCode === 'string'
                    ? responseData.errorCode
                    : undefined;
            const message =
                'error' in responseData &&
                typeof responseData.error === 'string' &&
                responseData.error.trim()
                    ? responseData.error
                    : undefined;

            return { errorCode, message };
        }
    } catch {
        // The fallback also covers non-JSON gateway responses.
    }

    return {};
}

const defaultCheckoutErrorMessage =
    'Nije moguće pokrenuti plaćanje. Provjeri košaricu i pokušaj ponovno.';

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

export function requestTemporaryAccountUpgrade() {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(temporaryAccountUpgradeRequiredEvent));
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
                const checkoutError = await getCheckoutError(response);
                if (checkoutError.errorCode === 'upgrade_required') {
                    requestTemporaryAccountUpgrade();
                    return { kind: 'upgrade-required' };
                }

                throw new Error(
                    checkoutError.message ?? defaultCheckoutErrorMessage,
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

            if (!('url' in responseData) || !responseData.url) {
                throw new Error(
                    'Poslužitelj nije vratio poveznicu za plaćanje.',
                );
            }

            return { kind: 'stripe', url: responseData.url };
        },
        onSuccess: (result) => {
            if (result.kind === 'upgrade-required') {
                return;
            }

            if (result.kind === 'stripe') {
                window.location.href = result.url;
                return;
            }

            setShoppingCartOpen(false);
            setPaymentStatus('uspjesno');
            void queryClient.invalidateQueries();
        },
        onError: () => {
            // A direct checkout can fail after durable payment or fulfillment
            // work. Keep the cart open, but reconcile every active checkout-
            // affected view before the user retries.
            void queryClient.invalidateQueries();
        },
        // Prevent the mutation from being run in parallel
        scope: {
            id: 'checkout',
        },
    });
}
