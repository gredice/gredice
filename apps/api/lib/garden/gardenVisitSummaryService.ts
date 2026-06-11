import { createHash } from 'node:crypto';
import type { EntityStandardized } from '@gredice/storage';

export const gardenVisitSummaryFactTypes = [
    'plantGrowth',
    'operationCompleted',
    'drySoil',
    'weed',
    'supportNeeded',
    'harvestWindow',
] as const;

export type GardenVisitSummaryFactType =
    (typeof gardenVisitSummaryFactTypes)[number];

export type GardenVisitSummaryFactSourceType =
    | 'plantLifecycle'
    | 'operation'
    | 'soilMoisture'
    | 'weedState'
    | 'supportNeed'
    | 'harvestWindow';

export type GardenVisitSummaryTarget = {
    raisedBedId?: number;
    raisedBedName?: string | null;
    fieldId?: number;
    positionIndex?: number;
};

export type GardenVisitSummaryFact = {
    id: string;
    type: GardenVisitSummaryFactType;
    priority: number;
    occurredAt: string;
    confidence: 'high' | 'medium';
    source: {
        type: GardenVisitSummaryFactSourceType;
        id: string;
        observedAt?: string;
    };
    target?: GardenVisitSummaryTarget;
    plant?: {
        sortId?: number;
        sortName?: string;
        plantId?: number;
        plantName?: string;
        status?: string;
    };
    operation?: {
        id: number;
        entityId: number;
        entityTypeName: string;
        status: string;
    };
    count?: number;
    range?: {
        min: number;
        max: number;
        unit: 'days';
    };
    visualHint?: 'field' | 'raisedBed' | 'garden';
};

type TimestampValue = Date | string | null | undefined;

export type GardenVisitSummaryWindow = {
    since: Date | string | null | undefined;
    until: Date | string;
};

type GardenVisitSummaryField = {
    id: number;
    positionIndex: number;
    active?: boolean | null;
    plantStatus?: string | null;
    plantSortId?: number | null;
    plantGrowthDate?: TimestampValue;
    plantReadyDate?: TimestampValue;
    weedState?: {
        level: 'none' | 'light' | 'heavy';
        observedAt?: TimestampValue;
        updatedAt?: TimestampValue;
        eventId?: number;
        source?: string;
    } | null;
};

type GardenVisitSummaryRaisedBed = {
    id: number;
    name?: string | null;
    fields: GardenVisitSummaryField[];
    weedState?: {
        level: 'none' | 'light' | 'heavy';
        observedAt?: TimestampValue;
        updatedAt?: TimestampValue;
        eventId?: number;
        source?: string;
    } | null;
};

export type GardenVisitSummaryGarden = {
    id: number;
    raisedBeds: GardenVisitSummaryRaisedBed[];
};

export type GardenVisitSummaryOperation = {
    id: number;
    entityId: number;
    entityTypeName: string;
    status: string;
    raisedBedId?: number | null;
    raisedBedFieldId?: number | null;
    createdAt?: TimestampValue;
    completedAt?: TimestampValue;
    verifiedAt?: TimestampValue;
};

export type GardenVisitSummarySoilMoisture = {
    raisedBedId: number;
    observedAt: TimestampValue;
    moisturePercent: number;
    sourceId: string;
};

export type GardenVisitSummarySupportNeed = GardenVisitSummaryTarget & {
    plantSortId?: number | null;
    observedAt: TimestampValue;
    sourceId: string;
};

export type GardenVisitSummaryHarvestWindow = GardenVisitSummaryTarget & {
    plantSortId?: number | null;
    earliestDate: TimestampValue;
    latestDate: TimestampValue;
    sourceId: string;
};

export type GenerateGardenVisitSummaryFactsInput = {
    garden: GardenVisitSummaryGarden;
    operations?: GardenVisitSummaryOperation[];
    plantSorts?: EntityStandardized[];
    window: GardenVisitSummaryWindow;
    soilMoisture?: GardenVisitSummarySoilMoisture[];
    supportNeeds?: GardenVisitSummarySupportNeed[];
    harvestWindows?: GardenVisitSummaryHarvestWindow[];
    maxFacts?: number;
};

const DRY_SOIL_MOISTURE_PERCENT = 28;

function timestampMs(value: TimestampValue) {
    if (!value) {
        return null;
    }

    const timestamp =
        value instanceof Date ? value.getTime() : Date.parse(value);

    return Number.isFinite(timestamp) ? timestamp : null;
}

function timestampIso(value: TimestampValue) {
    const timestamp = timestampMs(value);
    return timestamp === null ? null : new Date(timestamp).toISOString();
}

function isWithinWindow(value: TimestampValue, window: NormalizedWindow) {
    const timestamp = timestampMs(value);
    return (
        timestamp !== null &&
        timestamp > window.sinceMs &&
        timestamp <= window.untilMs
    );
}

type NormalizedWindow = {
    sinceMs: number;
    untilMs: number;
};

function normalizeWindow(window: GardenVisitSummaryWindow) {
    const sinceMs = timestampMs(window.since);
    const untilMs = timestampMs(window.until);

    if (sinceMs === null || untilMs === null || sinceMs >= untilMs) {
        return null;
    }

    return { sinceMs, untilMs };
}

function buildRaisedBedTargets(garden: GardenVisitSummaryGarden) {
    const targetsByRaisedBedId = new Map<number, GardenVisitSummaryTarget>();
    const targetsByFieldId = new Map<number, GardenVisitSummaryTarget>();

    for (const raisedBed of garden.raisedBeds) {
        targetsByRaisedBedId.set(raisedBed.id, {
            raisedBedId: raisedBed.id,
            raisedBedName: raisedBed.name ?? null,
        });

        for (const field of raisedBed.fields) {
            targetsByFieldId.set(field.id, {
                raisedBedId: raisedBed.id,
                raisedBedName: raisedBed.name ?? null,
                fieldId: field.id,
                positionIndex: field.positionIndex,
            });
        }
    }

    return { targetsByRaisedBedId, targetsByFieldId };
}

function buildPlantSortsById(plantSorts: EntityStandardized[] = []) {
    return new Map(plantSorts.map((plantSort) => [plantSort.id, plantSort]));
}

function plantMetadata(
    plantSortsById: Map<number, EntityStandardized>,
    plantSortId: number | null | undefined,
    status?: string | null,
) {
    if (typeof plantSortId !== 'number') {
        return status ? { status } : undefined;
    }

    const plantSort = plantSortsById.get(plantSortId);
    const plant = plantSort?.information?.plant;

    return {
        sortId: plantSortId,
        sortName:
            plantSort?.information?.label ??
            plantSort?.information?.name ??
            undefined,
        plantId: plant?.id,
        plantName:
            plant?.information?.label ?? plant?.information?.name ?? undefined,
        status: status ?? undefined,
    };
}

function latestLifecycleFactForField(input: {
    field: GardenVisitSummaryField;
    plantSortsById: Map<number, EntityStandardized>;
    target: GardenVisitSummaryTarget;
    window: NormalizedWindow;
}) {
    const candidates: GardenVisitSummaryFact[] = [];
    const growthAt = timestampIso(input.field.plantGrowthDate);
    const readyAt = timestampIso(input.field.plantReadyDate);

    if (
        input.field.active !== false &&
        growthAt &&
        isWithinWindow(growthAt, input.window)
    ) {
        candidates.push({
            id: `plantGrowth:${input.field.id}:${growthAt}`,
            type: 'plantGrowth',
            priority: 70,
            occurredAt: growthAt,
            confidence: 'high',
            source: {
                type: 'plantLifecycle',
                id: `field:${input.field.id}:growth`,
                observedAt: growthAt,
            },
            target: input.target,
            plant: plantMetadata(
                input.plantSortsById,
                input.field.plantSortId,
                input.field.plantStatus,
            ),
            visualHint: 'field',
        });
    }

    if (
        input.field.active !== false &&
        readyAt &&
        isWithinWindow(readyAt, input.window)
    ) {
        candidates.push({
            id: `harvestWindow:${input.field.id}:${readyAt}`,
            type: 'harvestWindow',
            priority: 80,
            occurredAt: readyAt,
            confidence: 'high',
            source: {
                type: 'plantLifecycle',
                id: `field:${input.field.id}:ready`,
                observedAt: readyAt,
            },
            target: input.target,
            plant: plantMetadata(
                input.plantSortsById,
                input.field.plantSortId,
                input.field.plantStatus,
            ),
            range: { min: 0, max: 0, unit: 'days' },
            visualHint: 'field',
        });
    }

    return candidates.sort((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt),
    )[0];
}

function plantLifecycleFacts(input: {
    garden: GardenVisitSummaryGarden;
    plantSortsById: Map<number, EntityStandardized>;
    targetsByFieldId: Map<number, GardenVisitSummaryTarget>;
    window: NormalizedWindow;
}) {
    return input.garden.raisedBeds.flatMap((raisedBed) =>
        raisedBed.fields.flatMap((field) => {
            const target = input.targetsByFieldId.get(field.id);
            if (!target) {
                return [];
            }

            const fact = latestLifecycleFactForField({
                field,
                plantSortsById: input.plantSortsById,
                target,
                window: input.window,
            });

            return fact ? [fact] : [];
        }),
    );
}

function operationCompletedFacts(input: {
    operations: GardenVisitSummaryOperation[];
    targetsByRaisedBedId: Map<number, GardenVisitSummaryTarget>;
    targetsByFieldId: Map<number, GardenVisitSummaryTarget>;
    window: NormalizedWindow;
}) {
    return input.operations.flatMap((operation) => {
        const occurredAt =
            timestampIso(operation.verifiedAt) ??
            timestampIso(operation.completedAt);

        if (!occurredAt || !isWithinWindow(occurredAt, input.window)) {
            return [];
        }

        if (
            operation.status !== 'completed' &&
            operation.status !== 'pendingVerification'
        ) {
            return [];
        }

        const target =
            (operation.raisedBedFieldId
                ? input.targetsByFieldId.get(operation.raisedBedFieldId)
                : undefined) ??
            (operation.raisedBedId
                ? input.targetsByRaisedBedId.get(operation.raisedBedId)
                : undefined);

        return [
            {
                id: `operationCompleted:${operation.id.toString()}:${occurredAt}`,
                type: 'operationCompleted',
                priority: 50,
                occurredAt,
                confidence: 'high',
                source: {
                    type: 'operation',
                    id: operation.id.toString(),
                    observedAt: occurredAt,
                },
                target,
                operation: {
                    id: operation.id,
                    entityId: operation.entityId,
                    entityTypeName: operation.entityTypeName,
                    status: operation.status,
                },
                visualHint: target?.fieldId ? 'field' : 'raisedBed',
            } satisfies GardenVisitSummaryFact,
        ];
    });
}

function weedFacts(input: {
    garden: GardenVisitSummaryGarden;
    targetsByRaisedBedId: Map<number, GardenVisitSummaryTarget>;
    targetsByFieldId: Map<number, GardenVisitSummaryTarget>;
    window: NormalizedWindow;
}) {
    const facts: GardenVisitSummaryFact[] = [];

    for (const raisedBed of input.garden.raisedBeds) {
        const raisedBedObservedAt = timestampIso(
            raisedBed.weedState?.observedAt ?? raisedBed.weedState?.updatedAt,
        );
        if (
            raisedBed.weedState &&
            raisedBed.weedState.level !== 'none' &&
            raisedBedObservedAt &&
            isWithinWindow(raisedBedObservedAt, input.window)
        ) {
            facts.push({
                id: `weed:raisedBed:${raisedBed.id.toString()}:${raisedBedObservedAt}`,
                type: 'weed',
                priority: raisedBed.weedState.level === 'heavy' ? 100 : 90,
                occurredAt: raisedBedObservedAt,
                confidence: 'high',
                source: {
                    type: 'weedState',
                    id:
                        raisedBed.weedState.eventId?.toString() ??
                        `raisedBed:${raisedBed.id.toString()}`,
                    observedAt: raisedBedObservedAt,
                },
                target: input.targetsByRaisedBedId.get(raisedBed.id),
                count: 1,
                visualHint: 'raisedBed',
            });
        }

        for (const field of raisedBed.fields) {
            const fieldObservedAt = timestampIso(
                field.weedState?.observedAt ?? field.weedState?.updatedAt,
            );
            if (
                !field.weedState ||
                field.weedState.level === 'none' ||
                !fieldObservedAt ||
                !isWithinWindow(fieldObservedAt, input.window)
            ) {
                continue;
            }

            facts.push({
                id: `weed:field:${field.id.toString()}:${fieldObservedAt}`,
                type: 'weed',
                priority: field.weedState.level === 'heavy' ? 100 : 90,
                occurredAt: fieldObservedAt,
                confidence: 'high',
                source: {
                    type: 'weedState',
                    id:
                        field.weedState.eventId?.toString() ??
                        `field:${field.id.toString()}`,
                    observedAt: fieldObservedAt,
                },
                target: input.targetsByFieldId.get(field.id),
                count: 1,
                visualHint: 'field',
            });
        }
    }

    return facts;
}

function drySoilFacts(input: {
    soilMoisture: GardenVisitSummarySoilMoisture[];
    targetsByRaisedBedId: Map<number, GardenVisitSummaryTarget>;
    window: NormalizedWindow;
}) {
    return input.soilMoisture.flatMap((reading) => {
        const observedAt = timestampIso(reading.observedAt);
        if (
            !observedAt ||
            !isWithinWindow(observedAt, input.window) ||
            reading.moisturePercent > DRY_SOIL_MOISTURE_PERCENT
        ) {
            return [];
        }

        return [
            {
                id: `drySoil:${reading.raisedBedId.toString()}:${observedAt}`,
                type: 'drySoil',
                priority: 95,
                occurredAt: observedAt,
                confidence: 'high',
                source: {
                    type: 'soilMoisture',
                    id: reading.sourceId,
                    observedAt,
                },
                target: input.targetsByRaisedBedId.get(reading.raisedBedId),
                count: 1,
                visualHint: 'raisedBed',
            } satisfies GardenVisitSummaryFact,
        ];
    });
}

function supportFacts(input: {
    supportNeeds: GardenVisitSummarySupportNeed[];
    plantSortsById: Map<number, EntityStandardized>;
    window: NormalizedWindow;
}) {
    return input.supportNeeds.flatMap((supportNeed) => {
        const observedAt = timestampIso(supportNeed.observedAt);
        if (!observedAt || !isWithinWindow(observedAt, input.window)) {
            return [];
        }

        return [
            {
                id: `supportNeeded:${supportNeed.sourceId}:${observedAt}`,
                type: 'supportNeeded',
                priority: 90,
                occurredAt: observedAt,
                confidence: 'high',
                source: {
                    type: 'supportNeed',
                    id: supportNeed.sourceId,
                    observedAt,
                },
                target: {
                    raisedBedId: supportNeed.raisedBedId,
                    raisedBedName: supportNeed.raisedBedName,
                    fieldId: supportNeed.fieldId,
                    positionIndex: supportNeed.positionIndex,
                },
                plant: plantMetadata(
                    input.plantSortsById,
                    supportNeed.plantSortId,
                ),
                visualHint: supportNeed.fieldId ? 'field' : 'raisedBed',
            } satisfies GardenVisitSummaryFact,
        ];
    });
}

function daysBetween(fromIso: string, toIso: string) {
    const from = Date.parse(fromIso);
    const to = Date.parse(toIso);
    return Math.max(0, Math.round((to - from) / 86_400_000));
}

function harvestWindowFacts(input: {
    harvestWindows: GardenVisitSummaryHarvestWindow[];
    plantSortsById: Map<number, EntityStandardized>;
    generatedAt: string;
    window: NormalizedWindow;
}) {
    return input.harvestWindows.flatMap((harvestWindow) => {
        const earliestDate = timestampIso(harvestWindow.earliestDate);
        const latestDate = timestampIso(harvestWindow.latestDate);
        if (
            !earliestDate ||
            !latestDate ||
            Date.parse(latestDate) < input.window.sinceMs ||
            Date.parse(earliestDate) > input.window.untilMs + 14 * 86_400_000
        ) {
            return [];
        }

        return [
            {
                id: `harvestWindow:${harvestWindow.sourceId}:${earliestDate}:${latestDate}`,
                type: 'harvestWindow',
                priority: 60,
                occurredAt: input.generatedAt,
                confidence: 'medium',
                source: {
                    type: 'harvestWindow',
                    id: harvestWindow.sourceId,
                    observedAt: input.generatedAt,
                },
                target: {
                    raisedBedId: harvestWindow.raisedBedId,
                    raisedBedName: harvestWindow.raisedBedName,
                    fieldId: harvestWindow.fieldId,
                    positionIndex: harvestWindow.positionIndex,
                },
                plant: plantMetadata(
                    input.plantSortsById,
                    harvestWindow.plantSortId,
                ),
                range: {
                    min: daysBetween(input.generatedAt, earliestDate),
                    max: daysBetween(input.generatedAt, latestDate),
                    unit: 'days',
                },
                visualHint: harvestWindow.fieldId ? 'field' : 'raisedBed',
            } satisfies GardenVisitSummaryFact,
        ];
    });
}

function dedupeFacts(facts: GardenVisitSummaryFact[]) {
    const factsByDedupeKey = new Map<string, GardenVisitSummaryFact>();

    for (const fact of facts) {
        const targetKey =
            fact.target?.fieldId?.toString() ??
            fact.target?.raisedBedId?.toString() ??
            'garden';
        const subjectKey =
            fact.operation?.id ??
            fact.plant?.sortId ??
            fact.operation?.entityId ??
            'target';
        const dedupeKey = `${fact.type}:${targetKey}:${subjectKey.toString()}`;
        const existingFact = factsByDedupeKey.get(dedupeKey);
        if (
            !existingFact ||
            fact.priority > existingFact.priority ||
            (fact.priority === existingFact.priority &&
                fact.occurredAt > existingFact.occurredAt)
        ) {
            factsByDedupeKey.set(dedupeKey, fact);
        }
    }

    return [...factsByDedupeKey.values()];
}

export function sortGardenVisitSummaryFacts(facts: GardenVisitSummaryFact[]) {
    return [...facts].sort((left, right) => {
        if (left.priority !== right.priority) {
            return right.priority - left.priority;
        }

        if (left.occurredAt !== right.occurredAt) {
            return right.occurredAt.localeCompare(left.occurredAt);
        }

        return left.id.localeCompare(right.id);
    });
}

export function generateGardenVisitSummaryFacts({
    garden,
    operations = [],
    plantSorts = [],
    window,
    soilMoisture = [],
    supportNeeds = [],
    harvestWindows = [],
    maxFacts = 5,
}: GenerateGardenVisitSummaryFactsInput) {
    const normalizedWindow = normalizeWindow(window);
    if (!normalizedWindow) {
        return [];
    }

    const plantSortsById = buildPlantSortsById(plantSorts);
    const { targetsByRaisedBedId, targetsByFieldId } =
        buildRaisedBedTargets(garden);
    const generatedAt = new Date(normalizedWindow.untilMs).toISOString();

    const facts = [
        ...weedFacts({
            garden,
            targetsByRaisedBedId,
            targetsByFieldId,
            window: normalizedWindow,
        }),
        ...drySoilFacts({
            soilMoisture,
            targetsByRaisedBedId,
            window: normalizedWindow,
        }),
        ...supportFacts({
            supportNeeds,
            plantSortsById,
            window: normalizedWindow,
        }),
        ...plantLifecycleFacts({
            garden,
            plantSortsById,
            targetsByFieldId,
            window: normalizedWindow,
        }),
        ...operationCompletedFacts({
            operations,
            targetsByRaisedBedId,
            targetsByFieldId,
            window: normalizedWindow,
        }),
        ...harvestWindowFacts({
            harvestWindows,
            plantSortsById,
            generatedAt,
            window: normalizedWindow,
        }),
    ];

    return sortGardenVisitSummaryFacts(dedupeFacts(facts)).slice(0, maxFacts);
}

export function hashGardenVisitSummaryFacts(facts: GardenVisitSummaryFact[]) {
    if (facts.length === 0) {
        return null;
    }

    return createHash('sha256')
        .update(JSON.stringify(sortGardenVisitSummaryFacts(facts)))
        .digest('hex')
        .slice(0, 32);
}
