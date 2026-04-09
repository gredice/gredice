import {
    isDeliveryAddressEligibilityError,
    isGoogleMapsUpstreamError,
} from './addressDistance';

export interface AddressVerificationErrorResponse {
    body: {
        error: string;
        details?: string;
    };
    status: 400 | 503 | 504;
}

export function buildAddressVerificationErrorResponse(
    error: unknown,
): AddressVerificationErrorResponse | null {
    if (isDeliveryAddressEligibilityError(error)) {
        return {
            body: {
                error: 'Address is not eligible for delivery',
                details: error.message,
            },
            status: 400,
        };
    }

    if (isGoogleMapsUpstreamError(error)) {
        return {
            body: {
                error: 'Address verification is temporarily unavailable',
            },
            status: error.statusCode,
        };
    }

    return null;
}

export function logAddressVerificationFailure(
    operation: 'create' | 'update',
    error: unknown,
    logger: (
        message?: unknown,
        ...optionalParams: unknown[]
    ) => void = console.error,
): void {
    if (isDeliveryAddressEligibilityError(error)) {
        return;
    }

    logger(`Failed to ${operation} delivery address:`, error);
}
