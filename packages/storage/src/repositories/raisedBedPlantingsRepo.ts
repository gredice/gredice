import 'server-only';

import {
    ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
    getAdvancedSowingFootprintPositions,
    resolveAdvancedSowingLayout,
} from '@gredice/js/plants';
import { and, asc, eq, inArray, or, type SQL, sql } from 'drizzle-orm';
import { validate as isUuid, version as uuidVersion } from 'uuid';
import { bustScheduleCache } from '../cache/scheduleCache';
import {
    type LegacyRaisedBedPlantCycleProjection,
    legacyRaisedBedPlantCycleEventTypes,
    projectLegacyRaisedBedPlantCycles,
} from '../helpers/legacyRaisedBedPlantCycles';
import {
    projectSelectedRaisedBedPlantingLifecycle,
    type SelectedRaisedBedPlantingLifecycleProjection,
    type SelectedRaisedBedPlantingTaskReadModel,
    selectedRaisedBedPlantingEventTypes,
} from '../helpers/selectedRaisedBedPlantingLifecycle';
import {
    entities,
    events,
    type RaisedBedPlantingConfigurationSource,
    raisedBedFields,
    raisedBedPlantingFields,
    raisedBedPlantings,
    raisedBeds,
    type SelectRaisedBedField,
    type SelectRaisedBedPlanting,
    type SelectRaisedBedPlantingField,
} from '../schema';
import { storage } from '../storage';
import {
    createEvent,
    type Event,
    getAllEvents,
    knownEvents,
    knownEventTypes,
    type RaisedBedFieldPlantPurchase,
    type RaisedBedFieldSowingLocation,
    type RaisedBedPlantingLifecycleStatus,
} from './eventsRepo';
import { getBlockingPlantOperationsForRaisedBedFootprint } from './operationsRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

export type RaisedBedPlantingErrorCode =
    | 'anchor_mismatch'
    | 'duplicate_field_position'
    | 'event_aggregate_conflict'
    | 'field_bed_mismatch'
    | 'field_not_found'
    | 'integrity_error'
    | 'invalid_input'
    | 'identity_replay_conflict'
    | 'layout_collision'
    | 'legacy_layout_unknown'
    | 'legacy_event_conflict'
    | 'plant_operation_conflict'
    | 'plant_sort_not_found'
    | 'raised_bed_not_found';

export class RaisedBedPlantingError extends Error {
    override readonly name = 'RaisedBedPlantingError';

    constructor(
        readonly code: RaisedBedPlantingErrorCode,
        message: string,
    ) {
        super(message);
    }
}

export type RaisedBedPlantingMembershipInput = {
    raisedBedFieldId: number;
    relativeRow: number;
    relativeColumn: number;
    isAnchor: boolean;
};

type CreateRaisedBedPlantingBaseInput = {
    raisedBedId: number;
    plantSortId: number;
    eventAggregateId: string;
    anchorPositionIndex: number;
    isActive?: boolean;
    memberships: readonly RaisedBedPlantingMembershipInput[];
};

export type CreateLegacyRaisedBedPlantingInput =
    CreateRaisedBedPlantingBaseInput & {
        configurationSource: 'legacy';
        legacyPlantPlaceEventId: number;
        minSeedingDistanceCm?: null;
        optimalSeedingDistanceCm?: null;
        maxSeedingDistanceCm?: null;
        selectedSeedingDistanceCm?: null;
        plantsPerAxis?: null;
        plantCount?: null;
        layoutKey?: null;
        spanRows?: 1;
        spanColumns?: 1;
        layoutVersion?: 1;
    };

export type CreateSelectedRaisedBedPlantingInput =
    CreateRaisedBedPlantingBaseInput & {
        configurationSource: 'selected';
        legacyPlantPlaceEventId?: null;
        minSeedingDistanceCm: number;
        optimalSeedingDistanceCm: number;
        maxSeedingDistanceCm: number;
        selectedSeedingDistanceCm: number;
        plantsPerAxis: number;
        plantCount: number;
        layoutKey: string;
        spanRows: number;
        spanColumns: number;
        layoutVersion: number;
        lifecycleStarted: {
            commandId: string;
            scheduledDate: string | null;
            sowingLocation: RaisedBedFieldSowingLocation;
            purchase?: RaisedBedFieldPlantPurchase;
            startedBy: string;
        };
    };

export type CreateRaisedBedPlantingInput =
    | CreateLegacyRaisedBedPlantingInput
    | CreateSelectedRaisedBedPlantingInput;

export type NormalizedCreateRaisedBedPlantingInput = {
    raisedBedId: number;
    plantSortId: number;
    eventAggregateId: string;
    legacyPlantPlaceEventId: number | null;
    anchorPositionIndex: number;
    minSeedingDistanceCm: number | null;
    optimalSeedingDistanceCm: number | null;
    maxSeedingDistanceCm: number | null;
    selectedSeedingDistanceCm: number | null;
    plantsPerAxis: number | null;
    plantCount: number | null;
    layoutKey: string | null;
    spanRows: number;
    spanColumns: number;
    layoutVersion: number;
    configurationSource: RaisedBedPlantingConfigurationSource;
    isActive: boolean;
    memberships: RaisedBedPlantingMembershipInput[];
    lifecycleStarted: {
        commandId: string;
        scheduledDate: string | null;
        sowingLocation: RaisedBedFieldSowingLocation;
        purchase?: RaisedBedFieldPlantPurchase;
        startedBy: string;
    } | null;
};

type RaisedBedFieldIdentity = Pick<
    SelectRaisedBedField,
    'id' | 'isDeleted' | 'positionIndex' | 'raisedBedId'
>;

export type RaisedBedPlantingFieldMembership = SelectRaisedBedPlantingField & {
    raisedBedField: RaisedBedFieldIdentity;
};

export type RaisedBedPlantingWithFields = SelectRaisedBedPlanting & {
    lifecycleStartedAt: Date;
    lifecycleStoppedAt: Date | null;
    lifecycleVersionEventId: number | null;
    lifecycleStatus: RaisedBedPlantingLifecycleStatus | null;
    lifecycleStatusEventId: number | null;
    lifecycleStatusChanges: SelectedRaisedBedPlantingLifecycleProjection['statusChanges'];
    selectedTask: SelectedRaisedBedPlantingTaskReadModel | null;
    memberships: RaisedBedPlantingFieldMembership[];
};

export type CreateRaisedBedPlantingResult = {
    planting: RaisedBedPlantingWithFields;
    created: boolean;
};

export type CreateLegacyRaisedBedPlantPlaceWithProjectionInput = {
    event: Event;
    raisedBedFieldId: number;
};

export type RaisedBedPlantingLayoutOccupancy = {
    plantingId: number;
    raisedBedFieldId: number;
    layoutKey: string | null;
    configurationSource: RaisedBedPlantingConfigurationSource;
    isActive: boolean;
    plantingIsDeleted: boolean;
    membershipIsDeleted: boolean;
};

export type RaisedBedPlantingLayoutConflict =
    | {
          code: 'layout_collision';
          occupancy: RaisedBedPlantingLayoutOccupancy;
      }
    | {
          code: 'legacy_layout_unknown';
          occupancy: RaisedBedPlantingLayoutOccupancy;
      };

/**
 * Classifies occupancy conflicts independently of persistence so historical
 * rows can remain queryable without blocking new placements.
 */
export function findRaisedBedPlantingLayoutConflict(
    occupancies: readonly RaisedBedPlantingLayoutOccupancy[],
    requestedLayoutKey: string,
): RaisedBedPlantingLayoutConflict | null {
    const activeOccupancies = occupancies.filter(
        (occupancy) =>
            occupancy.isActive &&
            !occupancy.plantingIsDeleted &&
            !occupancy.membershipIsDeleted,
    );
    const unknownLegacyLayout = activeOccupancies.find(
        (occupancy) =>
            occupancy.configurationSource === 'legacy' &&
            occupancy.layoutKey === null,
    );
    if (unknownLegacyLayout) {
        return {
            code: 'legacy_layout_unknown',
            occupancy: unknownLegacyLayout,
        };
    }
    const matchingLayout = activeOccupancies.find(
        (occupancy) => occupancy.layoutKey === requestedLayoutKey,
    );
    return matchingLayout
        ? { code: 'layout_collision', occupancy: matchingLayout }
        : null;
}

function immutableMembershipKey(
    membership:
        | RaisedBedPlantingMembershipInput
        | RaisedBedPlantingFieldMembership,
) {
    return [
        membership.raisedBedFieldId,
        membership.relativeRow,
        membership.relativeColumn,
        membership.isAnchor ? 1 : 0,
    ].join(':');
}

function samePurchase(
    left: RaisedBedFieldPlantPurchase | undefined,
    right: RaisedBedFieldPlantPurchase | undefined,
) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    if (
        left.currency !== right.currency ||
        left.cartItemId !== right.cartItemId
    ) {
        return false;
    }
    if (left.currency === 'eur' && right.currency === 'eur') {
        return left.euroAmountCents === right.euroAmountCents;
    }
    if (left.currency === 'sunflower' && right.currency === 'sunflower') {
        return left.sunflowerAmount === right.sunflowerAmount;
    }
    return left.currency === 'inventory' && right.currency === 'inventory';
}

function sameSelectedLifecycleStart(
    existing: RaisedBedPlantingWithFields,
    input: NormalizedCreateRaisedBedPlantingInput,
) {
    if (input.configurationSource !== 'selected') {
        return (
            existing.selectedTask === null && input.lifecycleStarted === null
        );
    }
    const task = existing.selectedTask;
    const lifecycleStarted = input.lifecycleStarted;
    return Boolean(
        task &&
            lifecycleStarted &&
            task.initialCommandId === lifecycleStarted.commandId &&
            task.initialScheduledDate === lifecycleStarted.scheduledDate &&
            task.initialSowingLocation === lifecycleStarted.sowingLocation &&
            task.startedBy === lifecycleStarted.startedBy &&
            samePurchase(task.purchase, lifecycleStarted.purchase),
    );
}

/**
 * Compares every immutable planting-plan value. Lifecycle state and soft
 * deletion are intentionally excluded because they can change after creation.
 */
export function isSameRaisedBedPlantingImmutablePlan(
    existing: RaisedBedPlantingWithFields,
    input: NormalizedCreateRaisedBedPlantingInput,
) {
    if (
        existing.raisedBedId !== input.raisedBedId ||
        (input.configurationSource === 'selected' &&
            existing.plantSortId !== input.plantSortId) ||
        existing.eventAggregateId !== input.eventAggregateId ||
        existing.legacyPlantPlaceEventId !== input.legacyPlantPlaceEventId ||
        existing.anchorPositionIndex !== input.anchorPositionIndex ||
        existing.minSeedingDistanceCm !== input.minSeedingDistanceCm ||
        existing.optimalSeedingDistanceCm !== input.optimalSeedingDistanceCm ||
        existing.maxSeedingDistanceCm !== input.maxSeedingDistanceCm ||
        existing.selectedSeedingDistanceCm !==
            input.selectedSeedingDistanceCm ||
        existing.plantsPerAxis !== input.plantsPerAxis ||
        existing.plantCount !== input.plantCount ||
        existing.layoutKey !== input.layoutKey ||
        existing.spanRows !== input.spanRows ||
        existing.spanColumns !== input.spanColumns ||
        existing.layoutVersion !== input.layoutVersion ||
        existing.configurationSource !== input.configurationSource ||
        !sameSelectedLifecycleStart(existing, input) ||
        existing.memberships.length !== input.memberships.length
    ) {
        return false;
    }

    const existingMemberships = existing.memberships
        .map(immutableMembershipKey)
        .sort();
    const inputMemberships = input.memberships
        .map(immutableMembershipKey)
        .sort();
    return existingMemberships.every(
        (membership, index) => membership === inputMemberships[index],
    );
}

function invalidInput(message: string): never {
    throw new RaisedBedPlantingError('invalid_input', message);
}

function positiveSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        invalidInput(`${label} must be a positive safe integer.`);
    }
    return value;
}

function optionalPositiveSafeInteger(
    value: number | null | undefined,
    label: string,
) {
    return value == null ? null : positiveSafeInteger(value, label);
}

function nonNegativeSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value < 0) {
        invalidInput(`${label} must be a non-negative safe integer.`);
    }
    return value;
}

function optionalPositiveFiniteNumber(
    value: number | null | undefined,
    label: string,
) {
    if (value == null) {
        return null;
    }
    if (!Number.isFinite(value) || value <= 0) {
        invalidInput(`${label} must be a finite number greater than zero.`);
    }
    return value;
}

function requiredString(value: string, label: string) {
    const normalized = value.trim();
    if (!normalized) {
        invalidInput(`${label} must not be empty.`);
    }
    return normalized;
}

function optionalString(value: string | null | undefined, label: string) {
    return value == null ? null : requiredString(value, label);
}

function normalizeCommandId(value: string, label: string) {
    const normalized = requiredString(value, label).toLowerCase();
    if (!isUuid(normalized)) {
        invalidInput(`${label} must be a UUID.`);
    }
    const version = uuidVersion(normalized);
    if (version < 1 || version > 8) {
        invalidInput(`${label} must be a UUID.`);
    }
    return normalized;
}

function normalizeIsoDate(value: string, label: string) {
    const parsed = new Date(requiredString(value, label));
    if (Number.isNaN(parsed.getTime())) {
        invalidInput(`${label} must be a valid date.`);
    }
    return parsed.toISOString();
}

function normalizePurchase(
    value: RaisedBedFieldPlantPurchase | undefined,
): RaisedBedFieldPlantPurchase | undefined {
    if (value === undefined) {
        return undefined;
    }
    const cartItemId = positiveSafeInteger(
        value.cartItemId,
        'Purchase cart item ID',
    );
    if (value.currency === 'inventory') {
        return { cartItemId, currency: 'inventory' };
    }
    const amountLabel =
        value.currency === 'eur'
            ? 'Purchase euro amount in cents'
            : 'Purchase sunflower amount';
    const amount =
        value.currency === 'eur'
            ? value.euroAmountCents
            : value.sunflowerAmount;
    if (!Number.isSafeInteger(amount) || amount < 0) {
        invalidInput(`${amountLabel} must be a non-negative safe integer.`);
    }
    return value.currency === 'eur'
        ? { cartItemId, currency: 'eur', euroAmountCents: amount }
        : { cartItemId, currency: 'sunflower', sunflowerAmount: amount };
}

function normalizeSelectedLifecycleStarted(
    value: CreateSelectedRaisedBedPlantingInput['lifecycleStarted'],
) {
    if (!value || typeof value !== 'object') {
        invalidInput(
            'Selected plantings require a lifecycle-started task snapshot.',
        );
    }
    if (
        value.sowingLocation !== 'direct' &&
        value.sowingLocation !== 'greenhouse'
    ) {
        invalidInput('Sowing location must be direct or greenhouse.');
    }
    const purchase = normalizePurchase(value.purchase);
    return {
        commandId: normalizeCommandId(
            value.commandId,
            'Lifecycle start command ID',
        ),
        scheduledDate:
            value.scheduledDate === null
                ? null
                : normalizeIsoDate(value.scheduledDate, 'Scheduled date'),
        sowingLocation: value.sowingLocation,
        ...(purchase ? { purchase } : {}),
        startedBy: requiredString(value.startedBy, 'Lifecycle start actor'),
    };
}

function normalizeMemberships(
    memberships: readonly RaisedBedPlantingMembershipInput[],
    spanRows: number,
    spanColumns: number,
) {
    if (memberships.length === 0) {
        invalidInput('A planting must contain at least one field membership.');
    }
    const expectedMembershipCount = spanRows * spanColumns;
    if (
        !Number.isSafeInteger(expectedMembershipCount) ||
        memberships.length !== expectedMembershipCount
    ) {
        invalidInput(
            'Field membership count must equal span rows multiplied by span columns.',
        );
    }

    const fieldIds = new Set<number>();
    const coordinates = new Set<string>();
    let anchorCount = 0;
    const normalized = memberships.map((membership) => {
        if (typeof membership.isAnchor !== 'boolean') {
            invalidInput('Anchor membership state must be a boolean.');
        }
        const raisedBedFieldId = positiveSafeInteger(
            membership.raisedBedFieldId,
            'Raised bed field ID',
        );
        const relativeRow = nonNegativeSafeInteger(
            membership.relativeRow,
            'Relative row',
        );
        const relativeColumn = nonNegativeSafeInteger(
            membership.relativeColumn,
            'Relative column',
        );
        if (relativeRow >= spanRows || relativeColumn >= spanColumns) {
            invalidInput(
                'Field membership coordinates must fit inside the planting span.',
            );
        }
        if (fieldIds.has(raisedBedFieldId)) {
            invalidInput('Raised bed field memberships must be unique.');
        }
        fieldIds.add(raisedBedFieldId);

        const coordinateKey = `${relativeRow.toString()}:${relativeColumn.toString()}`;
        if (coordinates.has(coordinateKey)) {
            invalidInput('Planting membership coordinates must be unique.');
        }
        coordinates.add(coordinateKey);
        if (membership.isAnchor) {
            anchorCount += 1;
        }

        return {
            raisedBedFieldId,
            relativeRow,
            relativeColumn,
            isAnchor: membership.isAnchor,
        };
    });

    if (anchorCount !== 1) {
        invalidInput('A planting must contain exactly one anchor field.');
    }

    return normalized;
}

/**
 * Normalizes and validates storage-facing planting input without consulting the
 * database. Legacy rows must remain event-backed 1x1 projections with no
 * inferred layout snapshots; newly selected layouts must provide snapshots.
 */
export function validateRaisedBedPlantingInput(
    input: CreateRaisedBedPlantingInput,
): NormalizedCreateRaisedBedPlantingInput {
    if (
        input.configurationSource !== 'legacy' &&
        input.configurationSource !== 'selected'
    ) {
        invalidInput('Unknown planting configuration source.');
    }
    if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
        invalidInput('Active planting state must be a boolean.');
    }
    if (input.configurationSource === 'selected' && input.isActive === false) {
        invalidInput('A newly selected planting must start active.');
    }
    const suppliedSpanRows = optionalPositiveSafeInteger(
        input.spanRows,
        'Span rows',
    );
    const suppliedSpanColumns = optionalPositiveSafeInteger(
        input.spanColumns,
        'Span columns',
    );
    const suppliedLayoutVersion = optionalPositiveSafeInteger(
        input.layoutVersion,
        'Layout version',
    );
    const minSeedingDistanceCm = optionalPositiveFiniteNumber(
        input.minSeedingDistanceCm,
        'Minimum seeding distance',
    );
    const optimalSeedingDistanceCm = optionalPositiveFiniteNumber(
        input.optimalSeedingDistanceCm,
        'Optimal seeding distance',
    );
    const maxSeedingDistanceCm = optionalPositiveFiniteNumber(
        input.maxSeedingDistanceCm,
        'Maximum seeding distance',
    );
    const selectedSeedingDistanceCm = optionalPositiveFiniteNumber(
        input.selectedSeedingDistanceCm,
        'Selected seeding distance',
    );
    const plantsPerAxis = optionalPositiveSafeInteger(
        input.plantsPerAxis,
        'Plants per axis',
    );
    const plantCount = optionalPositiveSafeInteger(
        input.plantCount,
        'Plant count',
    );
    const layoutKey = optionalString(input.layoutKey, 'Layout key');
    const legacyPlantPlaceEventId = optionalPositiveSafeInteger(
        input.legacyPlantPlaceEventId,
        'Legacy plant-place event ID',
    );
    let canonicalMinSeedingDistanceCm: number | null = null;
    let canonicalOptimalSeedingDistanceCm: number | null = null;
    let canonicalMaxSeedingDistanceCm: number | null = null;
    let canonicalSelectedSeedingDistanceCm: number | null = null;
    let canonicalPlantsPerAxis: number | null = null;
    let canonicalPlantCount: number | null = null;
    let canonicalLayoutKey: string | null = null;
    let spanRows: number;
    let spanColumns: number;
    let layoutVersion: number;
    let lifecycleStarted: NormalizedCreateRaisedBedPlantingInput['lifecycleStarted'] =
        null;

    if (input.configurationSource === 'legacy') {
        spanRows = suppliedSpanRows ?? 1;
        spanColumns = suppliedSpanColumns ?? 1;
        layoutVersion = suppliedLayoutVersion ?? 1;
        if (
            legacyPlantPlaceEventId === null ||
            minSeedingDistanceCm !== null ||
            optimalSeedingDistanceCm !== null ||
            maxSeedingDistanceCm !== null ||
            selectedSeedingDistanceCm !== null ||
            plantsPerAxis !== null ||
            plantCount !== null ||
            layoutKey !== null ||
            spanRows !== 1 ||
            spanColumns !== 1 ||
            layoutVersion !== 1
        ) {
            invalidInput(
                'Legacy plantings require an event ID and a 1x1 version-1 footprint with no inferred layout snapshots.',
            );
        }
        if (Object.hasOwn(input, 'lifecycleStarted')) {
            invalidInput(
                'Legacy projections cannot define a selected lifecycle-started snapshot.',
            );
        }
    } else {
        if (
            legacyPlantPlaceEventId !== null ||
            minSeedingDistanceCm === null ||
            optimalSeedingDistanceCm === null ||
            maxSeedingDistanceCm === null ||
            selectedSeedingDistanceCm === null ||
            plantsPerAxis === null ||
            plantCount === null ||
            layoutKey === null ||
            suppliedSpanRows === null ||
            suppliedSpanColumns === null ||
            suppliedLayoutVersion === null
        ) {
            invalidInput(
                'Selected plantings require complete distance, density, count, footprint, and layout snapshots.',
            );
        }

        let derivedLayout: ReturnType<typeof resolveAdvancedSowingLayout>;
        try {
            derivedLayout = resolveAdvancedSowingLayout({
                minDistanceCm: minSeedingDistanceCm,
                optimalDistanceCm: optimalSeedingDistanceCm,
                maxDistanceCm: maxSeedingDistanceCm,
                selectedDistanceCm: selectedSeedingDistanceCm,
            });
        } catch (error) {
            invalidInput(
                error instanceof Error
                    ? `Selected planting distances are invalid: ${error.message}`
                    : 'Selected planting distances are invalid.',
            );
        }

        if (
            plantsPerAxis !== derivedLayout.plantsPerAxis ||
            plantCount !== derivedLayout.plantCount ||
            layoutKey !== derivedLayout.layoutKey ||
            suppliedSpanRows !== derivedLayout.fieldSpanRows ||
            suppliedSpanColumns !== derivedLayout.fieldSpanColumns ||
            suppliedLayoutVersion !== 1
        ) {
            invalidInput(
                'Selected planting density, count, footprint, layout key, and version must exactly match the derived Advanced Sowing layout.',
            );
        }

        canonicalMinSeedingDistanceCm = derivedLayout.minDistanceCm;
        canonicalOptimalSeedingDistanceCm = derivedLayout.optimalDistanceCm;
        canonicalMaxSeedingDistanceCm = derivedLayout.maxDistanceCm;
        canonicalSelectedSeedingDistanceCm = derivedLayout.selectedDistanceCm;
        canonicalPlantsPerAxis = derivedLayout.plantsPerAxis;
        canonicalPlantCount = derivedLayout.plantCount;
        canonicalLayoutKey = derivedLayout.layoutKey;
        spanRows = derivedLayout.fieldSpanRows;
        spanColumns = derivedLayout.fieldSpanColumns;
        layoutVersion = 1;
        lifecycleStarted = normalizeSelectedLifecycleStarted(
            input.lifecycleStarted,
        );
    }

    const memberships = normalizeMemberships(
        input.memberships,
        spanRows,
        spanColumns,
    );

    return {
        raisedBedId: positiveSafeInteger(input.raisedBedId, 'Raised bed ID'),
        plantSortId: positiveSafeInteger(input.plantSortId, 'Plant sort ID'),
        eventAggregateId: requiredString(
            input.eventAggregateId,
            'Event aggregate ID',
        ),
        legacyPlantPlaceEventId,
        anchorPositionIndex: nonNegativeSafeInteger(
            input.anchorPositionIndex,
            'Anchor position index',
        ),
        minSeedingDistanceCm: canonicalMinSeedingDistanceCm,
        optimalSeedingDistanceCm: canonicalOptimalSeedingDistanceCm,
        maxSeedingDistanceCm: canonicalMaxSeedingDistanceCm,
        selectedSeedingDistanceCm: canonicalSelectedSeedingDistanceCm,
        plantsPerAxis: canonicalPlantsPerAxis,
        plantCount: canonicalPlantCount,
        layoutKey: canonicalLayoutKey,
        spanRows,
        spanColumns,
        layoutVersion,
        configurationSource: input.configurationSource,
        isActive: input.isActive ?? true,
        memberships,
        lifecycleStarted,
    };
}

export function assertRaisedBedPlantingIntegrity(
    planting: SelectRaisedBedPlanting,
    memberships: RaisedBedPlantingFieldMembership[],
) {
    const expectedMembershipCount = planting.spanRows * planting.spanColumns;
    const fieldIds = new Set<number>();
    const positionIndices = new Set<number>();
    const coordinates = new Set<string>();
    let anchorCount = 0;
    let anchorPositionIndex: number | null = null;

    for (const membership of memberships) {
        if (
            membership.isDeleted ||
            (planting.isActive && membership.raisedBedField.isDeleted) ||
            membership.raisedBedField.raisedBedId !== planting.raisedBedId
        ) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                `Planting ${planting.id.toString()} has an unavailable or cross-bed field membership.`,
            );
        }
        if (
            membership.relativeRow < 0 ||
            membership.relativeRow >= planting.spanRows ||
            membership.relativeColumn < 0 ||
            membership.relativeColumn >= planting.spanColumns
        ) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                `Planting ${planting.id.toString()} has an out-of-span field membership.`,
            );
        }
        if (
            fieldIds.has(membership.raisedBedFieldId) ||
            positionIndices.has(membership.raisedBedField.positionIndex)
        ) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                `Planting ${planting.id.toString()} has duplicate field membership positions.`,
            );
        }
        fieldIds.add(membership.raisedBedFieldId);
        positionIndices.add(membership.raisedBedField.positionIndex);

        const coordinateKey = `${membership.relativeRow.toString()}:${membership.relativeColumn.toString()}`;
        if (coordinates.has(coordinateKey)) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                `Planting ${planting.id.toString()} has duplicate relative coordinates.`,
            );
        }
        coordinates.add(coordinateKey);
        if (membership.isAnchor) {
            anchorCount += 1;
            anchorPositionIndex = membership.raisedBedField.positionIndex;
        }
    }

    if (
        memberships.length !== expectedMembershipCount ||
        anchorCount !== 1 ||
        anchorPositionIndex !== planting.anchorPositionIndex
    ) {
        throw new RaisedBedPlantingError(
            'integrity_error',
            `Planting ${planting.id.toString()} has an invalid footprint or anchor.`,
        );
    }

    if (planting.configurationSource !== 'selected') {
        return;
    }
    if (
        planting.minSeedingDistanceCm === null ||
        planting.optimalSeedingDistanceCm === null ||
        planting.maxSeedingDistanceCm === null ||
        planting.selectedSeedingDistanceCm === null ||
        planting.plantsPerAxis === null ||
        planting.plantCount === null ||
        planting.layoutKey === null
    ) {
        throw new RaisedBedPlantingError(
            'integrity_error',
            `Selected planting ${planting.id.toString()} has incomplete layout snapshots.`,
        );
    }

    let derivedLayout: ReturnType<typeof resolveAdvancedSowingLayout>;
    let expectedPositionIndices: number[];
    try {
        derivedLayout = resolveAdvancedSowingLayout({
            minDistanceCm: planting.minSeedingDistanceCm,
            optimalDistanceCm: planting.optimalSeedingDistanceCm,
            maxDistanceCm: planting.maxSeedingDistanceCm,
            selectedDistanceCm: planting.selectedSeedingDistanceCm,
        });
        expectedPositionIndices = getAdvancedSowingFootprintPositions({
            anchorPositionIndex: planting.anchorPositionIndex,
            bedFieldCount: ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
            fieldSpanRows: derivedLayout.fieldSpanRows,
            fieldSpanColumns: derivedLayout.fieldSpanColumns,
        });
    } catch (error) {
        throw new RaisedBedPlantingError(
            'integrity_error',
            error instanceof Error
                ? `Selected planting ${planting.id.toString()} has an invalid canonical layout: ${error.message}`
                : `Selected planting ${planting.id.toString()} has an invalid canonical layout.`,
        );
    }

    if (
        planting.plantsPerAxis !== derivedLayout.plantsPerAxis ||
        planting.plantCount !== derivedLayout.plantCount ||
        planting.layoutKey !== derivedLayout.layoutKey ||
        planting.spanRows !== derivedLayout.fieldSpanRows ||
        planting.spanColumns !== derivedLayout.fieldSpanColumns ||
        planting.layoutVersion !== 1 ||
        memberships.some((membership) => {
            const expectedPositionIndex =
                expectedPositionIndices[
                    membership.relativeRow * planting.spanColumns +
                        membership.relativeColumn
                ];
            return (
                membership.raisedBedField.positionIndex !==
                expectedPositionIndex
            );
        })
    ) {
        throw new RaisedBedPlantingError(
            'integrity_error',
            `Selected planting ${planting.id.toString()} does not match its canonical layout or field geometry.`,
        );
    }
}

async function loadPlantingMemberships(
    plantingIds: number[],
    db: DatabaseClient,
    includeDeleted: boolean,
) {
    if (plantingIds.length === 0) {
        return new Map<number, RaisedBedPlantingFieldMembership[]>();
    }

    const rows = await db
        .select({
            membership: raisedBedPlantingFields,
            raisedBedField: {
                id: raisedBedFields.id,
                raisedBedId: raisedBedFields.raisedBedId,
                positionIndex: raisedBedFields.positionIndex,
                isDeleted: raisedBedFields.isDeleted,
            },
        })
        .from(raisedBedPlantingFields)
        .innerJoin(
            raisedBedFields,
            eq(raisedBedPlantingFields.raisedBedFieldId, raisedBedFields.id),
        )
        .where(
            and(
                inArray(raisedBedPlantingFields.plantingId, plantingIds),
                includeDeleted
                    ? undefined
                    : eq(raisedBedPlantingFields.isDeleted, false),
            ),
        )
        .orderBy(
            asc(raisedBedPlantingFields.plantingId),
            asc(raisedBedPlantingFields.relativeRow),
            asc(raisedBedPlantingFields.relativeColumn),
            asc(raisedBedPlantingFields.id),
        );

    const membershipsByPlantingId = new Map<
        number,
        RaisedBedPlantingFieldMembership[]
    >();
    for (const row of rows) {
        const membership = {
            ...row.membership,
            raisedBedField: row.raisedBedField,
        };
        const existing =
            membershipsByPlantingId.get(row.membership.plantingId) ?? [];
        existing.push(membership);
        membershipsByPlantingId.set(row.membership.plantingId, existing);
    }
    return membershipsByPlantingId;
}

type LegacyPlantCycleIdentity = {
    legacyPlantPlaceEventId: number;
    raisedBedId: number;
    positionIndex: number;
};

async function loadAuthoritativeLegacyPlantCycles(
    identities: readonly LegacyPlantCycleIdentity[],
    db: DatabaseClient,
) {
    if (identities.length === 0) {
        return new Map<number, LegacyRaisedBedPlantCycleProjection>();
    }
    const aggregateIds = Array.from(
        new Set(
            identities.map(
                (identity) =>
                    `${identity.raisedBedId.toString()}|${identity.positionIndex.toString()}`,
            ),
        ),
    );
    const sourceEvents = await getAllEvents(
        [...legacyRaisedBedPlantCycleEventTypes],
        aggregateIds,
        { db },
    );
    let projectedCycles: LegacyRaisedBedPlantCycleProjection[];
    try {
        projectedCycles = projectLegacyRaisedBedPlantCycles(sourceEvents);
    } catch (error) {
        throw new RaisedBedPlantingError(
            'integrity_error',
            error instanceof Error
                ? `Legacy planting lifecycle projection failed: ${error.message}`
                : 'Legacy planting lifecycle projection failed.',
        );
    }

    const cyclesBySourceEventId = new Map(
        projectedCycles.map((cycle) => [cycle.sourceEventId, cycle]),
    );
    for (const identity of identities) {
        const cycle = cyclesBySourceEventId.get(
            identity.legacyPlantPlaceEventId,
        );
        if (
            !cycle ||
            cycle.raisedBedId !== identity.raisedBedId ||
            cycle.positionIndex !== identity.positionIndex
        ) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                `Legacy plant-place event ${identity.legacyPlantPlaceEventId.toString()} does not identify the planting's field cycle.`,
            );
        }
    }
    return cyclesBySourceEventId;
}

async function loadSelectedPlantingLifecycles(
    plantings: readonly SelectRaisedBedPlanting[],
    db: DatabaseClient,
) {
    const selectedPlantings = plantings.filter(
        (planting) => planting.configurationSource === 'selected',
    );
    if (selectedPlantings.length === 0) {
        return new Map<number, SelectedRaisedBedPlantingLifecycleProjection>();
    }
    const aggregateIds = selectedPlantings.map(
        (planting) => planting.eventAggregateId,
    );
    const sourceEvents = await getAllEvents(
        [...selectedRaisedBedPlantingEventTypes],
        aggregateIds,
        { db },
    );
    const eventsByAggregateId = new Map<string, typeof sourceEvents>();
    for (const event of sourceEvents) {
        const existing = eventsByAggregateId.get(event.aggregateId) ?? [];
        existing.push(event);
        eventsByAggregateId.set(event.aggregateId, existing);
    }

    const projections = new Map<
        number,
        SelectedRaisedBedPlantingLifecycleProjection
    >();
    for (const planting of selectedPlantings) {
        let projection: SelectedRaisedBedPlantingLifecycleProjection;
        try {
            projection = projectSelectedRaisedBedPlantingLifecycle(
                eventsByAggregateId.get(planting.eventAggregateId) ?? [],
                {
                    aggregateId: planting.eventAggregateId,
                    plantingId: planting.id,
                    plantSortId: planting.plantSortId,
                },
            );
        } catch (error) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                error instanceof Error
                    ? `Selected planting ${planting.id.toString()} lifecycle projection failed: ${error.message}`
                    : `Selected planting ${planting.id.toString()} lifecycle projection failed.`,
            );
        }
        if (projection.isActive !== planting.isActive) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                `Selected planting ${planting.id.toString()} persisted occupancy does not match its lifecycle.`,
            );
        }
        projections.set(planting.id, projection);
    }
    return projections;
}

async function loadRaisedBedPlantings(
    where: SQL,
    db: DatabaseClient,
    includeDeleted = false,
) {
    const plantings = await db
        .select()
        .from(raisedBedPlantings)
        .where(
            and(
                where,
                includeDeleted
                    ? undefined
                    : eq(raisedBedPlantings.isDeleted, false),
            ),
        )
        .orderBy(asc(raisedBedPlantings.id));
    const membershipsByPlantingId = await loadPlantingMemberships(
        plantings.map((planting) => planting.id),
        db,
        includeDeleted,
    );
    const legacyCycleIdentities = plantings.flatMap((planting) => {
        if (planting.configurationSource !== 'legacy') {
            return [];
        }
        const legacyPlantPlaceEventId = planting.legacyPlantPlaceEventId;
        const anchorMembership = (
            membershipsByPlantingId.get(planting.id) ?? []
        ).find((membership) => membership.isAnchor);
        if (legacyPlantPlaceEventId === null || !anchorMembership) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                `Legacy planting ${planting.id.toString()} has no source event or anchor membership.`,
            );
        }
        return [
            {
                legacyPlantPlaceEventId,
                raisedBedId: planting.raisedBedId,
                positionIndex: anchorMembership.raisedBedField.positionIndex,
            },
        ];
    });
    const legacyCyclesBySourceEventId =
        await loadAuthoritativeLegacyPlantCycles(legacyCycleIdentities, db);
    const selectedLifecyclesByPlantingId = await loadSelectedPlantingLifecycles(
        plantings,
        db,
    );

    return plantings.map((planting): RaisedBedPlantingWithFields => {
        const memberships = membershipsByPlantingId.get(planting.id) ?? [];
        const legacyCycle =
            planting.legacyPlantPlaceEventId === null
                ? null
                : (legacyCyclesBySourceEventId.get(
                      planting.legacyPlantPlaceEventId,
                  ) ?? null);
        const authoritativePlanting = legacyCycle
            ? {
                  ...planting,
                  isActive: legacyCycle.isActive,
                  plantSortId: legacyCycle.plantSortId,
              }
            : planting;
        const selectedLifecycle =
            selectedLifecyclesByPlantingId.get(planting.id) ?? null;
        if (
            authoritativePlanting.configurationSource === 'selected' &&
            !selectedLifecycle
        ) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                `Selected planting ${planting.id.toString()} has no canonical lifecycle-started event.`,
            );
        }
        if (!authoritativePlanting.isDeleted) {
            assertRaisedBedPlantingIntegrity(
                authoritativePlanting,
                memberships,
            );
        }
        return {
            ...authoritativePlanting,
            lifecycleStartedAt:
                legacyCycle?.startedAt ??
                selectedLifecycle?.startedAt ??
                authoritativePlanting.createdAt,
            lifecycleStoppedAt:
                legacyCycle?.stoppedAt ?? selectedLifecycle?.stoppedAt ?? null,
            lifecycleVersionEventId:
                legacyCycle?.versionEventId ??
                selectedLifecycle?.versionEventId ??
                null,
            lifecycleStatus: selectedLifecycle?.status ?? null,
            lifecycleStatusEventId: selectedLifecycle?.statusEventId ?? null,
            lifecycleStatusChanges: selectedLifecycle?.statusChanges ?? [],
            selectedTask: selectedLifecycle?.task ?? null,
            memberships,
        };
    });
}

export async function getRaisedBedPlanting(
    plantingId: number,
    db: DatabaseClient = storage(),
) {
    const validPlantingId = positiveSafeInteger(plantingId, 'Planting ID');
    return (
        (
            await loadRaisedBedPlantings(
                eq(raisedBedPlantings.id, validPlantingId),
                db,
            )
        )[0] ?? null
    );
}

export async function getRaisedBedPlantingByEventAggregateId(
    eventAggregateId: string,
    db: DatabaseClient = storage(),
) {
    const validEventAggregateId = requiredString(
        eventAggregateId,
        'Planting event aggregate ID',
    );
    return (
        (
            await loadRaisedBedPlantings(
                eq(raisedBedPlantings.eventAggregateId, validEventAggregateId),
                db,
            )
        )[0] ?? null
    );
}

export async function getRaisedBedPlantingByLegacyPlantPlaceEventId(
    legacyPlantPlaceEventId: number,
    db: DatabaseClient = storage(),
) {
    const validEventId = positiveSafeInteger(
        legacyPlantPlaceEventId,
        'Legacy plant-place event ID',
    );
    return (
        (
            await loadRaisedBedPlantings(
                eq(raisedBedPlantings.legacyPlantPlaceEventId, validEventId),
                db,
            )
        )[0] ?? null
    );
}

export async function getRaisedBedPlantingsForRaisedBed(
    raisedBedId: number,
    db: DatabaseClient = storage(),
) {
    const validRaisedBedId = positiveSafeInteger(raisedBedId, 'Raised bed ID');
    return (
        (await getRaisedBedPlantingsForRaisedBeds([validRaisedBedId], db)).get(
            validRaisedBedId,
        ) ?? []
    );
}

/**
 * Loads complete planting projections for multiple raised beds in one pair of
 * queries (plantings, then memberships). Every requested bed has a map entry,
 * including beds without planting history.
 */
export async function getRaisedBedPlantingsForRaisedBeds(
    raisedBedIds: number[],
    db: DatabaseClient = storage(),
) {
    const uniqueRaisedBedIds = Array.from(
        new Set(
            raisedBedIds.map((raisedBedId) =>
                positiveSafeInteger(raisedBedId, 'Raised bed ID'),
            ),
        ),
    );
    const plantingsByRaisedBedId = new Map<
        number,
        RaisedBedPlantingWithFields[]
    >();
    for (const raisedBedId of uniqueRaisedBedIds) {
        plantingsByRaisedBedId.set(raisedBedId, []);
    }
    if (uniqueRaisedBedIds.length === 0) {
        return plantingsByRaisedBedId;
    }

    const plantings = await loadRaisedBedPlantings(
        inArray(raisedBedPlantings.raisedBedId, uniqueRaisedBedIds),
        db,
    );
    for (const planting of plantings) {
        plantingsByRaisedBedId.get(planting.raisedBedId)?.push(planting);
    }
    return plantingsByRaisedBedId;
}

async function acquirePlantingIdentityLocks(
    transaction: TransactionClient,
    input: NormalizedCreateRaisedBedPlantingInput,
) {
    const lockKeys = [
        `raised-bed-planting:event:${input.eventAggregateId}`,
        ...(input.legacyPlantPlaceEventId === null
            ? []
            : [
                  `raised-bed-planting:legacy-event:${input.legacyPlantPlaceEventId.toString()}`,
              ]),
    ].sort();
    for (const lockKey of lockKeys) {
        await transaction.execute(
            sql`select pg_advisory_xact_lock(hashtext(${lockKey}));`,
        );
    }
}

async function lockRaisedBed(
    transaction: TransactionClient,
    input: NormalizedCreateRaisedBedPlantingInput,
) {
    const [raisedBed] = await transaction
        .select({ id: raisedBeds.id, isDeleted: raisedBeds.isDeleted })
        .from(raisedBeds)
        .where(eq(raisedBeds.id, input.raisedBedId))
        .limit(1)
        .for('update');
    const permitsDeletedHistoricalBed =
        input.configurationSource === 'legacy' && !input.isActive;
    if (!raisedBed || (raisedBed.isDeleted && !permitsDeletedHistoricalBed)) {
        throw new RaisedBedPlantingError(
            'raised_bed_not_found',
            `Raised bed ${input.raisedBedId.toString()} was not found.`,
        );
    }
}

async function assertPlantSort(
    transaction: TransactionClient,
    plantSortId: number,
) {
    const [plantSort] = await transaction
        .select({ id: entities.id, entityTypeName: entities.entityTypeName })
        .from(entities)
        .where(eq(entities.id, plantSortId))
        .limit(1);
    if (plantSort?.entityTypeName !== 'plantSort') {
        throw new RaisedBedPlantingError(
            'plant_sort_not_found',
            `Plant sort ${plantSortId.toString()} was not found.`,
        );
    }
}

async function loadExistingByIdentity(
    transaction: TransactionClient,
    input: NormalizedCreateRaisedBedPlantingInput,
) {
    if (input.legacyPlantPlaceEventId !== null) {
        const [existing] = await loadRaisedBedPlantings(
            eq(
                raisedBedPlantings.legacyPlantPlaceEventId,
                input.legacyPlantPlaceEventId,
            ),
            transaction,
            true,
        );
        if (existing) {
            if (
                existing.raisedBedId !== input.raisedBedId ||
                (input.configurationSource === 'selected' &&
                    existing.plantSortId !== input.plantSortId) ||
                existing.eventAggregateId !== input.eventAggregateId
            ) {
                throw new RaisedBedPlantingError(
                    'legacy_event_conflict',
                    'The legacy plant-place event is already attached to a different planting identity.',
                );
            }
            if (!isSameRaisedBedPlantingImmutablePlan(existing, input)) {
                throw new RaisedBedPlantingError(
                    'identity_replay_conflict',
                    'The legacy plant-place event was replayed with a different immutable planting plan.',
                );
            }
            return existing;
        }
    }

    const [existingAggregate] = await loadRaisedBedPlantings(
        eq(raisedBedPlantings.eventAggregateId, input.eventAggregateId),
        transaction,
        true,
    );
    if (!existingAggregate) {
        return null;
    }
    if (
        existingAggregate.raisedBedId !== input.raisedBedId ||
        (input.configurationSource === 'selected' &&
            existingAggregate.plantSortId !== input.plantSortId) ||
        existingAggregate.legacyPlantPlaceEventId !==
            input.legacyPlantPlaceEventId
    ) {
        throw new RaisedBedPlantingError(
            'event_aggregate_conflict',
            'The event aggregate ID is already attached to a different planting identity.',
        );
    }
    if (!isSameRaisedBedPlantingImmutablePlan(existingAggregate, input)) {
        throw new RaisedBedPlantingError(
            'identity_replay_conflict',
            'The event aggregate ID was replayed with a different immutable planting plan.',
        );
    }
    return existingAggregate;
}

async function lockAndValidateFields(
    transaction: TransactionClient,
    input: NormalizedCreateRaisedBedPlantingInput,
) {
    const requestedFieldIds = input.memberships
        .map((membership) => membership.raisedBedFieldId)
        .sort((left, right) => left - right);
    const fields = await transaction
        .select({
            id: raisedBedFields.id,
            raisedBedId: raisedBedFields.raisedBedId,
            positionIndex: raisedBedFields.positionIndex,
            isDeleted: raisedBedFields.isDeleted,
        })
        .from(raisedBedFields)
        .where(inArray(raisedBedFields.id, requestedFieldIds))
        .orderBy(asc(raisedBedFields.id))
        .for('update');

    const permitsDeletedHistoricalFields =
        input.configurationSource === 'legacy' && !input.isActive;
    const availableFields = permitsDeletedHistoricalFields
        ? fields
        : fields.filter((field) => !field.isDeleted);
    if (availableFields.length !== requestedFieldIds.length) {
        throw new RaisedBedPlantingError(
            'field_not_found',
            'One or more raised-bed fields were not found or are deleted.',
        );
    }
    if (
        availableFields.some((field) => field.raisedBedId !== input.raisedBedId)
    ) {
        throw new RaisedBedPlantingError(
            'field_bed_mismatch',
            'Every planting field must belong to the requested raised bed.',
        );
    }
    const positionIndices = new Set(
        availableFields.map((field) => field.positionIndex),
    );
    if (positionIndices.size !== availableFields.length) {
        throw new RaisedBedPlantingError(
            'duplicate_field_position',
            'A planting cannot contain multiple physical fields at the same position.',
        );
    }

    const fieldsById = new Map(
        availableFields.map((field) => [field.id, field]),
    );
    const anchorMembership = input.memberships.find(
        (membership) => membership.isAnchor,
    );
    const anchorField = anchorMembership
        ? fieldsById.get(anchorMembership.raisedBedFieldId)
        : undefined;
    if (anchorField?.positionIndex !== input.anchorPositionIndex) {
        throw new RaisedBedPlantingError(
            'anchor_mismatch',
            'The anchor field does not match the planting anchor position.',
        );
    }

    if (input.configurationSource === 'selected') {
        let expectedPositionIndices: number[];
        try {
            expectedPositionIndices = getAdvancedSowingFootprintPositions({
                anchorPositionIndex: input.anchorPositionIndex,
                bedFieldCount: ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
                fieldSpanRows: input.spanRows,
                fieldSpanColumns: input.spanColumns,
            });
        } catch (error) {
            invalidInput(
                error instanceof Error
                    ? `Selected planting footprint is invalid: ${error.message}`
                    : 'Selected planting footprint is invalid.',
            );
        }

        for (const membership of input.memberships) {
            const field = fieldsById.get(membership.raisedBedFieldId);
            const expectedPositionIndex =
                expectedPositionIndices[
                    membership.relativeRow * input.spanColumns +
                        membership.relativeColumn
                ];
            if (field?.positionIndex !== expectedPositionIndex) {
                invalidInput(
                    'Selected planting field positions and relative coordinates must exactly match the canonical Advanced Sowing footprint.',
                );
            }
        }
    }

    return fieldsById;
}

async function assertNoActiveLayoutCollision(
    transaction: TransactionClient,
    input: NormalizedCreateRaisedBedPlantingInput,
) {
    if (!input.isActive) {
        return;
    }
    const fieldIds = input.memberships.map(
        (membership) => membership.raisedBedFieldId,
    );
    const collisions = await transaction
        .select({
            plantingId: raisedBedPlantings.id,
            raisedBedId: raisedBedPlantings.raisedBedId,
            raisedBedFieldId: raisedBedPlantingFields.raisedBedFieldId,
            positionIndex: raisedBedFields.positionIndex,
            legacyPlantPlaceEventId: raisedBedPlantings.legacyPlantPlaceEventId,
            layoutKey: raisedBedPlantings.layoutKey,
            configurationSource: raisedBedPlantings.configurationSource,
            isActive: raisedBedPlantings.isActive,
            plantingIsDeleted: raisedBedPlantings.isDeleted,
            membershipIsDeleted: raisedBedPlantingFields.isDeleted,
        })
        .from(raisedBedPlantingFields)
        .innerJoin(
            raisedBedPlantings,
            eq(raisedBedPlantingFields.plantingId, raisedBedPlantings.id),
        )
        .innerJoin(
            raisedBedFields,
            eq(raisedBedPlantingFields.raisedBedFieldId, raisedBedFields.id),
        )
        .where(
            and(
                inArray(raisedBedPlantingFields.raisedBedFieldId, fieldIds),
                eq(raisedBedPlantingFields.isDeleted, false),
                eq(raisedBedPlantings.isDeleted, false),
                or(
                    eq(raisedBedPlantings.configurationSource, 'legacy'),
                    eq(raisedBedPlantings.isActive, true),
                ),
            ),
        )
        .orderBy(asc(raisedBedPlantings.id));
    const legacyCyclesBySourceEventId =
        await loadAuthoritativeLegacyPlantCycles(
            collisions.flatMap((collision) => {
                if (collision.configurationSource !== 'legacy') {
                    return [];
                }
                if (collision.legacyPlantPlaceEventId === null) {
                    throw new RaisedBedPlantingError(
                        'integrity_error',
                        `Legacy planting ${collision.plantingId.toString()} has no source event.`,
                    );
                }
                return [
                    {
                        legacyPlantPlaceEventId:
                            collision.legacyPlantPlaceEventId,
                        raisedBedId: collision.raisedBedId,
                        positionIndex: collision.positionIndex,
                    },
                ];
            }),
            transaction,
        );
    const authoritativeOccupancies = collisions.map((collision) => ({
        ...collision,
        isActive:
            collision.legacyPlantPlaceEventId === null
                ? collision.isActive
                : (legacyCyclesBySourceEventId.get(
                      collision.legacyPlantPlaceEventId,
                  )?.isActive ?? collision.isActive),
    }));
    if (input.layoutKey === null) {
        const occupied = authoritativeOccupancies.find(
            (occupancy) =>
                occupancy.isActive &&
                !occupancy.plantingIsDeleted &&
                !occupancy.membershipIsDeleted,
        );
        if (occupied) {
            throw new RaisedBedPlantingError(
                'layout_collision',
                `Legacy planting cannot occupy field ${occupied.raisedBedFieldId.toString()} while another planting is active.`,
            );
        }
        return;
    }
    const conflict = findRaisedBedPlantingLayoutConflict(
        authoritativeOccupancies,
        input.layoutKey,
    );
    if (conflict?.code === 'legacy_layout_unknown') {
        throw new RaisedBedPlantingError(
            'legacy_layout_unknown',
            `Field ${conflict.occupancy.raisedBedFieldId.toString()} contains an active legacy planting with no layout key.`,
        );
    }
    if (conflict?.code === 'layout_collision') {
        throw new RaisedBedPlantingError(
            'layout_collision',
            `Layout ${input.layoutKey} is already active in field ${conflict.occupancy.raisedBedFieldId.toString()}.`,
        );
    }
}

async function assertNoBlockingPlantOperations(
    transaction: TransactionClient,
    input: NormalizedCreateRaisedBedPlantingInput,
    fieldsById: ReadonlyMap<
        number,
        Pick<SelectRaisedBedField, 'id' | 'positionIndex'>
    >,
) {
    if (input.configurationSource !== 'selected' || !input.isActive) {
        return;
    }

    const conflicts = await getBlockingPlantOperationsForRaisedBedFootprint(
        {
            raisedBedId: input.raisedBedId,
            positionIndices: Array.from(fieldsById.values()).map(
                (field) => field.positionIndex,
            ),
        },
        transaction,
    );
    if (conflicts.length > 0) {
        throw new RaisedBedPlantingError(
            'plant_operation_conflict',
            'A selected planting cannot occupy a field with an unresolved plant-scoped operation.',
        );
    }
}

async function createRaisedBedPlantingInTransaction(
    transaction: TransactionClient,
    input: NormalizedCreateRaisedBedPlantingInput,
): Promise<CreateRaisedBedPlantingResult> {
    await acquirePlantingIdentityLocks(transaction, input);
    const existing = await loadExistingByIdentity(transaction, input);
    if (existing) {
        return { planting: existing, created: false };
    }

    await assertPlantSort(transaction, input.plantSortId);
    const fieldsById = await lockAndValidateFields(transaction, input);
    // Legacy checkout/task mutations already lock field rows before the bed.
    // Preserve that global order to avoid a bed->field / field->bed deadlock.
    await lockRaisedBed(transaction, input);
    await assertNoBlockingPlantOperations(transaction, input, fieldsById);
    await assertNoActiveLayoutCollision(transaction, input);

    const [planting] = await transaction
        .insert(raisedBedPlantings)
        .values({
            raisedBedId: input.raisedBedId,
            plantSortId: input.plantSortId,
            eventAggregateId: input.eventAggregateId,
            legacyPlantPlaceEventId: input.legacyPlantPlaceEventId,
            anchorPositionIndex: input.anchorPositionIndex,
            minSeedingDistanceCm: input.minSeedingDistanceCm,
            optimalSeedingDistanceCm: input.optimalSeedingDistanceCm,
            maxSeedingDistanceCm: input.maxSeedingDistanceCm,
            selectedSeedingDistanceCm: input.selectedSeedingDistanceCm,
            plantsPerAxis: input.plantsPerAxis,
            plantCount: input.plantCount,
            layoutKey: input.layoutKey,
            spanRows: input.spanRows,
            spanColumns: input.spanColumns,
            layoutVersion: input.layoutVersion,
            configurationSource: input.configurationSource,
            isActive: input.isActive,
        })
        .returning();
    if (!planting) {
        throw new RaisedBedPlantingError(
            'integrity_error',
            'Failed to create the raised-bed planting.',
        );
    }

    const insertedMemberships = await transaction
        .insert(raisedBedPlantingFields)
        .values(
            input.memberships.map((membership) => ({
                plantingId: planting.id,
                raisedBedFieldId: membership.raisedBedFieldId,
                relativeRow: membership.relativeRow,
                relativeColumn: membership.relativeColumn,
                isAnchor: membership.isAnchor,
            })),
        )
        .returning();
    const memberships = insertedMemberships
        .map((membership): RaisedBedPlantingFieldMembership => {
            const raisedBedField = fieldsById.get(membership.raisedBedFieldId);
            if (!raisedBedField) {
                throw new RaisedBedPlantingError(
                    'integrity_error',
                    'A planting membership references an unavailable field.',
                );
            }
            return { ...membership, raisedBedField };
        })
        .sort(
            (left, right) =>
                left.relativeRow - right.relativeRow ||
                left.relativeColumn - right.relativeColumn ||
                left.id - right.id,
        );
    let selectedLifecycle: SelectedRaisedBedPlantingLifecycleProjection | null =
        null;
    if (planting.configurationSource === 'selected') {
        const lifecycleStarted = input.lifecycleStarted;
        if (!lifecycleStarted) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                'A selected planting cannot be created without its lifecycle-started snapshot.',
            );
        }
        const startEvent = await createEvent(
            knownEvents.raisedBedPlantings.lifecycleStartedV1(
                planting.eventAggregateId,
                {
                    ...lifecycleStarted,
                    plantingId: planting.id,
                    plantSortId: planting.plantSortId,
                    status: 'planned',
                },
            ),
            transaction,
        );
        try {
            selectedLifecycle = projectSelectedRaisedBedPlantingLifecycle(
                [startEvent],
                {
                    aggregateId: planting.eventAggregateId,
                    plantingId: planting.id,
                    plantSortId: planting.plantSortId,
                },
            );
        } catch (error) {
            throw new RaisedBedPlantingError(
                'integrity_error',
                error instanceof Error
                    ? `Selected planting lifecycle creation failed: ${error.message}`
                    : 'Selected planting lifecycle creation failed.',
            );
        }
    }
    const legacyCycle =
        planting.legacyPlantPlaceEventId === null
            ? null
            : ((
                  await loadAuthoritativeLegacyPlantCycles(
                      [
                          {
                              legacyPlantPlaceEventId:
                                  planting.legacyPlantPlaceEventId,
                              raisedBedId: planting.raisedBedId,
                              positionIndex: planting.anchorPositionIndex,
                          },
                      ],
                      transaction,
                  )
              ).get(planting.legacyPlantPlaceEventId) ?? null);
    const authoritativePlanting = legacyCycle
        ? {
              ...planting,
              isActive: legacyCycle.isActive,
              plantSortId: legacyCycle.plantSortId,
          }
        : planting;
    assertRaisedBedPlantingIntegrity(authoritativePlanting, memberships);

    return {
        planting: {
            ...authoritativePlanting,
            lifecycleStartedAt:
                legacyCycle?.startedAt ??
                selectedLifecycle?.startedAt ??
                authoritativePlanting.createdAt,
            lifecycleStoppedAt:
                legacyCycle?.stoppedAt ?? selectedLifecycle?.stoppedAt ?? null,
            lifecycleVersionEventId:
                legacyCycle?.versionEventId ??
                selectedLifecycle?.versionEventId ??
                null,
            lifecycleStatus: selectedLifecycle?.status ?? null,
            lifecycleStatusEventId: selectedLifecycle?.statusEventId ?? null,
            lifecycleStatusChanges: selectedLifecycle?.statusChanges ?? [],
            selectedTask: selectedLifecycle?.task ?? null,
            memberships,
        },
        created: true,
    };
}

/**
 * Standalone creation invalidates Admin/Farm schedule reads after commit. When
 * a caller supplies a transaction, it owns commit and must call
 * `bustRaisedBedPlantingReadCaches` only after that commit succeeds.
 */
export async function createRaisedBedPlanting(
    input: CreateRaisedBedPlantingInput,
    transaction?: TransactionClient,
) {
    const normalizedInput = validateRaisedBedPlantingInput(input);
    if (transaction) {
        return createRaisedBedPlantingInTransaction(
            transaction,
            normalizedInput,
        );
    }

    const result = await storage().transaction((tx) =>
        createRaisedBedPlantingInTransaction(tx, normalizedInput),
    );
    await bustRaisedBedPlantingReadCaches();
    return result;
}

/**
 * Ensures that one authoritative legacy plant-place event has its stable
 * planting projection. This is idempotent by source event ID and is intended
 * to run in the same transaction as the event writer.
 */
export async function ensureLegacyRaisedBedPlantingProjection(
    legacyPlantPlaceEventId: number,
    raisedBedFieldId: number,
    transaction: TransactionClient,
) {
    const validEventId = positiveSafeInteger(
        legacyPlantPlaceEventId,
        'Legacy plant-place event ID',
    );
    const validFieldId = positiveSafeInteger(
        raisedBedFieldId,
        'Raised bed field ID',
    );
    const [sourceEvent] = await transaction
        .select()
        .from(events)
        .where(eq(events.id, validEventId))
        .limit(1);
    if (
        !sourceEvent ||
        sourceEvent.type !== knownEventTypes.raisedBedFields.plantPlace ||
        sourceEvent.version !== 1
    ) {
        throw new RaisedBedPlantingError(
            'legacy_event_conflict',
            `Event ${validEventId.toString()} is not a supported legacy plant-place event.`,
        );
    }

    let cycle: LegacyRaisedBedPlantCycleProjection | undefined;
    try {
        const aggregateHistory = await getAllEvents(
            [...legacyRaisedBedPlantCycleEventTypes],
            [sourceEvent.aggregateId],
            { db: transaction },
        );
        cycle = projectLegacyRaisedBedPlantCycles(aggregateHistory).find(
            (candidate) => candidate.sourceEventId === validEventId,
        );
    } catch (error) {
        throw new RaisedBedPlantingError(
            'legacy_event_conflict',
            error instanceof Error
                ? `Legacy plant-place event is invalid: ${error.message}`
                : 'Legacy plant-place event is invalid.',
        );
    }
    if (!cycle || cycle.sourceEventId !== validEventId) {
        throw new RaisedBedPlantingError(
            'legacy_event_conflict',
            `Event ${validEventId.toString()} did not produce a legacy planting cycle.`,
        );
    }

    return createRaisedBedPlanting(
        {
            raisedBedId: cycle.raisedBedId,
            plantSortId: cycle.plantSortId,
            eventAggregateId: `raised-bed-planting:legacy:${validEventId.toString()}`,
            legacyPlantPlaceEventId: validEventId,
            anchorPositionIndex: cycle.positionIndex,
            configurationSource: 'legacy',
            isActive: cycle.isActive,
            memberships: [
                {
                    raisedBedFieldId: validFieldId,
                    relativeRow: 0,
                    relativeColumn: 0,
                    isAnchor: true,
                },
            ],
        },
        transaction,
    );
}

/**
 * Writes a legacy plant-place event and its projection atomically. Callers
 * must supply their authoritative planting transaction and invalidate shared
 * schedule reads only after that transaction commits.
 */
export async function createLegacyRaisedBedPlantPlaceWithProjection(
    input: CreateLegacyRaisedBedPlantPlaceWithProjectionInput,
    transaction: TransactionClient,
) {
    if (
        input.event.type !== knownEventTypes.raisedBedFields.plantPlace ||
        input.event.version !== 1
    ) {
        throw new RaisedBedPlantingError(
            'invalid_input',
            'Only a version 1 raised-bed field plant-place event can create a legacy planting projection.',
        );
    }

    const event = await createEvent(input.event, transaction);
    const projection = await ensureLegacyRaisedBedPlantingProjection(
        event.id,
        input.raisedBedFieldId,
        transaction,
    );
    return { event, ...projection };
}

/**
 * Caller-owned transactions must invoke this only after their commit succeeds.
 * Invalidating inside the transaction could publish state that later rolls back.
 */
export async function bustRaisedBedPlantingReadCaches() {
    await bustScheduleCache();
}
