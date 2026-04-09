import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildDeliveryAddressDistanceUpdate,
    shouldRecalculateDeliveryAddressDistance,
} from './deliveryAddressUpdate';

describe('shouldRecalculateDeliveryAddressDistance', () => {
    it('recalculates when address fields changed', () => {
        const shouldRecalculate = shouldRecalculateDeliveryAddressDistance(
            true,
            {
                latitude: '45.8150',
                longitude: '15.9819',
                roadDistanceKm: '12.500',
                distanceCalculatedAt: new Date('2026-04-09T10:00:00.000Z'),
            },
        );

        assert.strictEqual(shouldRecalculate, true);
    });

    it('recalculates when a legacy address has missing computed fields', () => {
        const shouldRecalculate = shouldRecalculateDeliveryAddressDistance(
            false,
            {
                latitude: '45.8150',
                longitude: null,
                roadDistanceKm: '12.500',
                distanceCalculatedAt: new Date('2026-04-09T10:00:00.000Z'),
            },
        );

        assert.strictEqual(shouldRecalculate, true);
    });

    it('recalculates when the distance timestamp is missing', () => {
        const shouldRecalculate = shouldRecalculateDeliveryAddressDistance(
            false,
            {
                latitude: '45.8150',
                longitude: '15.9819',
                roadDistanceKm: '12.500',
                distanceCalculatedAt: null,
            },
        );

        assert.strictEqual(shouldRecalculate, true);
    });

    it('reuses distance data when the stored verification is complete', () => {
        const shouldRecalculate = shouldRecalculateDeliveryAddressDistance(
            false,
            {
                latitude: '45.8150',
                longitude: '15.9819',
                roadDistanceKm: '12.500',
                distanceCalculatedAt: new Date('2026-04-09T10:00:00.000Z'),
            },
        );

        assert.strictEqual(shouldRecalculate, false);
    });
});

describe('buildDeliveryAddressDistanceUpdate', () => {
    it('keeps the existing distance timestamp when distance is reused', () => {
        const update = buildDeliveryAddressDistanceUpdate(
            {
                latitude: '45.8150',
                longitude: '15.9819',
                roadDistanceKm: '12.500',
            },
            false,
            new Date('2026-04-09T10:00:00.000Z'),
        );

        assert.deepStrictEqual(update, {
            latitude: '45.8150',
            longitude: '15.9819',
            roadDistanceKm: '12.500',
        });
    });

    it('writes a fresh distance timestamp when distance is recalculated', () => {
        const now = new Date('2026-04-09T10:00:00.000Z');
        const update = buildDeliveryAddressDistanceUpdate(
            {
                latitude: '45.8150',
                longitude: '15.9819',
                roadDistanceKm: '12.500',
            },
            true,
            now,
        );

        assert.deepStrictEqual(update, {
            latitude: '45.8150',
            longitude: '15.9819',
            roadDistanceKm: '12.500',
            distanceCalculatedAt: now,
        });
    });

    it('does not write distance fields when verification is skipped', () => {
        const update = buildDeliveryAddressDistanceUpdate(null, false);

        assert.deepStrictEqual(update, {});
    });
});
