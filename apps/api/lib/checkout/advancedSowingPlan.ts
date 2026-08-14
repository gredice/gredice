import {
    ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
    type AdvancedSowingCartAuthorizationV1,
    type AdvancedSowingCartConfigurationV1,
    type AdvancedSowingDistanceRangeInput,
    type AdvancedSowingSelectionRequestV1,
    advancedSowingCartAuthorizationKind,
    buildAdvancedSowingCartConfigurationV1,
    getAdvancedSowingLayoutOptions,
    parseAdvancedSowingCartAuthorizationV1,
    parseAdvancedSowingSelectionRequestV1,
    resolveAdvancedSowingDistanceRange,
} from '@gredice/js/plants';

export {
    type AdvancedSowingCartAuthorizationV1,
    type AdvancedSowingSelectionRequestV1,
    advancedSowingCartAuthorizationKind,
    advancedSowingSelectionRequestKind,
} from '@gredice/js/plants';
export const advancedSowingCartAuthorizationKey =
    'advancedSowingAuthorization' as const;

const legacyUntrustedAdvancedSowingKey = 'advancedSowing';

export type AdvancedSowingPlanReasonCode =
    | 'catalogue_mismatch'
    | 'footprint_out_of_bounds'
    | 'invalid_authorization'
    | 'invalid_json'
    | 'invalid_request'
    | 'layout_conflict'
    | 'legacy_layout_unknown'
    | 'plant_operation_conflict'
    | 'reserved_additional_data'
    | 'spacing_out_of_range'
    | 'target_mismatch';

export type AdvancedSowingCartTarget = {
    positionIndex: number;
    bedFieldCount: number;
};

export function buildAdvancedSowingSupportedCartTarget(
    positionIndex: unknown,
): AdvancedSowingCartTarget {
    if (
        typeof positionIndex !== 'number' ||
        !Number.isSafeInteger(positionIndex) ||
        positionIndex < 0 ||
        positionIndex >= ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT
    ) {
        throw new AdvancedSowingPlanBoundaryError('target_mismatch');
    }
    return {
        bedFieldCount: ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
        positionIndex,
    };
}

export function readAdvancedSowingCatalogueDistanceRange(
    attributes: unknown,
): AdvancedSowingDistanceRangeInput {
    if (!isUnknownRecord(attributes)) {
        throw new AdvancedSowingPlanBoundaryError('catalogue_mismatch');
    }
    const optimalDistanceCm = attributes.seedingDistance;
    const minDistanceCm = attributes.seedingDistanceMin;
    const maxDistanceCm = attributes.seedingDistanceMax;
    if (
        typeof optimalDistanceCm !== 'number' ||
        (minDistanceCm !== undefined &&
            minDistanceCm !== null &&
            typeof minDistanceCm !== 'number') ||
        (maxDistanceCm !== undefined &&
            maxDistanceCm !== null &&
            typeof maxDistanceCm !== 'number') ||
        ((minDistanceCm === undefined || minDistanceCm === null) &&
            (maxDistanceCm === undefined || maxDistanceCm === null))
    ) {
        throw new AdvancedSowingPlanBoundaryError('catalogue_mismatch');
    }

    return {
        maxDistanceCm: typeof maxDistanceCm === 'number' ? maxDistanceCm : null,
        minDistanceCm: typeof minDistanceCm === 'number' ? minDistanceCm : null,
        optimalDistanceCm,
    };
}

const advancedSowingPlanErrorMessages: Record<
    AdvancedSowingPlanReasonCode,
    string
> = {
    catalogue_mismatch:
        'Advanced Sowing plan does not match the current catalogue.',
    footprint_out_of_bounds:
        'Advanced Sowing footprint does not fit the raised bed target.',
    invalid_authorization: 'Advanced Sowing cart authorization is invalid.',
    invalid_json: 'Advanced Sowing additional data is invalid.',
    invalid_request: 'Advanced Sowing selection request is invalid.',
    layout_conflict:
        'Advanced Sowing layout is already active or pending on the target fields.',
    legacy_layout_unknown:
        'Advanced Sowing cannot share fields with a planting whose layout is unknown.',
    plant_operation_conflict:
        'Advanced Sowing cannot replace field targets while plant work is still actionable.',
    reserved_additional_data:
        'Advanced Sowing authorization data is reserved for the server.',
    spacing_out_of_range:
        'Selected Advanced Sowing distance is outside the configured range.',
    target_mismatch:
        'Advanced Sowing authorization does not match the cart target.',
};

export class AdvancedSowingPlanBoundaryError extends Error {
    readonly reasonCode: AdvancedSowingPlanReasonCode;

    constructor(reasonCode: AdvancedSowingPlanReasonCode) {
        super(advancedSowingPlanErrorMessages[reasonCode]);
        this.name = 'AdvancedSowingPlanBoundaryError';
        this.reasonCode = reasonCode;
    }
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readAdditionalDataObject(
    additionalData: unknown,
): Record<string, unknown> {
    if (additionalData === null || additionalData === undefined) {
        return {};
    }

    if (isUnknownRecord(additionalData)) {
        return additionalData;
    }

    if (typeof additionalData !== 'string') {
        throw new AdvancedSowingPlanBoundaryError('invalid_json');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(additionalData);
    } catch {
        throw new AdvancedSowingPlanBoundaryError('invalid_json');
    }

    if (!isUnknownRecord(parsed)) {
        throw new AdvancedSowingPlanBoundaryError('invalid_json');
    }

    return parsed;
}

export function hasReservedAdvancedSowingAdditionalData(
    additionalData: unknown,
) {
    let parsedAdditionalData: Record<string, unknown>;
    try {
        parsedAdditionalData = readAdditionalDataObject(additionalData);
    } catch {
        return false;
    }

    return (
        Object.hasOwn(
            parsedAdditionalData,
            advancedSowingCartAuthorizationKey,
        ) ||
        Object.hasOwn(parsedAdditionalData, legacyUntrustedAdvancedSowingKey)
    );
}

export function assertNoReservedAdvancedSowingAdditionalData(
    additionalData: unknown,
) {
    if (hasReservedAdvancedSowingAdditionalData(additionalData)) {
        throw new AdvancedSowingPlanBoundaryError('reserved_additional_data');
    }
}

export function parseUntrustedAdvancedSowingSelectionRequestV1(
    value: unknown,
): AdvancedSowingSelectionRequestV1 {
    try {
        return parseAdvancedSowingSelectionRequestV1(value);
    } catch {
        throw new AdvancedSowingPlanBoundaryError('invalid_request');
    }
}

/**
 * Parses an untrusted value structurally. This function does not establish
 * that the envelope was written by the cart authorization boundary.
 */
export function parseUntrustedAdvancedSowingCartAuthorizationV1(
    value: unknown,
): AdvancedSowingCartAuthorizationV1 {
    try {
        return parseAdvancedSowingCartAuthorizationV1(value);
    } catch {
        throw new AdvancedSowingPlanBoundaryError('invalid_authorization');
    }
}

function targetMatchesPlan(
    plan: AdvancedSowingCartConfigurationV1,
    target: AdvancedSowingCartTarget,
) {
    return (
        Number.isSafeInteger(target.positionIndex) &&
        Number.isSafeInteger(target.bedFieldCount) &&
        target.positionIndex === plan.anchorPositionIndex &&
        target.bedFieldCount === plan.bedFieldCount
    );
}

function advancedSowingPlansMatch(
    first: AdvancedSowingCartConfigurationV1,
    second: AdvancedSowingCartConfigurationV1,
) {
    return (
        first.version === second.version &&
        first.anchorPositionIndex === second.anchorPositionIndex &&
        first.bedFieldCount === second.bedFieldCount &&
        first.selectedDistanceCm === second.selectedDistanceCm &&
        first.optimalDistanceCm === second.optimalDistanceCm &&
        first.minDistanceCm === second.minDistanceCm &&
        first.maxDistanceCm === second.maxDistanceCm &&
        first.layoutKey === second.layoutKey &&
        first.plantsPerAxis === second.plantsPerAxis &&
        first.plantCount === second.plantCount &&
        first.fieldSpanRows === second.fieldSpanRows &&
        first.fieldSpanColumns === second.fieldSpanColumns &&
        first.occupiedPositionIndices.length ===
            second.occupiedPositionIndices.length &&
        first.occupiedPositionIndices.every(
            (positionIndex, index) =>
                positionIndex === second.occupiedPositionIndices[index],
        )
    );
}

function buildCanonicalPlan({
    catalogueDistanceRange,
    selectedDistanceCm,
    target,
}: {
    catalogueDistanceRange: AdvancedSowingDistanceRangeInput;
    selectedDistanceCm: number;
    target: AdvancedSowingCartTarget;
}) {
    let catalogueRange: ReturnType<typeof resolveAdvancedSowingDistanceRange>;
    try {
        catalogueRange = resolveAdvancedSowingDistanceRange(
            catalogueDistanceRange,
        );
    } catch {
        throw new AdvancedSowingPlanBoundaryError('catalogue_mismatch');
    }

    try {
        getAdvancedSowingLayoutOptions(catalogueRange, {
            bedFieldCount: target.bedFieldCount,
        });
    } catch {
        throw new AdvancedSowingPlanBoundaryError('catalogue_mismatch');
    }

    try {
        return buildAdvancedSowingCartConfigurationV1({
            anchorPositionIndex: target.positionIndex,
            bedFieldCount: target.bedFieldCount,
            ...catalogueRange,
            selectedDistanceCm,
        });
    } catch (error) {
        if (
            error instanceof RangeError &&
            error.message ===
                'Selected sowing distance must be within the configured range.'
        ) {
            throw new AdvancedSowingPlanBoundaryError('spacing_out_of_range');
        }
        if (
            error instanceof RangeError &&
            (error.message === 'Anchor position is outside the raised bed.' ||
                error.message ===
                    'Sowing footprint extends outside the raised bed.' ||
                error.message.startsWith('Bed field count ') ||
                error.message.startsWith('Bed column count '))
        ) {
            throw new AdvancedSowingPlanBoundaryError(
                'footprint_out_of_bounds',
            );
        }
        throw new AdvancedSowingPlanBoundaryError('catalogue_mismatch');
    }
}

/**
 * Server-owned cart mutation boundary. The client supplies only a selected
 * distance request; all layout and catalogue snapshots are derived here. The
 * returned authorization must be persisted separately from client-writable
 * additionalData. Reserved keys in that client data are always rejected.
 */
export function authorizeAdvancedSowingCartSelection({
    clientAdditionalData,
    selectionRequest,
    catalogueDistanceRange,
    target,
}: {
    clientAdditionalData: unknown;
    selectionRequest: unknown;
    catalogueDistanceRange: AdvancedSowingDistanceRangeInput;
    target: AdvancedSowingCartTarget;
}) {
    const parsedAdditionalData = readAdditionalDataObject(clientAdditionalData);
    assertNoReservedAdvancedSowingAdditionalData(parsedAdditionalData);

    if (selectionRequest === null || selectionRequest === undefined) {
        return {
            additionalData: { ...parsedAdditionalData },
            authorization: null,
        };
    }
    const request =
        parseUntrustedAdvancedSowingSelectionRequestV1(selectionRequest);
    const plan = buildCanonicalPlan({
        catalogueDistanceRange,
        selectedDistanceCm: request.selectedDistanceCm,
        target,
    });
    const authorization: AdvancedSowingCartAuthorizationV1 = {
        kind: advancedSowingCartAuthorizationKind,
        plan,
        version: 1,
    };

    return {
        additionalData: { ...parsedAdditionalData },
        authorization,
    };
}

/**
 * Revalidates the server-owned cart envelope immediately before payment opens.
 * This is deliberately catalogue-sensitive.
 */
export function validateAdvancedSowingCartAuthorizationBeforeCheckout({
    persistedAuthorization,
    catalogueDistanceRange,
    target,
}: {
    persistedAuthorization: unknown;
    catalogueDistanceRange: AdvancedSowingDistanceRangeInput;
    target: AdvancedSowingCartTarget;
}): AdvancedSowingCartAuthorizationV1 | null {
    if (
        persistedAuthorization === null ||
        persistedAuthorization === undefined
    ) {
        return null;
    }
    const authorization = parseUntrustedAdvancedSowingCartAuthorizationV1(
        persistedAuthorization,
    );
    if (!targetMatchesPlan(authorization.plan, target)) {
        throw new AdvancedSowingPlanBoundaryError('target_mismatch');
    }

    let expectedPlan: AdvancedSowingCartConfigurationV1;
    try {
        expectedPlan = buildCanonicalPlan({
            catalogueDistanceRange,
            selectedDistanceCm: authorization.plan.selectedDistanceCm,
            target,
        });
    } catch (error) {
        if (error instanceof AdvancedSowingPlanBoundaryError) {
            throw new AdvancedSowingPlanBoundaryError('catalogue_mismatch');
        }
        throw error;
    }
    if (!advancedSowingPlansMatch(authorization.plan, expectedPlan)) {
        throw new AdvancedSowingPlanBoundaryError('catalogue_mismatch');
    }

    return { ...authorization, plan: expectedPlan };
}

/**
 * Reads the immutable server-owned envelope copied into a paid checkout
 * snapshot. Feature state and live catalogue values are intentionally absent.
 */
export function readAdvancedSowingPaidCheckoutSnapshot({
    checkoutSnapshotAuthorization,
    target,
}: {
    checkoutSnapshotAuthorization: unknown;
    target: AdvancedSowingCartTarget;
}): AdvancedSowingCartAuthorizationV1 | null {
    if (
        checkoutSnapshotAuthorization === null ||
        checkoutSnapshotAuthorization === undefined
    ) {
        return null;
    }
    const authorization = parseUntrustedAdvancedSowingCartAuthorizationV1(
        checkoutSnapshotAuthorization,
    );
    if (!targetMatchesPlan(authorization.plan, target)) {
        throw new AdvancedSowingPlanBoundaryError('target_mismatch');
    }

    return authorization;
}
