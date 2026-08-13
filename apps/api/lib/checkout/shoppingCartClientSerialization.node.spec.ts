import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advancedSowingCartAuthorizationKind,
    advancedSowingSelectionSummaryKind,
    buildAdvancedSowingCartConfigurationV1,
} from '@gredice/js/plants';
import { serializeShoppingCartItemForClient } from './shoppingCartClientSerialization';

describe('shopping cart client serialization', () => {
    it('omits a server-owned Advanced Sowing envelope from the client payload', () => {
        const serialized = serializeShoppingCartItemForClient({
            additionalData: '{"scheduledDate":"2026-09-01T00:00:00.000Z"}',
            advancedSowingAuthorization: {
                kind: 'advanced-sowing-cart-authorization',
                plan: { selectedDistanceCm: 60 },
                version: 1,
            },
            amount: 1,
            cartId: 2,
            createdAt: new Date('2026-08-10T00:00:00.000Z'),
            currency: 'eur',
            entityData: { id: 3 },
            entityId: '3',
            entityTypeName: 'plantSort',
            gardenId: 4,
            id: 5,
            isDeleted: false,
            positionIndex: 11,
            raisedBedId: 6,
            shopData: { name: 'Tikvica' },
            status: 'new',
            updatedAt: new Date('2026-08-10T00:00:00.000Z'),
        });

        assert.equal(
            Object.hasOwn(serialized, 'advancedSowingAuthorization'),
            false,
        );
        assert.equal(
            serialized.additionalData,
            '{"scheduledDate":"2026-09-01T00:00:00.000Z"}',
        );
    });

    it('exposes only a non-authoritative per-item selection summary', () => {
        const serialized = serializeShoppingCartItemForClient(
            {
                additionalData: null,
                amount: 1,
                cartId: 2,
                createdAt: new Date('2026-08-10T00:00:00.000Z'),
                currency: 'eur',
                entityData: { id: 3 },
                entityId: '3',
                entityTypeName: 'plantSort',
                gardenId: 4,
                id: 5,
                isDeleted: false,
                positionIndex: 11,
                raisedBedId: 6,
                shopData: { name: 'Tikvica' },
                status: 'new',
                updatedAt: new Date('2026-08-10T00:00:00.000Z'),
            },
            {
                kind: advancedSowingCartAuthorizationKind,
                plan: buildAdvancedSowingCartConfigurationV1({
                    anchorPositionIndex: 11,
                    bedFieldCount: 18,
                    maxDistanceCm: 60,
                    minDistanceCm: 15,
                    optimalDistanceCm: 30,
                    selectedDistanceCm: 60,
                }),
                version: 1,
            },
        );

        assert.deepEqual(serialized.advancedSowingSelection, {
            fieldSpanColumns: 2,
            fieldSpanRows: 2,
            kind: advancedSowingSelectionSummaryKind,
            layoutKey: 'v1:fields:2x2:plants:1x1',
            occupiedPositionIndices: [11, 10, 8, 7],
            plantCount: 1,
            selectedDistanceCm: 60,
            version: 1,
        });
        assert.equal(
            Object.hasOwn(serialized, 'advancedSowingAuthorization'),
            false,
        );
    });
});
