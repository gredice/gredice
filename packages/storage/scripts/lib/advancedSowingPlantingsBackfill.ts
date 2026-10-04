import { createHash } from 'node:crypto';
import {
    type LegacyRaisedBedPlantCycleEvent,
    type LegacyRaisedBedPlantCycleProjection,
    LegacyRaisedBedPlantCycleProjectionError,
    legacyRaisedBedPlantCycleEventTypes,
    projectLegacyRaisedBedPlantCycles,
} from '../../src/helpers/legacyRaisedBedPlantCycles';

export const advancedSowingPlantCycleEventTypes =
    legacyRaisedBedPlantCycleEventTypes;

export type AdvancedSowingPlantingsBackfillReasonCode =
    | 'active_bed_deleted'
    | 'active_field_deleted'
    | 'duplicate_field_mismatch'
    | 'duplicate_source_event'
    | 'duplicate_source_mapping'
    | 'malformed_aggregate'
    | 'malformed_sort'
    | 'missing_field'
    | 'missing_plant_sort'
    | 'missing_raised_bed'
    | 'orphan_legacy_projection'
    | 'projection_mismatch'
    | 'source_history_changed'
    | 'unsupported_event_version'
    | 'verification_failed';

type BackfillDiagnostics = {
    eventId?: number;
    plantingId?: number;
    raisedBedId?: number;
    positionIndex?: number;
    fieldId?: number;
    conflictingId?: number;
};

export class AdvancedSowingPlantingsBackfillError extends Error {
    override readonly name = 'AdvancedSowingPlantingsBackfillError';

    constructor(
        readonly reasonCode: AdvancedSowingPlantingsBackfillReasonCode,
        readonly diagnostics: BackfillDiagnostics = {},
        message = 'Advanced sowing planting backfill preflight failed.',
    ) {
        super(message);
    }
}

export type AdvancedSowingBackfillSourceEvent = LegacyRaisedBedPlantCycleEvent;

export type AdvancedSowingBackfillRaisedBed = {
    id: number;
    isDeleted: boolean;
};

export type AdvancedSowingBackfillRaisedBedField = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    createdAt: Date;
    isDeleted: boolean;
};

export type AdvancedSowingBackfillEntity = {
    id: number;
    entityTypeName: string;
    isDeleted: boolean;
};

export type AdvancedSowingBackfillPlantingMembership = {
    raisedBedFieldId: number;
    relativeRow: number;
    relativeColumn: number;
    isAnchor: boolean;
    isDeleted: boolean;
};

export type AdvancedSowingBackfillExistingPlanting = {
    id: number;
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
    configurationSource: string;
    isActive: boolean;
    isDeleted: boolean;
    memberships: AdvancedSowingBackfillPlantingMembership[];
};

export type AdvancedSowingLegacyPlantingInput = {
    raisedBedId: number;
    plantSortId: number;
    eventAggregateId: string;
    legacyPlantPlaceEventId: number;
    anchorPositionIndex: number;
    minSeedingDistanceCm: null;
    optimalSeedingDistanceCm: null;
    maxSeedingDistanceCm: null;
    selectedSeedingDistanceCm: null;
    plantsPerAxis: null;
    plantCount: null;
    layoutKey: null;
    spanRows: 1;
    spanColumns: 1;
    layoutVersion: 1;
    configurationSource: 'legacy';
    isActive: boolean;
    memberships: [
        {
            raisedBedFieldId: number;
            relativeRow: 0;
            relativeColumn: 0;
            isAnchor: true;
        },
    ];
};

export type AdvancedSowingPlantingsBackfillPlanEntry = {
    action: 'create' | 'unchanged';
    sourceEventId: number;
    lifecycleStartedAt: Date;
    lifecycleVersionEventId: number;
    input: AdvancedSowingLegacyPlantingInput;
};

export type AdvancedSowingPlantingsBackfillPlan = {
    entries: AdvancedSowingPlantingsBackfillPlanEntry[];
    sourceEventCount: number;
    sourceCycleCount: number;
    existingLegacyProjectionCount: number;
    duplicateFieldGroupCount: number;
};

export type AdvancedSowingPlantingsBackfillPlanInput = {
    sourceEvents: AdvancedSowingBackfillSourceEvent[];
    raisedBeds: AdvancedSowingBackfillRaisedBed[];
    fields: AdvancedSowingBackfillRaisedBedField[];
    entities: AdvancedSowingBackfillEntity[];
    existingPlantings: AdvancedSowingBackfillExistingPlanting[];
};

function fail(
    reasonCode: AdvancedSowingPlantingsBackfillReasonCode,
    diagnostics: BackfillDiagnostics,
    message?: string,
): never {
    throw new AdvancedSowingPlantingsBackfillError(
        reasonCode,
        diagnostics,
        message,
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compareEvents(
    left: AdvancedSowingBackfillSourceEvent,
    right: AdvancedSowingBackfillSourceEvent,
) {
    const timeDifference = left.createdAt.getTime() - right.createdAt.getTime();
    return timeDifference === 0 ? left.id - right.id : timeDifference;
}

function sourceCycles(events: AdvancedSowingBackfillSourceEvent[]) {
    try {
        return projectLegacyRaisedBedPlantCycles(events);
    } catch (error) {
        if (!(error instanceof LegacyRaisedBedPlantCycleProjectionError)) {
            throw error;
        }
        const reasonCode =
            error.code === 'duplicate_event_id'
                ? 'duplicate_source_event'
                : error.code === 'unsupported_event_version'
                  ? 'unsupported_event_version'
                  : error.code;
        fail(reasonCode, { eventId: error.eventId });
    }
}

function fieldKey(raisedBedId: number, positionIndex: number) {
    return `${raisedBedId.toString()}|${positionIndex.toString()}`;
}

function compareFields(
    left: AdvancedSowingBackfillRaisedBedField,
    right: AdvancedSowingBackfillRaisedBedField,
) {
    const createdAtDifference =
        left.createdAt.getTime() - right.createdAt.getTime();
    return createdAtDifference === 0 ? left.id - right.id : createdAtDifference;
}

// Mirrors raised-bed field projection upserts: the oldest row, then the lowest
// ID, is canonical. A duplicate set is only safe when every later row is
// already soft-deleted; otherwise the backfill stops instead of choosing one.
function fieldsByPosition(fields: AdvancedSowingBackfillRaisedBedField[]) {
    const result = new Map<string, AdvancedSowingBackfillRaisedBedField[]>();
    for (const field of fields) {
        const key = fieldKey(field.raisedBedId, field.positionIndex);
        const existing = result.get(key);
        if (existing) {
            existing.push(field);
        } else {
            result.set(key, [field]);
        }
    }
    for (const fieldRows of result.values()) {
        fieldRows.sort(compareFields);
    }
    return result;
}

function resolveCanonicalField({
    cycle,
    fieldRows,
}: {
    cycle: LegacyRaisedBedPlantCycleProjection;
    fieldRows: AdvancedSowingBackfillRaisedBedField[];
}) {
    const canonicalField = fieldRows[0];
    if (!canonicalField) {
        fail('missing_field', {
            eventId: cycle.sourceEventId,
            raisedBedId: cycle.raisedBedId,
            positionIndex: cycle.positionIndex,
        });
    }

    const activeFields = fieldRows.filter((field) => !field.isDeleted);
    const activeField = activeFields[0];
    if (
        activeFields.length > 1 ||
        (activeField && activeField.id !== canonicalField.id)
    ) {
        fail('duplicate_field_mismatch', {
            eventId: cycle.sourceEventId,
            fieldId: canonicalField.id,
            conflictingId: activeField?.id,
        });
    }
    if (cycle.isActive && canonicalField.isDeleted) {
        fail('active_field_deleted', {
            eventId: cycle.sourceEventId,
            fieldId: canonicalField.id,
        });
    }

    return canonicalField;
}

function legacyPlantingInput(
    cycle: LegacyRaisedBedPlantCycleProjection,
    field: AdvancedSowingBackfillRaisedBedField,
): AdvancedSowingLegacyPlantingInput {
    return {
        raisedBedId: cycle.raisedBedId,
        plantSortId: cycle.plantSortId,
        eventAggregateId: `raised-bed-planting:legacy:${cycle.sourceEventId.toString()}`,
        legacyPlantPlaceEventId: cycle.sourceEventId,
        anchorPositionIndex: cycle.positionIndex,
        minSeedingDistanceCm: null,
        optimalSeedingDistanceCm: null,
        maxSeedingDistanceCm: null,
        selectedSeedingDistanceCm: null,
        plantsPerAxis: null,
        plantCount: null,
        layoutKey: null,
        spanRows: 1,
        spanColumns: 1,
        layoutVersion: 1,
        configurationSource: 'legacy',
        isActive: cycle.isActive,
        memberships: [
            {
                raisedBedFieldId: field.id,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    };
}

function projectionMatches(
    existing: AdvancedSowingBackfillExistingPlanting,
    input: AdvancedSowingLegacyPlantingInput,
) {
    const membership = existing.memberships[0];
    // Legacy sort and activity columns capture the source cycle at projection
    // time. Runtime reads derive their live values from canonical events, so a
    // later replace/update/place event must not make a backfill rerun fail.
    return (
        existing.configurationSource === 'legacy' &&
        !existing.isDeleted &&
        existing.raisedBedId === input.raisedBedId &&
        existing.eventAggregateId === input.eventAggregateId &&
        existing.legacyPlantPlaceEventId === input.legacyPlantPlaceEventId &&
        existing.anchorPositionIndex === input.anchorPositionIndex &&
        existing.minSeedingDistanceCm === null &&
        existing.optimalSeedingDistanceCm === null &&
        existing.maxSeedingDistanceCm === null &&
        existing.selectedSeedingDistanceCm === null &&
        existing.plantsPerAxis === null &&
        existing.plantCount === null &&
        existing.layoutKey === null &&
        existing.spanRows === 1 &&
        existing.spanColumns === 1 &&
        existing.layoutVersion === 1 &&
        existing.memberships.length === 1 &&
        membership !== undefined &&
        !membership.isDeleted &&
        membership.raisedBedFieldId === input.memberships[0].raisedBedFieldId &&
        membership.relativeRow === 0 &&
        membership.relativeColumn === 0 &&
        membership.isAnchor
    );
}

function uniqueExistingProjection(
    input: AdvancedSowingLegacyPlantingInput,
    bySourceEventId: Map<number, AdvancedSowingBackfillExistingPlanting[]>,
    byEventAggregateId: Map<string, AdvancedSowingBackfillExistingPlanting[]>,
) {
    const candidates = new Map<
        number,
        AdvancedSowingBackfillExistingPlanting
    >();
    for (const candidate of [
        ...(bySourceEventId.get(input.legacyPlantPlaceEventId) ?? []),
        ...(byEventAggregateId.get(input.eventAggregateId) ?? []),
    ]) {
        candidates.set(candidate.id, candidate);
    }
    if (candidates.size > 1) {
        const candidateIds = [...candidates.keys()].sort(
            (left, right) => left - right,
        );
        fail('duplicate_source_mapping', {
            eventId: input.legacyPlantPlaceEventId,
            plantingId: candidateIds[0],
            conflictingId: candidateIds[1],
        });
    }
    return [...candidates.values()][0] ?? null;
}

export function parseAdvancedSowingPlantingsBackfillArgs(argv: string[]) {
    let apply = false;

    for (const argument of argv) {
        if (argument === '--') {
            continue;
        }
        if (argument === '--apply') {
            apply = true;
            continue;
        }
        throw new Error(`Unknown argument: ${argument}`);
    }

    return { apply };
}

export function planAdvancedSowingPlantingsBackfill({
    sourceEvents,
    raisedBeds,
    fields,
    entities,
    existingPlantings,
}: AdvancedSowingPlantingsBackfillPlanInput): AdvancedSowingPlantingsBackfillPlan {
    const cycles = sourceCycles(sourceEvents);
    const cyclesBySourceEventId = new Map(
        cycles.map((cycle) => [cycle.sourceEventId, cycle]),
    );
    const raisedBedsById = new Map(raisedBeds.map((bed) => [bed.id, bed]));
    const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
    const fieldsAtPosition = fieldsByPosition(fields);
    const bySourceEventId = new Map<
        number,
        AdvancedSowingBackfillExistingPlanting[]
    >();
    const byEventAggregateId = new Map<
        string,
        AdvancedSowingBackfillExistingPlanting[]
    >();

    for (const planting of existingPlantings) {
        const usesLegacyIdentity =
            planting.legacyPlantPlaceEventId !== null ||
            planting.eventAggregateId.startsWith('raised-bed-planting:legacy:');
        if (usesLegacyIdentity && planting.configurationSource !== 'legacy') {
            fail('projection_mismatch', {
                plantingId: planting.id,
                eventId: planting.legacyPlantPlaceEventId ?? undefined,
            });
        }
        if (planting.legacyPlantPlaceEventId !== null) {
            const sourceMappings =
                bySourceEventId.get(planting.legacyPlantPlaceEventId) ?? [];
            sourceMappings.push(planting);
            bySourceEventId.set(
                planting.legacyPlantPlaceEventId,
                sourceMappings,
            );
        }
        const aggregateMappings =
            byEventAggregateId.get(planting.eventAggregateId) ?? [];
        aggregateMappings.push(planting);
        byEventAggregateId.set(planting.eventAggregateId, aggregateMappings);

        if (
            planting.configurationSource === 'legacy' &&
            (planting.legacyPlantPlaceEventId === null ||
                !cyclesBySourceEventId.has(planting.legacyPlantPlaceEventId))
        ) {
            fail('orphan_legacy_projection', {
                plantingId: planting.id,
                eventId: planting.legacyPlantPlaceEventId ?? undefined,
            });
        }
    }

    const entries: AdvancedSowingPlantingsBackfillPlanEntry[] = [];
    const duplicateFieldKeys = new Set<string>();
    for (const cycle of cycles) {
        const bed = raisedBedsById.get(cycle.raisedBedId);
        if (!bed) {
            fail('missing_raised_bed', {
                eventId: cycle.sourceEventId,
                raisedBedId: cycle.raisedBedId,
            });
        }
        if (cycle.isActive && bed.isDeleted) {
            fail('active_bed_deleted', {
                eventId: cycle.sourceEventId,
                raisedBedId: cycle.raisedBedId,
            });
        }

        const plantSort = entitiesById.get(cycle.plantSortId);
        if (plantSort?.entityTypeName !== 'plantSort') {
            fail('missing_plant_sort', {
                eventId: cycle.sourceEventId,
                conflictingId: cycle.plantSortId,
            });
        }

        const key = fieldKey(cycle.raisedBedId, cycle.positionIndex);
        const fieldRows = fieldsAtPosition.get(key) ?? [];
        if (fieldRows.length > 1) {
            duplicateFieldKeys.add(key);
        }
        const field = resolveCanonicalField({ cycle, fieldRows });
        const input = legacyPlantingInput(cycle, field);
        const existing = uniqueExistingProjection(
            input,
            bySourceEventId,
            byEventAggregateId,
        );
        if (existing && !projectionMatches(existing, input)) {
            fail('projection_mismatch', {
                eventId: cycle.sourceEventId,
                plantingId: existing.id,
            });
        }
        entries.push({
            action: existing ? 'unchanged' : 'create',
            sourceEventId: cycle.sourceEventId,
            // This is the crop start used by authoritative reads. It is
            // intentionally not written to planting.createdAt, which records
            // when this projection row was created.
            lifecycleStartedAt: cycle.startedAt,
            lifecycleVersionEventId: cycle.versionEventId,
            input,
        });
    }

    const existingLegacyProjectionCount = existingPlantings.filter(
        (planting) => planting.configurationSource === 'legacy',
    ).length;
    const createCount = entries.filter(
        (entry) => entry.action === 'create',
    ).length;
    if (existingLegacyProjectionCount + createCount !== cycles.length) {
        fail('verification_failed', {});
    }

    return {
        entries,
        sourceEventCount: sourceEvents.length,
        sourceCycleCount: cycles.length,
        existingLegacyProjectionCount,
        duplicateFieldGroupCount: duplicateFieldKeys.size,
    };
}

function stableValue(value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }
    if (isRecord(value)) {
        return Object.fromEntries(
            Object.keys(value)
                .sort((left, right) => left.localeCompare(right, 'en'))
                .map((key) => [key, stableValue(value[key])]),
        );
    }
    return value;
}

export function advancedSowingSourceHistoryFingerprint(
    sourceEvents: AdvancedSowingBackfillSourceEvent[],
) {
    const normalized = [...sourceEvents].sort(compareEvents).map((event) => ({
        id: event.id,
        type: event.type,
        version: event.version,
        aggregateId: event.aggregateId,
        data: stableValue(event.data),
        createdAt: event.createdAt.toISOString(),
    }));
    return createHash('sha256')
        .update(JSON.stringify(normalized))
        .digest('hex');
}

export function assertAdvancedSowingSourceHistoryUnchanged(
    before: AdvancedSowingBackfillSourceEvent[],
    after: AdvancedSowingBackfillSourceEvent[],
) {
    if (
        before.length !== after.length ||
        advancedSowingSourceHistoryFingerprint(before) !==
            advancedSowingSourceHistoryFingerprint(after)
    ) {
        fail('source_history_changed', {});
    }
}

export function assertAdvancedSowingPlantingsBackfillReadback(
    input: AdvancedSowingPlantingsBackfillPlanInput,
) {
    const plan = planAdvancedSowingPlantingsBackfill(input);
    const pending = plan.entries.find((entry) => entry.action === 'create');
    if (
        pending ||
        plan.existingLegacyProjectionCount !== plan.sourceCycleCount
    ) {
        fail('verification_failed', {
            eventId: pending?.sourceEventId,
        });
    }
    return plan;
}

export function summarizeAdvancedSowingPlantingsBackfillPlan(
    plan: AdvancedSowingPlantingsBackfillPlan,
) {
    const create = plan.entries.filter(
        (entry) => entry.action === 'create',
    ).length;
    const unchanged = plan.entries.length - create;
    const active = plan.entries.filter((entry) => entry.input.isActive).length;

    return {
        counts: {
            sourceCycleEvents: plan.sourceEventCount,
            sourcePlantPlaceCycles: plan.sourceCycleCount,
            projectedLegacyBefore: plan.existingLegacyProjectionCount,
            projectedLegacyAfter: plan.existingLegacyProjectionCount + create,
            active,
            inactive: plan.entries.length - active,
            duplicateFieldGroups: plan.duplicateFieldGroupCount,
        },
        reasonCounts: {
            create,
            unchanged,
        },
        assertions: {
            sourceProjectedCountMatch:
                plan.existingLegacyProjectionCount + create ===
                plan.sourceCycleCount,
            uniqueSourceMapping: true,
            exactlyOneMembership: true,
            legacyConfigurationNull: true,
            footprintOneByOne: true,
            authoritativeLifecycleDerivationSucceeded: true,
            immutableProjectionMatch: true,
        },
    };
}
