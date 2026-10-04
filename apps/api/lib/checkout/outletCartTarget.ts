import { ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT } from '@gredice/js/plants';
import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import {
    assertLegacySowingTargetAvailable,
    LegacySowingSelectedPlantingConflictError,
} from './advancedSowingAvailability';

export const outletCartMutationConflictCodes = {
    offerUnavailable: 'OUTLET_OFFER_UNAVAILABLE',
    targetRequired: 'OUTLET_TARGET_REQUIRED',
    targetUnavailable: 'OUTLET_TARGET_UNAVAILABLE',
} as const;

export type OutletCartMutationConflictCode =
    (typeof outletCartMutationConflictCodes)[keyof typeof outletCartMutationConflictCodes];

export class OutletCartMutationConflictError extends Error {
    override readonly name = 'OutletCartMutationConflictError';

    constructor(readonly code: OutletCartMutationConflictCode) {
        super(
            code === outletCartMutationConflictCodes.targetRequired
                ? 'Outlet offer requires a garden, raised bed, and field target.'
                : code === outletCartMutationConflictCodes.offerUnavailable
                  ? 'Outlet offer is not available.'
                  : 'Outlet target is not available.',
        );
    }
}

type OutletTargetField = {
    active?: boolean | null;
    plantSortId?: number | null;
    positionIndex: number;
};

type OutletTargetPlanting = {
    configurationSource: string;
    isActive: boolean;
    isDeleted?: boolean;
    layoutKey: string | null;
    memberships: readonly unknown[];
};

type OutletTargetRaisedBed = {
    accountId: string | null;
    fields: readonly OutletTargetField[];
    gardenId: number | null;
    id: number;
    plantings: readonly OutletTargetPlanting[];
    status: string;
};

type OutletTargetGarden = {
    accountId: string | null;
    id: number;
    isSandbox: boolean;
    raisedBeds: readonly OutletTargetRaisedBed[];
};

export type RequiredOutletCartTarget = {
    gardenId: number;
    positionIndex: number;
    raisedBedId: number;
};

export function requireOutletCartTarget({
    gardenId,
    positionIndex,
    raisedBedId,
}: {
    gardenId?: number;
    positionIndex?: number;
    raisedBedId?: number;
}): RequiredOutletCartTarget {
    if (
        gardenId === undefined ||
        raisedBedId === undefined ||
        positionIndex === undefined
    ) {
        throw new OutletCartMutationConflictError(
            outletCartMutationConflictCodes.targetRequired,
        );
    }
    if (
        !Number.isSafeInteger(gardenId) ||
        gardenId <= 0 ||
        !Number.isSafeInteger(raisedBedId) ||
        raisedBedId <= 0 ||
        !Number.isSafeInteger(positionIndex) ||
        positionIndex < 0 ||
        positionIndex >= ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT
    ) {
        throw new OutletCartMutationConflictError(
            outletCartMutationConflictCodes.targetUnavailable,
        );
    }

    return { gardenId, positionIndex, raisedBedId };
}

export function assertOutletCartTargetAvailable({
    accountId,
    garden,
    isRaisedBedValid,
    positionIndex,
    raisedBedId,
}: {
    accountId: string;
    garden: OutletTargetGarden | null;
    isRaisedBedValid: boolean;
    positionIndex: number;
    raisedBedId: number;
}) {
    const raisedBed = garden?.raisedBeds.find(
        (candidate) => candidate.id === raisedBedId,
    );
    if (
        !garden ||
        garden.accountId !== accountId ||
        garden.isSandbox ||
        !raisedBed ||
        raisedBed.accountId !== accountId ||
        raisedBed.gardenId !== garden.id ||
        !isRaisedBedValid ||
        isRaisedBedAbandoned(raisedBed.status) ||
        !Number.isSafeInteger(positionIndex) ||
        positionIndex < 0 ||
        positionIndex >= ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT
    ) {
        throw new OutletCartMutationConflictError(
            outletCartMutationConflictCodes.targetUnavailable,
        );
    }

    const physicalFieldOccupied = raisedBed.fields.some(
        (field) =>
            field.positionIndex === positionIndex &&
            field.active === true &&
            typeof field.plantSortId === 'number',
    );
    if (physicalFieldOccupied) {
        throw new OutletCartMutationConflictError(
            outletCartMutationConflictCodes.targetUnavailable,
        );
    }

    try {
        assertLegacySowingTargetAvailable({
            plantings: raisedBed.plantings,
            positionIndex,
            raisedBedId,
        });
    } catch (error) {
        if (error instanceof LegacySowingSelectedPlantingConflictError) {
            throw new OutletCartMutationConflictError(
                outletCartMutationConflictCodes.targetUnavailable,
            );
        }
        throw error;
    }
}

export function isOutletCartCurrency(
    currency: string | null | undefined,
): currency is 'eur' | 'sunflower' {
    return currency === 'eur' || currency === 'sunflower';
}

export function resolveOutletCartCurrency(
    currency: string | null | undefined,
    existingCurrency: string | null | undefined,
) {
    if (isOutletCartCurrency(currency)) {
        return currency;
    }
    return isOutletCartCurrency(existingCurrency) ? existingCurrency : 'eur';
}
