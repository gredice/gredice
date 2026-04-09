import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    DeliveryAddressEligibilityError,
    GoogleMapsUpstreamError,
} from './addressDistance';
import {
    buildAddressVerificationErrorResponse,
    logAddressVerificationFailure,
} from './addressVerificationError';

describe('buildAddressVerificationErrorResponse', () => {
    it('returns safe eligibility details for client validation errors', () => {
        const response = buildAddressVerificationErrorResponse(
            new DeliveryAddressEligibilityError(
                'Address is outside the delivery zone',
            ),
        );

        assert.deepStrictEqual(response, {
            body: {
                error: 'Address is not eligible for delivery',
                details: 'Address is outside the delivery zone',
            },
            status: 400,
        });
    });

    it('omits raw upstream details from client responses', () => {
        const response = buildAddressVerificationErrorResponse(
            new GoogleMapsUpstreamError(
                'Google geocoding request failed with status OVER_QUERY_LIMIT: billing disabled',
                503,
            ),
        );

        assert.deepStrictEqual(response, {
            body: {
                error: 'Address verification is temporarily unavailable',
            },
            status: 503,
        });
    });

    it('returns null for unexpected failures so they can bubble as 5xx', () => {
        assert.strictEqual(
            buildAddressVerificationErrorResponse(
                new Error('GREDICE_GOOGLE_MAPS_API_KEY is not configured'),
            ),
            null,
        );
    });
});

describe('logAddressVerificationFailure', () => {
    it('skips logging expected eligibility failures', () => {
        const calls: unknown[][] = [];

        logAddressVerificationFailure(
            'create',
            new DeliveryAddressEligibilityError('Address could not be located'),
            (...args) => {
                calls.push(args);
            },
        );

        assert.deepStrictEqual(calls, []);
    });

    it('logs upstream failures with the full error object', () => {
        const calls: unknown[][] = [];
        const error = new GoogleMapsUpstreamError(
            'Google distance matrix request timed out after 5000ms',
            504,
        );

        logAddressVerificationFailure('update', error, (...args) => {
            calls.push(args);
        });

        assert.deepStrictEqual(calls, [
            ['Failed to update delivery address:', error],
        ]);
    });
});
