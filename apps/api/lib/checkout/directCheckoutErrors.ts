import {
    InsufficientSunflowersError,
    SunflowerSpendAmountConflictError,
} from '@gredice/storage';
import type { CheckoutTimingErrorCategory } from './checkoutTiming';

type DirectCheckoutPaymentErrorResponse = {
    body: {
        code: 'INSUFFICIENT_SUNFLOWERS' | 'SUNFLOWER_SPEND_CONFLICT';
        error: string;
    };
    errorCategory: CheckoutTimingErrorCategory;
    status: 409;
};

export function getDirectCheckoutPaymentErrorResponse(
    error: unknown,
): DirectCheckoutPaymentErrorResponse | null {
    if (error instanceof InsufficientSunflowersError) {
        return {
            body: {
                code: 'INSUFFICIENT_SUNFLOWERS',
                error: 'Nema dovoljno suncokreta za ovu kupnju.',
            },
            errorCategory: 'sunflower_insufficient',
            status: 409,
        };
    }
    if (error instanceof SunflowerSpendAmountConflictError) {
        return {
            body: {
                code: 'SUNFLOWER_SPEND_CONFLICT',
                error: 'Cijena stavke promijenila se tijekom obrade. Osvježi košaricu i pokušaj ponovno.',
            },
            errorCategory: 'sunflower_amount_conflict',
            status: 409,
        };
    }
    return null;
}
