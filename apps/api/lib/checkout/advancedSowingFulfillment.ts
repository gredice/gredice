import { createHash } from 'node:crypto';
import {
    type AdvancedSowingCartAuthorizationV1,
    parseAdvancedSowingCartAuthorizationV1,
} from '@gredice/js/plants';
import type {
    CreateSelectedRaisedBedPlantingInput,
    RaisedBedFieldPlantPurchase,
    RaisedBedFieldSowingLocation,
} from '@gredice/storage';

export class AdvancedSowingFulfillmentInputError extends Error {
    override readonly name = 'AdvancedSowingFulfillmentInputError';
}

type CheckoutRaisedBedField = {
    id: number;
    positionIndex: number;
};

function positiveSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new AdvancedSowingFulfillmentInputError(
            `${label} must be a positive safe integer.`,
        );
    }
    return value;
}

function nonNegativeSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new AdvancedSowingFulfillmentInputError(
            `${label} must be a non-negative safe integer.`,
        );
    }
    return value;
}

function normalizeScheduledDate(value: string | null) {
    if (value === null) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new AdvancedSowingFulfillmentInputError(
            'Scheduled date must be a valid date.',
        );
    }
    return parsed.toISOString();
}

function normalizeSowingLocation(value: RaisedBedFieldSowingLocation) {
    if (value !== 'direct' && value !== 'greenhouse') {
        throw new AdvancedSowingFulfillmentInputError(
            'Sowing location must be direct or greenhouse.',
        );
    }
    return value;
}

function indexRaisedBedFields(
    fields: readonly CheckoutRaisedBedField[],
    bedFieldCount: number,
) {
    const fieldsByPositionIndex = new Map<number, CheckoutRaisedBedField>();
    const fieldIds = new Set<number>();
    for (const field of fields) {
        positiveSafeInteger(field.id, 'Raised-bed field ID');
        nonNegativeSafeInteger(
            field.positionIndex,
            'Raised-bed field position index',
        );
        if (
            field.positionIndex >= bedFieldCount ||
            fieldsByPositionIndex.has(field.positionIndex) ||
            fieldIds.has(field.id)
        ) {
            throw new AdvancedSowingFulfillmentInputError(
                'Raised-bed fields must be unique and fit the paid snapshot geometry.',
            );
        }
        fieldsByPositionIndex.set(field.positionIndex, field);
        fieldIds.add(field.id);
    }
    return fieldsByPositionIndex;
}

export function selectedPlantingAggregateIdForCartItem(cartItemId: number) {
    return `raised-bed-planting:cart-item:${positiveSafeInteger(cartItemId, 'Cart item ID').toString()}`;
}

export function selectedPlantingInitialCommandIdForCartItem(
    cartItemId: number,
) {
    const digest = createHash('sha1')
        .update(
            `gredice:advanced-sowing:cart-item:${positiveSafeInteger(cartItemId, 'Cart item ID').toString()}`,
        )
        .digest()
        .subarray(0, 16);
    digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
    digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;
    const hex = digest.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Converts the immutable paid checkout snapshot into the canonical storage
 * command. It never reads current catalogue values: density and footprint are
 * taken only from the server-owned snapshot captured before payment.
 */
export function buildSelectedPlantingFromPaidCheckout({
    authorization: authorizationValue,
    cartItemId,
    bedFieldCount,
    fields,
    plantSortId,
    positionIndex,
    purchase,
    raisedBedId,
    scheduledDate,
    sowingLocation,
}: {
    authorization: AdvancedSowingCartAuthorizationV1;
    bedFieldCount: number;
    cartItemId: number;
    fields: readonly CheckoutRaisedBedField[];
    plantSortId: number;
    positionIndex: number;
    purchase?: RaisedBedFieldPlantPurchase;
    raisedBedId: number;
    scheduledDate: string | null;
    sowingLocation: RaisedBedFieldSowingLocation;
}): CreateSelectedRaisedBedPlantingInput {
    let authorization: AdvancedSowingCartAuthorizationV1;
    try {
        authorization =
            parseAdvancedSowingCartAuthorizationV1(authorizationValue);
    } catch {
        throw new AdvancedSowingFulfillmentInputError(
            'Paid Advanced Sowing authorization is invalid.',
        );
    }

    const validCartItemId = positiveSafeInteger(cartItemId, 'Cart item ID');
    const validPlantSortId = positiveSafeInteger(plantSortId, 'Plant sort ID');
    const validRaisedBedId = positiveSafeInteger(raisedBedId, 'Raised bed ID');
    const plan = authorization.plan;
    const validBedFieldCount = positiveSafeInteger(
        bedFieldCount,
        'Raised-bed field count',
    );
    const validPositionIndex = nonNegativeSafeInteger(
        positionIndex,
        'Anchor position index',
    );
    if (
        plan.bedFieldCount !== validBedFieldCount ||
        plan.anchorPositionIndex !== validPositionIndex
    ) {
        throw new AdvancedSowingFulfillmentInputError(
            'Paid Advanced Sowing snapshot does not match the checkout target.',
        );
    }
    const fieldsByPositionIndex = indexRaisedBedFields(
        fields,
        validBedFieldCount,
    );
    const memberships = plan.occupiedPositionIndices.map(
        (positionIndex, index) => {
            const field = fieldsByPositionIndex.get(positionIndex);
            if (!field) {
                throw new AdvancedSowingFulfillmentInputError(
                    'A paid Advanced Sowing footprint field is unavailable.',
                );
            }
            return {
                raisedBedFieldId: field.id,
                relativeRow: Math.floor(index / plan.fieldSpanColumns),
                relativeColumn: index % plan.fieldSpanColumns,
                isAnchor: positionIndex === plan.anchorPositionIndex,
            };
        },
    );
    if (memberships.filter((membership) => membership.isAnchor).length !== 1) {
        throw new AdvancedSowingFulfillmentInputError(
            'Paid Advanced Sowing footprint does not contain one anchor.',
        );
    }

    return {
        raisedBedId: validRaisedBedId,
        plantSortId: validPlantSortId,
        eventAggregateId:
            selectedPlantingAggregateIdForCartItem(validCartItemId),
        anchorPositionIndex: plan.anchorPositionIndex,
        configurationSource: 'selected',
        minSeedingDistanceCm: plan.minDistanceCm,
        optimalSeedingDistanceCm: plan.optimalDistanceCm,
        maxSeedingDistanceCm: plan.maxDistanceCm,
        selectedSeedingDistanceCm: plan.selectedDistanceCm,
        plantsPerAxis: plan.plantsPerAxis,
        plantCount: plan.plantCount,
        layoutKey: plan.layoutKey,
        spanRows: plan.fieldSpanRows,
        spanColumns: plan.fieldSpanColumns,
        layoutVersion: plan.version,
        isActive: true,
        memberships,
        lifecycleStarted: {
            commandId:
                selectedPlantingInitialCommandIdForCartItem(validCartItemId),
            scheduledDate: normalizeScheduledDate(scheduledDate),
            sowingLocation: normalizeSowingLocation(sowingLocation),
            ...(purchase ? { purchase } : {}),
            startedBy: 'system:checkout',
        },
    };
}
