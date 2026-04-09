import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { EntityStandardized } from '@gredice/storage';
import {
    buildAddressString,
    buildGoogleMapsRequestUrl,
    createGoogleStatusError,
    DeliveryAddressEligibilityError,
    extractHqLocationConfig,
    fetchGoogleMapsResponse,
    GoogleMapsUpstreamError,
    getHeadquarterConfig,
    isAddressDistanceVerificationEnabled,
    isDeliveryAddressEligibilityError,
    isGoogleMapsUpstreamError,
    resetHeadquarterConfigCacheForTests,
    validateDeliveryDistanceLimit,
} from './addressDistance';

const originalAddressDistanceVerification =
    process.env.addressDistanceVerification;
const originalLegacyAddressDistanceVerification =
    process.env.ADDRESS_DISTANCE_VERIFICATION;
const originalMaximumDeliveryDistanceKm =
    process.env.GREDICE_DELIVERY_MAX_DISTANCE_KM;
const originalGoogleMapsUrlSigningSecret =
    process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET;

function restoreEnv(): void {
    if (originalAddressDistanceVerification === undefined) {
        delete process.env.addressDistanceVerification;
    } else {
        process.env.addressDistanceVerification =
            originalAddressDistanceVerification;
    }

    if (originalLegacyAddressDistanceVerification === undefined) {
        delete process.env.ADDRESS_DISTANCE_VERIFICATION;
    } else {
        process.env.ADDRESS_DISTANCE_VERIFICATION =
            originalLegacyAddressDistanceVerification;
    }

    if (originalMaximumDeliveryDistanceKm === undefined) {
        delete process.env.GREDICE_DELIVERY_MAX_DISTANCE_KM;
    } else {
        process.env.GREDICE_DELIVERY_MAX_DISTANCE_KM =
            originalMaximumDeliveryDistanceKm;
    }

    if (originalGoogleMapsUrlSigningSecret === undefined) {
        delete process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET;
    } else {
        process.env.GREDICE_GOOGLE_MAPS_URL_SIGNING_SECRET =
            originalGoogleMapsUrlSigningSecret;
    }
}

function createHqEntity(input?: {
    id?: number;
    attributes?: EntityStandardized['attributes'];
    information?: EntityStandardized['information'];
}): EntityStandardized {
    return {
        id: input?.id ?? 1,
        attributes: input?.attributes,
        information: input?.information,
    };
}

beforeEach(() => {
    restoreEnv();
    resetHeadquarterConfigCacheForTests();
});

afterEach(() => {
    restoreEnv();
    resetHeadquarterConfigCacheForTests();
});

describe('isDeliveryAddressEligibilityError', () => {
    it('recognizes delivery eligibility errors', () => {
        const error = new DeliveryAddressEligibilityError(
            'Address is outside the delivery zone',
        );

        assert.strictEqual(isDeliveryAddressEligibilityError(error), true);
    });

    it('does not classify generic failures as eligibility errors', () => {
        assert.strictEqual(
            isDeliveryAddressEligibilityError(
                new Error('database write failed'),
            ),
            false,
        );
        assert.strictEqual(isDeliveryAddressEligibilityError('failure'), false);
    });
});

describe('isGoogleMapsUpstreamError', () => {
    it('recognizes Google upstream errors', () => {
        const error = new GoogleMapsUpstreamError(
            'Google geocoding request timed out after 50ms',
            504,
        );

        assert.strictEqual(isGoogleMapsUpstreamError(error), true);
    });

    it('does not classify delivery eligibility failures as upstream errors', () => {
        assert.strictEqual(
            isGoogleMapsUpstreamError(
                new DeliveryAddressEligibilityError('Address not eligible'),
            ),
            false,
        );
        assert.strictEqual(isGoogleMapsUpstreamError('failure'), false);
    });
});

describe('isAddressDistanceVerificationEnabled', () => {
    it('prefers the primary env var when it is set', () => {
        process.env.addressDistanceVerification = ' false ';
        process.env.ADDRESS_DISTANCE_VERIFICATION = 'true';

        assert.strictEqual(isAddressDistanceVerificationEnabled(), false);
    });

    it('falls back to the legacy env var when the primary one is absent', () => {
        delete process.env.addressDistanceVerification;
        process.env.ADDRESS_DISTANCE_VERIFICATION = '1';

        assert.strictEqual(isAddressDistanceVerificationEnabled(), true);
    });
});

describe('buildAddressString', () => {
    it('joins address parts in a stable order and skips blank optional values', () => {
        const address = buildAddressString({
            street1: 'Green Road 7',
            street2: '   ',
            city: 'Bjelovar',
            postalCode: '43000',
            countryCode: 'HR',
        });

        assert.strictEqual(address, 'Green Road 7, 43000, Bjelovar, HR');
    });
});

describe('buildGoogleMapsRequestUrl', () => {
    it('returns an unsigned Google Maps request when no signing secret is configured', () => {
        const requestUrl = buildGoogleMapsRequestUrl(
            'https://maps.googleapis.com/maps/api/geocode/json',
            new URLSearchParams({
                address: 'Bjelovar, HR',
                key: 'AIzaFake',
            }),
        );

        assert.strictEqual(
            requestUrl,
            'https://maps.googleapis.com/maps/api/geocode/json?address=Bjelovar%2C+HR&key=AIzaFake',
        );
    });

    it('signs the path and query with the configured URL signing secret', () => {
        const requestUrl = buildGoogleMapsRequestUrl(
            'https://maps.googleapis.com/maps/api/geocode/json',
            new URLSearchParams({
                address: 'Zürich',
                key: 'AIzaFake',
            }),
            'vNIXE0xscrmjlyV-12Nj_BvUPaw=',
        );

        assert.strictEqual(
            requestUrl,
            'https://maps.googleapis.com/maps/api/geocode/json?address=Z%C3%BCrich&key=AIzaFake&signature=UgrR6bA3cePtL9cbfYSkKetxqZo%3D',
        );
    });
});

describe('extractHqLocationConfig', () => {
    it('reads coordinates from attributes and falls back to the env max distance', () => {
        process.env.GREDICE_DELIVERY_MAX_DISTANCE_KM = '25';

        const config = extractHqLocationConfig(
            createHqEntity({
                attributes: {
                    latitude: '45.815',
                    longitude: '16.000',
                },
            }),
        );

        assert.deepStrictEqual(config, {
            latitude: 45.815,
            longitude: 16,
            maxDistanceKm: 25,
        });
    });

    it('falls back to information lat/lng values when attributes are missing', () => {
        const information = {
            lat: 45.9,
            lng: 16.1,
        };

        const config = extractHqLocationConfig(
            createHqEntity({
                information,
                attributes: {
                    maxDistanceKm: 18,
                },
            }),
        );

        assert.deepStrictEqual(config, {
            latitude: 45.9,
            longitude: 16.1,
            maxDistanceKm: 18,
        });
    });
});

describe('getHeadquarterConfig', () => {
    it('caches the first HQ config until the ttl expires', async () => {
        let calls = 0;
        let now = 1_000;

        const firstEntity = createHqEntity({
            attributes: {
                latitude: 45.8,
                longitude: 16,
                maxDistanceKm: 20,
            },
        });
        const secondEntity = createHqEntity({
            id: 2,
            attributes: {
                latitude: 46.1,
                longitude: 16.5,
                maxDistanceKm: 35,
            },
        });

        const getEntitiesFormattedImpl = async () => {
            calls += 1;
            return [calls === 1 ? firstEntity : secondEntity];
        };

        const firstConfig = await getHeadquarterConfig({
            getEntitiesFormattedImpl,
            now: () => now,
        });
        const cachedConfig = await getHeadquarterConfig({
            getEntitiesFormattedImpl,
            now: () => now + 60_000,
        });

        now += 5 * 60 * 1000 + 1;

        const refreshedConfig = await getHeadquarterConfig({
            getEntitiesFormattedImpl,
            now: () => now,
        });

        assert.deepStrictEqual(firstConfig, {
            latitude: 45.8,
            longitude: 16,
            maxDistanceKm: 20,
        });
        assert.deepStrictEqual(cachedConfig, firstConfig);
        assert.deepStrictEqual(refreshedConfig, {
            latitude: 46.1,
            longitude: 16.5,
            maxDistanceKm: 35,
        });
        assert.strictEqual(calls, 2);
    });

    it('throws when no HQ location exists', async () => {
        await assert.rejects(
            getHeadquarterConfig({
                getEntitiesFormattedImpl: async () => [],
                now: () => 1_000,
            }),
            /No HQ location found/,
        );
    });
});

describe('createGoogleStatusError', () => {
    it('maps ZERO_RESULTS to a delivery eligibility error', () => {
        const error = createGoogleStatusError(
            'Google geocoding request',
            'ZERO_RESULTS',
        );

        assert.strictEqual(
            error instanceof DeliveryAddressEligibilityError,
            true,
        );

        if (!(error instanceof DeliveryAddressEligibilityError)) {
            return;
        }

        assert.strictEqual(error.message, 'Address could not be located');
    });

    it('maps unexpected Google statuses to upstream errors', () => {
        const error = createGoogleStatusError(
            'Google distance matrix request',
            'OVER_QUERY_LIMIT',
            'daily quota exceeded',
        );

        assert.strictEqual(error instanceof GoogleMapsUpstreamError, true);

        if (!(error instanceof GoogleMapsUpstreamError)) {
            return;
        }

        assert.strictEqual(error.statusCode, 503);
        assert.match(error.message, /OVER_QUERY_LIMIT/);
        assert.match(error.message, /daily quota exceeded/);
    });
});

describe('validateDeliveryDistanceLimit', () => {
    it('rejects distances beyond the cached HQ max distance', async () => {
        await getHeadquarterConfig({
            getEntitiesFormattedImpl: async () => [
                createHqEntity({
                    attributes: {
                        latitude: 45.8,
                        longitude: 16,
                        maxDistanceKm: 25,
                    },
                }),
            ],
            now: () => Date.now(),
        });

        await assert.rejects(validateDeliveryDistanceLimit('26'), (error) => {
            assert.strictEqual(
                error instanceof DeliveryAddressEligibilityError,
                true,
            );

            if (!(error instanceof DeliveryAddressEligibilityError)) {
                return false;
            }

            assert.match(error.message, /26\.0km > 25km/);
            return true;
        });
    });
});

describe('fetchGoogleMapsResponse', () => {
    it('retries retryable HTTP responses before succeeding', async () => {
        let attempts = 0;

        const response = await fetchGoogleMapsResponse(
            'https://example.test/geocode',
            'Google geocoding request',
            {
                fetchImpl: async () => {
                    attempts += 1;

                    if (attempts === 1) {
                        return new Response('retry later', { status: 503 });
                    }

                    return new Response('{}', { status: 200 });
                },
                maxAttempts: 2,
                retryBaseDelayMs: 0,
                timeoutMs: 50,
            },
        );

        assert.strictEqual(response.status, 200);
        assert.strictEqual(attempts, 2);
    });

    it('does not retry non-retryable HTTP responses', async () => {
        let attempts = 0;

        await assert.rejects(
            fetchGoogleMapsResponse(
                'https://example.test/geocode',
                'Google geocoding request',
                {
                    fetchImpl: async () => {
                        attempts += 1;
                        return new Response('bad request', { status: 400 });
                    },
                    maxAttempts: 2,
                    retryBaseDelayMs: 0,
                    timeoutMs: 50,
                },
            ),
            (error) => {
                assert.strictEqual(
                    error instanceof GoogleMapsUpstreamError,
                    true,
                );

                if (!(error instanceof GoogleMapsUpstreamError)) {
                    return false;
                }

                assert.strictEqual(error.statusCode, 503);
                assert.match(error.message, /status 400/);
                return true;
            },
        );

        assert.strictEqual(attempts, 1);
    });

    it('throws a 504 upstream error when the request times out', async () => {
        await assert.rejects(
            fetchGoogleMapsResponse(
                'https://example.test/geocode',
                'Google geocoding request',
                {
                    fetchImpl: async (_url, init) =>
                        await new Promise<Response>((_resolve, reject) => {
                            init?.signal?.addEventListener(
                                'abort',
                                () => {
                                    reject(
                                        new DOMException(
                                            'Aborted',
                                            'AbortError',
                                        ),
                                    );
                                },
                                { once: true },
                            );
                        }),
                    maxAttempts: 2,
                    retryBaseDelayMs: 0,
                    timeoutMs: 10,
                },
            ),
            (error) => {
                assert.strictEqual(
                    error instanceof GoogleMapsUpstreamError,
                    true,
                );

                if (!(error instanceof GoogleMapsUpstreamError)) {
                    return false;
                }

                assert.strictEqual(error.statusCode, 504);
                assert.match(error.message, /timed out after 10ms/);
                return true;
            },
        );
    });
});
