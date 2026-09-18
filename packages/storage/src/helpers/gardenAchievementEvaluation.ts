import {
    evaluateGardenAchievementProgress,
    type GardenAchievementCommand,
    getAchievementDefinition,
    getAchievementDefinitions,
    thresholdReachedAt,
} from '@gredice/js/achievements';
import { and, asc, eq } from 'drizzle-orm';
import { knownEventTypes } from '../repositories/events/knownEventTypes';
import {
    attributeDefinitions,
    attributeValues,
    raisedBedPlantings,
} from '../schema';
import { storage } from '../storage';
import { isCanonicalSelectedPlantingSowedEvent } from './selectedPlantingSowedEvent';

export const gardenAchievementEventTypes = [
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantReplaceSort,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedPlantings.lifecycleStarted,
    knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
    knownEventTypes.raisedBedPlantings.sortCorrected,
    knownEventTypes.raisedBedPlantings.taskCompleted,
    knownEventTypes.raisedBedPlantings.taskVerified,
] as const;

export type GardenAchievementSourceEvent = {
    id: number;
    type: string;
    aggregateId: string;
    createdAt: Date;
    data: unknown;
};

export type GardenAchievementPlantingRow = {
    eventAggregateId: string;
    plantSortId: number;
    raisedBedId: number;
    configurationSource: 'legacy' | 'selected';
};

function eventData(data: unknown) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {};
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
        result[key] = value;
    }
    return result;
}

function eventStatus(data: unknown) {
    const status = eventData(data).status;
    return typeof status === 'string' ? status.toLowerCase() : undefined;
}

export function parsePlantSortId(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

export function parseRaisedBedAggregateId(aggregateId: string) {
    const [raisedBedPart] = aggregateId.split('|');
    const raisedBedId = Number.parseInt(raisedBedPart ?? '', 10);
    return Number.isNaN(raisedBedId) ? null : raisedBedId;
}

function compareSourceEvents(
    left: GardenAchievementSourceEvent,
    right: GardenAchievementSourceEvent,
) {
    const timeDiff = left.createdAt.getTime() - right.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return left.id - right.id;
}

export function mapGardenAchievementCommands(input: {
    events: readonly GardenAchievementSourceEvent[];
    plantings: readonly GardenAchievementPlantingRow[];
    raisedBedAccountId: ReadonlyMap<number, string>;
}): GardenAchievementCommand[] {
    const plantingsByAggregate = new Map(
        input.plantings.map((planting) => [
            planting.eventAggregateId,
            planting,
        ]),
    );
    const activeCycleByAggregate = new Map<string, string>();
    const started = new Set<string>();
    const commands: GardenAchievementCommand[] = [];

    function accountForRaisedBed(raisedBedId: number) {
        return input.raisedBedAccountId.get(raisedBedId);
    }

    function startCycle(
        cycleId: string,
        accountId: string,
        plantSortId: number | undefined,
        at: Date,
    ) {
        if (started.has(cycleId)) {
            if (plantSortId === undefined) return;
            commands.push({
                kind: 'setSort',
                cycleId,
                plantSortId,
                at,
            });
            return;
        }
        started.add(cycleId);
        commands.push({
            kind: 'start',
            cycleId,
            accountId,
            plantSortId,
            at,
        });
    }

    function ensureSelectedCycle(aggregateId: string, at: Date) {
        const planting = plantingsByAggregate.get(aggregateId);
        if (!planting) return undefined;
        const accountId = accountForRaisedBed(planting.raisedBedId);
        if (!accountId) return undefined;
        const cycleId = `selected:${aggregateId}`;
        activeCycleByAggregate.set(aggregateId, cycleId);
        if (!started.has(cycleId)) {
            startCycle(cycleId, accountId, planting.plantSortId, at);
        }
        return cycleId;
    }

    function ensureLegacyCycle(
        aggregateId: string,
        at: Date,
        plantSortId?: number,
        cycleId = activeCycleByAggregate.get(aggregateId) ??
            `legacy:${aggregateId}`,
    ) {
        const raisedBedId = parseRaisedBedAggregateId(aggregateId);
        if (!raisedBedId) return undefined;
        const accountId = accountForRaisedBed(raisedBedId);
        if (!accountId) return undefined;
        activeCycleByAggregate.set(aggregateId, cycleId);
        startCycle(cycleId, accountId, plantSortId, at);
        return cycleId;
    }

    for (const event of [...input.events].sort(compareSourceEvents)) {
        const data = eventData(event.data);
        if (event.type === knownEventTypes.raisedBedFields.plantPlace) {
            const cycleId = `legacy:${event.id.toString()}`;
            const startedCycle = ensureLegacyCycle(
                event.aggregateId,
                event.createdAt,
                parsePlantSortId(data.plantSortId),
                cycleId,
            );
            if (startedCycle) {
                activeCycleByAggregate.set(event.aggregateId, startedCycle);
            }
            continue;
        }
        if (event.type === knownEventTypes.raisedBedFields.plantReplaceSort) {
            const cycleId =
                activeCycleByAggregate.get(event.aggregateId) ??
                ensureLegacyCycle(
                    event.aggregateId,
                    event.createdAt,
                    parsePlantSortId(data.plantSortId),
                );
            const plantSortId = parsePlantSortId(data.plantSortId);
            if (cycleId && plantSortId !== undefined) {
                commands.push({
                    kind: 'setSort',
                    cycleId,
                    plantSortId,
                    at: event.createdAt,
                });
            }
            continue;
        }
        if (
            event.type === knownEventTypes.raisedBedPlantings.lifecycleStarted
        ) {
            ensureSelectedCycle(event.aggregateId, event.createdAt);
            continue;
        }
        if (event.type === knownEventTypes.raisedBedPlantings.sortCorrected) {
            const cycleId = ensureSelectedCycle(
                event.aggregateId,
                event.createdAt,
            );
            const plantSortId = parsePlantSortId(data.plantSortId);
            if (cycleId && plantSortId !== undefined) {
                commands.push({
                    kind: 'setSort',
                    cycleId,
                    plantSortId,
                    at: event.createdAt,
                });
            }
            continue;
        }
        if (isCanonicalSelectedPlantingSowedEvent(event)) {
            const cycleId = ensureSelectedCycle(
                event.aggregateId,
                event.createdAt,
            );
            if (cycleId) {
                commands.push({
                    kind: 'sow',
                    cycleId,
                    at: event.createdAt,
                });
            }
            continue;
        }
        if (
            event.type ===
            knownEventTypes.raisedBedPlantings.lifecycleStatusChanged
        ) {
            const cycleId = ensureSelectedCycle(
                event.aggregateId,
                event.createdAt,
            );
            const status = eventStatus(event.data);
            if (!cycleId || !status) continue;
            if (status === 'sowed') {
                commands.push({
                    kind: 'sow',
                    cycleId,
                    at: event.createdAt,
                });
            } else if (status === 'harvested') {
                commands.push({
                    kind: 'harvest',
                    cycleId,
                    at: event.createdAt,
                });
            }
            continue;
        }
        if (event.type !== knownEventTypes.raisedBedFields.plantUpdate) {
            continue;
        }
        const status = eventStatus(event.data);
        if (status !== 'sowed' && status !== 'harvested') continue;
        const planting = plantingsByAggregate.get(event.aggregateId);
        if (planting?.configurationSource === 'selected') {
            if (status === 'sowed') continue;
            const cycleId = ensureSelectedCycle(
                event.aggregateId,
                event.createdAt,
            );
            if (!cycleId) continue;
            commands.push({
                kind: 'harvest',
                cycleId,
                at: event.createdAt,
            });
            continue;
        }
        const cycleId = ensureLegacyCycle(event.aggregateId, event.createdAt);
        if (!cycleId) continue;
        commands.push({
            kind: status === 'sowed' ? 'sow' : 'harvest',
            cycleId,
            at: event.createdAt,
        });
    }

    return commands;
}

export async function getPlantIdBySortId() {
    const rows = await storage()
        .select({
            sortId: attributeValues.entityId,
            plantValue: attributeValues.value,
        })
        .from(attributeValues)
        .innerJoin(
            attributeDefinitions,
            eq(attributeValues.attributeDefinitionId, attributeDefinitions.id),
        )
        .where(
            and(
                eq(attributeDefinitions.entityTypeName, 'plantSort'),
                eq(attributeDefinitions.category, 'information'),
                eq(attributeDefinitions.name, 'plant'),
                eq(attributeDefinitions.isDeleted, false),
                eq(attributeValues.entityTypeName, 'plantSort'),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .orderBy(asc(attributeValues.id));

    const plantIdBySortId = new Map<number, number>();
    for (const row of rows) {
        const plantId = parsePlantSortId(row.plantValue);
        if (plantId === undefined) continue;
        plantIdBySortId.set(row.sortId, plantId);
    }
    return plantIdBySortId;
}

export async function getGardenAchievementPlantings(): Promise<
    GardenAchievementPlantingRow[]
> {
    const rows = await storage()
        .select({
            eventAggregateId: raisedBedPlantings.eventAggregateId,
            plantSortId: raisedBedPlantings.plantSortId,
            raisedBedId: raisedBedPlantings.raisedBedId,
            configurationSource: raisedBedPlantings.configurationSource,
        })
        .from(raisedBedPlantings)
        .where(eq(raisedBedPlantings.isDeleted, false));
    return rows.map((row) => ({
        ...row,
        configurationSource:
            row.configurationSource === 'selected' ? 'selected' : 'legacy',
    }));
}

export function gardenFamilyAchievementPlans(input: {
    events: readonly GardenAchievementSourceEvent[];
    plantings: readonly GardenAchievementPlantingRow[];
    raisedBedAccountId: ReadonlyMap<number, string>;
    plantIdBySortId: ReadonlyMap<number, number>;
}) {
    const commands = mapGardenAchievementCommands(input);
    const progressByAccount = evaluateGardenAchievementProgress(
        commands,
        input.plantIdBySortId,
    );
    const diversityDefinitions = getAchievementDefinitions()
        .filter(
            (definition) =>
                definition.category === 'garden_diversity' &&
                typeof definition.threshold === 'number',
        )
        .sort((left, right) => (left.threshold ?? 0) - (right.threshold ?? 0));
    const cycleDefinitions = getAchievementDefinitions()
        .filter(
            (definition) =>
                definition.category === 'seed_to_table' &&
                typeof definition.threshold === 'number',
        )
        .sort((left, right) => (left.threshold ?? 0) - (right.threshold ?? 0));

    return [...progressByAccount.entries()].flatMap(([accountId, progress]) => {
        const plans = [
            ...diversityDefinitions.flatMap((definition) => {
                const earnedAt = thresholdReachedAt(
                    progress.distinctPlants,
                    definition.threshold ?? 0,
                );
                return earnedAt
                    ? [
                          {
                              accountId,
                              definition,
                              earnedAt,
                              progressValue: progress.distinctPlants.length,
                          },
                      ]
                    : [];
            }),
            ...cycleDefinitions.flatMap((definition) => {
                const earnedAt = thresholdReachedAt(
                    progress.completedCycles,
                    definition.threshold ?? 0,
                );
                return earnedAt
                    ? [
                          {
                              accountId,
                              definition,
                              earnedAt,
                              progressValue: progress.completedCycles.length,
                          },
                      ]
                    : [];
            }),
        ];
        for (const [key, earnedAt] of progress.seasons) {
            const definition = getAchievementDefinition(key);
            if (!definition) continue;
            plans.push({
                accountId,
                definition,
                earnedAt,
                progressValue: 1,
            });
        }
        return plans;
    });
}
