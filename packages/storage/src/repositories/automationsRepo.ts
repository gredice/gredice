import 'server-only';

import { and, asc, desc, eq, gt, inArray, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
    type AutomationDefinitionStatus,
    type AutomationGraph,
    type AutomationGraphNode,
    type AutomationJsonObject,
    type AutomationModuleKind,
    type AutomationRunSource,
    type AutomationRunStatus,
    type AutomationStepStatus,
    automationDefinitions,
    automationEventCursors,
    automationRunSteps,
    automationRuns,
    emptyAutomationGraph,
    events,
    type SelectAutomationDefinition,
    type SelectAutomationRun,
    type SelectAutomationRunStep,
} from '../schema';
import { storage } from '../storage';

type DatabaseClient = ReturnType<typeof storage>;
type DomainEventRow = typeof events.$inferSelect;

const defaultCursorKey = 'domain-events';
const defaultRunLimit = 50;
const defaultRunMaxAttempts = 3;
const automationDefinitionAdvisoryLockNamespace = 707_001;

export const defaultAutomationMaxConcurrentRuns = 1;
export const maxAutomationMaxConcurrentRuns = 25;

export type AutomationDefinitionInput = {
    key: string;
    name: string;
    description?: string | null;
    status?: AutomationDefinitionStatus;
    maxConcurrentRuns?: number;
    graph?: AutomationGraph;
    metadata?: AutomationJsonObject;
    createdByUserId?: string | null;
    updatedByUserId?: string | null;
};

export type AutomationDefinitionUpdate = Partial<
    Omit<AutomationDefinitionInput, 'key' | 'createdByUserId'>
> & {
    key?: string;
};

export type CreateAutomationRunInput = {
    automationDefinition: SelectAutomationDefinition;
    source: AutomationRunSource;
    sourceEvent?: DomainEventRow | null;
    sourceEventType?: string | null;
    sourceAggregateId?: string | null;
    parentRunId?: number | null;
    dryRun?: boolean;
    input?: AutomationJsonObject;
    manualRequestedByUserId?: string | null;
    maxAttempts?: number;
    nextRunAt?: Date;
};

export type CompleteAutomationRunInput = {
    id: number;
    status: Extract<AutomationRunStatus, 'succeeded' | 'skipped' | 'failed'>;
    output?: AutomationJsonObject;
    errorCode?: string | null;
    errorMessage?: string | null;
    retryAt?: Date | null;
};

export type RecordAutomationRunStepInput = {
    runId: number;
    nodeId: string;
    moduleKey: string;
    moduleKind: AutomationModuleKind;
    status: AutomationStepStatus;
    input?: AutomationJsonObject;
    output?: AutomationJsonObject;
    errorCode?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
};

function normalizeGraph(graph: AutomationGraph | undefined): AutomationGraph {
    if (!graph) {
        return emptyAutomationGraph;
    }

    return {
        nodes: graph.nodes.map((node) => ({
            id: node.id,
            moduleKey: node.moduleKey,
            kind: node.kind,
            position: {
                x: node.position.x,
                y: node.position.y,
            },
            config: node.config,
        })),
        edges: graph.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
        })),
    };
}

function getTriggerNode(
    graph: AutomationGraph,
): AutomationGraphNode | undefined {
    return graph.nodes.find((node) => node.kind === 'trigger');
}

function getTriggerEventTypeFromNode(node: AutomationGraphNode | undefined) {
    const eventType = node?.config.eventType;
    return typeof eventType === 'string' && eventType.trim().length > 0
        ? eventType.trim()
        : null;
}

function automationDefinitionValues(input: AutomationDefinitionInput) {
    const graph = normalizeGraph(input.graph);
    const trigger = getTriggerNode(graph);

    return {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'draft',
        maxConcurrentRuns:
            input.maxConcurrentRuns ?? defaultAutomationMaxConcurrentRuns,
        triggerModuleKey: trigger?.moduleKey ?? null,
        triggerEventType: getTriggerEventTypeFromNode(trigger),
        graph,
        metadata: input.metadata ?? {},
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.updatedByUserId ?? null,
    };
}

function automationDefinitionUpdateValues(input: AutomationDefinitionUpdate) {
    const graph = input.graph ? normalizeGraph(input.graph) : undefined;
    const trigger = graph ? getTriggerNode(graph) : undefined;

    return {
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
            ? { description: input.description }
            : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.maxConcurrentRuns !== undefined
            ? { maxConcurrentRuns: input.maxConcurrentRuns }
            : {}),
        ...(graph
            ? {
                  graph,
                  triggerModuleKey: trigger?.moduleKey ?? null,
                  triggerEventType: getTriggerEventTypeFromNode(trigger),
              }
            : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(input.updatedByUserId !== undefined
            ? { updatedByUserId: input.updatedByUserId }
            : {}),
        updatedAt: new Date(),
    };
}

export async function createAutomationDefinition(
    input: AutomationDefinitionInput,
): Promise<SelectAutomationDefinition> {
    const [created] = await storage()
        .insert(automationDefinitions)
        .values(automationDefinitionValues(input))
        .returning();

    if (!created) {
        throw new Error('Failed to create automation definition.');
    }

    return created;
}

export async function upsertAutomationDefinitionByKey(
    input: AutomationDefinitionInput,
): Promise<SelectAutomationDefinition> {
    const values = automationDefinitionValues(input);
    const [definition] = await storage()
        .insert(automationDefinitions)
        .values(values)
        .onConflictDoUpdate({
            target: automationDefinitions.key,
            set: {
                name: values.name,
                description: values.description,
                status: values.status,
                ...(input.maxConcurrentRuns !== undefined
                    ? { maxConcurrentRuns: values.maxConcurrentRuns }
                    : {}),
                triggerModuleKey: values.triggerModuleKey,
                triggerEventType: values.triggerEventType,
                graph: values.graph,
                metadata: values.metadata,
                updatedByUserId: values.updatedByUserId,
                updatedAt: new Date(),
            },
        })
        .returning();

    if (!definition) {
        throw new Error('Failed to upsert automation definition.');
    }

    return definition;
}

export async function updateAutomationDefinition(
    id: number,
    input: AutomationDefinitionUpdate,
): Promise<SelectAutomationDefinition | null> {
    const [updated] = await storage()
        .update(automationDefinitions)
        .set(automationDefinitionUpdateValues(input))
        .where(eq(automationDefinitions.id, id))
        .returning();

    return updated ?? null;
}

export async function getAutomationDefinitionById(
    id: number,
): Promise<SelectAutomationDefinition | null> {
    const [definition] = await storage()
        .select()
        .from(automationDefinitions)
        .where(eq(automationDefinitions.id, id))
        .limit(1);

    return definition ?? null;
}

export async function getAutomationDefinitionByKey(
    key: string,
): Promise<SelectAutomationDefinition | null> {
    const [definition] = await storage()
        .select()
        .from(automationDefinitions)
        .where(eq(automationDefinitions.key, key))
        .limit(1);

    return definition ?? null;
}

export async function listAutomationDefinitions(filters?: {
    status?: AutomationDefinitionStatus | AutomationDefinitionStatus[];
    triggerEventType?: string;
    limit?: number;
    offset?: number;
}): Promise<SelectAutomationDefinition[]> {
    const statuses = Array.isArray(filters?.status)
        ? filters.status
        : filters?.status
          ? [filters.status]
          : undefined;

    return storage()
        .select()
        .from(automationDefinitions)
        .where(
            and(
                statuses && statuses.length > 0
                    ? inArray(automationDefinitions.status, statuses)
                    : undefined,
                filters?.triggerEventType
                    ? eq(
                          automationDefinitions.triggerEventType,
                          filters.triggerEventType,
                      )
                    : undefined,
            ),
        )
        .orderBy(desc(automationDefinitions.updatedAt))
        .offset(filters?.offset ?? 0)
        .limit(filters?.limit ?? defaultRunLimit);
}

export function listEnabledAutomationDefinitionsForEventType(
    eventType: string,
): Promise<SelectAutomationDefinition[]> {
    return listAutomationDefinitions({
        status: 'enabled',
        triggerEventType: eventType,
        limit: 500,
    });
}

export function listEnabledAutomationDefinitionsForTriggerModule(
    triggerModuleKey: string,
): Promise<SelectAutomationDefinition[]> {
    return storage()
        .select()
        .from(automationDefinitions)
        .where(
            and(
                eq(automationDefinitions.status, 'enabled'),
                eq(automationDefinitions.triggerModuleKey, triggerModuleKey),
            ),
        )
        .orderBy(desc(automationDefinitions.updatedAt))
        .limit(500);
}

export async function createAutomationRun(
    input: CreateAutomationRunInput,
): Promise<SelectAutomationRun | null> {
    const definition = input.automationDefinition;
    const sourceEvent = input.sourceEvent ?? null;
    const sourceEventType = input.sourceEventType ?? sourceEvent?.type ?? null;
    const sourceAggregateId =
        input.sourceAggregateId ?? sourceEvent?.aggregateId ?? null;
    const values = {
        automationDefinitionId: definition.id,
        automationDefinitionKey: definition.key,
        automationDefinitionName: definition.name,
        source: input.source,
        sourceEventId: sourceEvent?.id ?? null,
        sourceEventType,
        sourceAggregateId,
        parentRunId: input.parentRunId ?? null,
        dryRun: input.dryRun ?? input.source === 'test',
        maxAttempts: input.maxAttempts ?? defaultRunMaxAttempts,
        nextRunAt: input.nextRunAt ?? new Date(),
        manualRequestedByUserId: input.manualRequestedByUserId ?? null,
        graphSnapshot: definition.graph,
        input: input.input ?? {},
    };

    if (input.source === 'schedule' && !sourceAggregateId) {
        throw new Error(
            'Scheduled automation runs require a sourceAggregateId.',
        );
    }

    if (input.source === 'schedule') {
        const [created] = await storage()
            .insert(automationRuns)
            .values(values)
            .onConflictDoNothing({
                target: [
                    automationRuns.automationDefinitionId,
                    automationRuns.sourceAggregateId,
                ],
                where: sql`${automationRuns.sourceEventType} = 'automation.schedule.monthly'`,
            })
            .returning();

        return created ?? null;
    }

    const [created] = await storage()
        .insert(automationRuns)
        .values(values)
        .onConflictDoNothing({
            target: [
                automationRuns.automationDefinitionId,
                automationRuns.sourceEventId,
            ],
            where: sql`${automationRuns.source} = 'event'`,
        })
        .returning();

    return created ?? null;
}

export async function startAutomationRun(
    id: number,
    {
        now = new Date(),
        lockedBy = 'automation-runner',
    }: {
        now?: Date;
        lockedBy?: string;
    } = {},
): Promise<SelectAutomationRun | null> {
    const [updated] = await storage()
        .update(automationRuns)
        .set({
            status: 'running',
            attempt: sql`${automationRuns.attempt} + 1`,
            lockedAt: now,
            lockedBy,
            startedAt: now,
            updatedAt: now,
        })
        .where(
            and(
                eq(automationRuns.id, id),
                inArray(automationRuns.status, ['queued', 'retrying']),
            ),
        )
        .returning();

    return updated ?? null;
}

export async function listAutomationRuns(filters?: {
    automationDefinitionId?: number;
    status?: AutomationRunStatus | AutomationRunStatus[];
    sourceEventId?: number;
    failedOnly?: boolean;
    limit?: number;
    offset?: number;
}): Promise<SelectAutomationRun[]> {
    const statuses = filters?.failedOnly
        ? ['failed' as const]
        : Array.isArray(filters?.status)
          ? filters.status
          : filters?.status
            ? [filters.status]
            : undefined;

    return storage()
        .select()
        .from(automationRuns)
        .where(
            and(
                filters?.automationDefinitionId
                    ? eq(
                          automationRuns.automationDefinitionId,
                          filters.automationDefinitionId,
                      )
                    : undefined,
                statuses && statuses.length > 0
                    ? inArray(automationRuns.status, statuses)
                    : undefined,
                filters?.sourceEventId
                    ? eq(automationRuns.sourceEventId, filters.sourceEventId)
                    : undefined,
            ),
        )
        .orderBy(desc(automationRuns.createdAt), desc(automationRuns.id))
        .offset(filters?.offset ?? 0)
        .limit(filters?.limit ?? defaultRunLimit);
}

export async function getAutomationRunById(
    id: number,
): Promise<SelectAutomationRun | null> {
    const [run] = await storage()
        .select()
        .from(automationRuns)
        .where(eq(automationRuns.id, id))
        .limit(1);

    return run ?? null;
}

export async function claimDueAutomationRuns({
    limit = 20,
    now = new Date(),
    lockedBy = 'automation-runner',
    db = storage(),
}: {
    limit?: number;
    now?: Date;
    lockedBy?: string;
    db?: DatabaseClient;
} = {}): Promise<SelectAutomationRun[]> {
    if (limit <= 0) {
        return [];
    }

    const runningAutomationRuns = alias(
        automationRuns,
        'running_automation_runs',
    );
    const candidatePageSize = Math.max(limit * 4, 50);

    return db.transaction(async (tx) => {
        const claimed: SelectAutomationRun[] = [];
        const remainingCapacityByDefinitionId = new Map<number, number>();
        let cursor: { id: number; nextRunAt: Date } | null = null;

        while (claimed.length < limit) {
            const candidates = await tx
                .select({
                    id: automationRuns.id,
                    automationDefinitionId:
                        automationRuns.automationDefinitionId,
                    nextRunAt: automationRuns.nextRunAt,
                })
                .from(automationRuns)
                .where(
                    and(
                        inArray(automationRuns.status, ['queued', 'retrying']),
                        lte(automationRuns.nextRunAt, now),
                        cursor
                            ? or(
                                  gt(
                                      automationRuns.nextRunAt,
                                      cursor.nextRunAt,
                                  ),
                                  and(
                                      eq(
                                          automationRuns.nextRunAt,
                                          cursor.nextRunAt,
                                      ),
                                      gt(automationRuns.id, cursor.id),
                                  ),
                              )
                            : undefined,
                    ),
                )
                .orderBy(asc(automationRuns.nextRunAt), asc(automationRuns.id))
                .limit(candidatePageSize);

            if (candidates.length === 0) {
                break;
            }

            for (const candidate of candidates) {
                cursor = {
                    id: candidate.id,
                    nextRunAt: candidate.nextRunAt,
                };

                if (claimed.length >= limit) {
                    break;
                }

                let remainingCapacity = remainingCapacityByDefinitionId.get(
                    candidate.automationDefinitionId,
                );

                if (remainingCapacity === undefined) {
                    await tx.execute(
                        sql`select pg_advisory_xact_lock(${automationDefinitionAdvisoryLockNamespace}, ${candidate.automationDefinitionId});`,
                    );

                    const [capacity] = await tx
                        .select({
                            maxConcurrentRuns:
                                automationDefinitions.maxConcurrentRuns,
                            runningCount: sql<number>`count(${runningAutomationRuns.id})::int`,
                        })
                        .from(automationDefinitions)
                        .leftJoin(
                            runningAutomationRuns,
                            and(
                                eq(
                                    runningAutomationRuns.automationDefinitionId,
                                    automationDefinitions.id,
                                ),
                                eq(runningAutomationRuns.status, 'running'),
                            ),
                        )
                        .where(
                            eq(
                                automationDefinitions.id,
                                candidate.automationDefinitionId,
                            ),
                        )
                        .groupBy(
                            automationDefinitions.id,
                            automationDefinitions.maxConcurrentRuns,
                        )
                        .limit(1);

                    remainingCapacity = capacity
                        ? Math.max(
                              0,
                              capacity.maxConcurrentRuns -
                                  Number(capacity.runningCount),
                          )
                        : 0;
                    remainingCapacityByDefinitionId.set(
                        candidate.automationDefinitionId,
                        remainingCapacity,
                    );
                }

                if (remainingCapacity <= 0) {
                    continue;
                }

                const [updated] = await tx
                    .update(automationRuns)
                    .set({
                        status: 'running',
                        attempt: sql`${automationRuns.attempt} + 1`,
                        lockedAt: now,
                        lockedBy,
                        startedAt: now,
                        updatedAt: now,
                    })
                    .where(
                        and(
                            eq(automationRuns.id, candidate.id),
                            inArray(automationRuns.status, [
                                'queued',
                                'retrying',
                            ]),
                            lte(automationRuns.nextRunAt, now),
                        ),
                    )
                    .returning();

                if (updated) {
                    claimed.push(updated);
                    remainingCapacityByDefinitionId.set(
                        candidate.automationDefinitionId,
                        remainingCapacity - 1,
                    );
                }
            }

            if (candidates.length < candidatePageSize) {
                break;
            }
        }

        return claimed;
    });
}

export async function recoverStaleAutomationRuns({
    staleBefore,
    now = new Date(),
    db = storage(),
}: {
    staleBefore: Date;
    now?: Date;
    db?: DatabaseClient;
}) {
    const recovered = await db
        .update(automationRuns)
        .set({
            status: 'retrying',
            lockedAt: null,
            lockedBy: null,
            nextRunAt: now,
            updatedAt: now,
        })
        .where(
            and(
                eq(automationRuns.status, 'running'),
                lte(automationRuns.lockedAt, staleBefore),
                gt(automationRuns.maxAttempts, automationRuns.attempt),
            ),
        )
        .returning({ id: automationRuns.id });

    const failed = await db
        .update(automationRuns)
        .set({
            status: 'failed',
            lockedAt: null,
            lockedBy: null,
            completedAt: now,
            errorCode: 'stale_run_attempts_exhausted',
            errorMessage: 'Automation run exceeded the stale lock retry limit.',
            updatedAt: now,
        })
        .where(
            and(
                eq(automationRuns.status, 'running'),
                lte(automationRuns.lockedAt, staleBefore),
                lte(automationRuns.maxAttempts, automationRuns.attempt),
            ),
        )
        .returning({ id: automationRuns.id });

    return {
        recovered: recovered.length,
        failed: failed.length,
    };
}

export async function completeAutomationRun(
    input: CompleteAutomationRunInput,
): Promise<SelectAutomationRun | null> {
    const now = new Date();
    const retry =
        input.status === 'failed' && input.retryAt
            ? {
                  status: 'retrying' as const,
                  completedAt: null,
                  nextRunAt: input.retryAt,
              }
            : {
                  status: input.status,
                  completedAt: now,
                  nextRunAt: now,
              };

    const [updated] = await storage()
        .update(automationRuns)
        .set({
            ...retry,
            output: input.output ?? {},
            errorCode: input.errorCode ?? null,
            errorMessage: input.errorMessage ?? null,
            lockedAt: null,
            lockedBy: null,
            updatedAt: now,
        })
        .where(eq(automationRuns.id, input.id))
        .returning();

    return updated ?? null;
}

export async function recordAutomationRunStep(
    input: RecordAutomationRunStepInput,
): Promise<SelectAutomationRunStep> {
    const now = new Date();
    const [step] = await storage()
        .insert(automationRunSteps)
        .values({
            runId: input.runId,
            nodeId: input.nodeId,
            moduleKey: input.moduleKey,
            moduleKind: input.moduleKind,
            status: input.status,
            input: input.input ?? {},
            output: input.output ?? {},
            errorCode: input.errorCode ?? null,
            errorMessage: input.errorMessage ?? null,
            startedAt: input.startedAt ?? now,
            completedAt: input.completedAt ?? null,
        })
        .onConflictDoUpdate({
            target: [automationRunSteps.runId, automationRunSteps.nodeId],
            set: {
                status: input.status,
                input: input.input ?? {},
                output: input.output ?? {},
                errorCode: input.errorCode ?? null,
                errorMessage: input.errorMessage ?? null,
                startedAt: input.startedAt ?? now,
                completedAt: input.completedAt ?? null,
                updatedAt: now,
            },
        })
        .returning();

    if (!step) {
        throw new Error('Failed to record automation run step.');
    }

    return step;
}

export async function listAutomationRunSteps(
    runId: number,
): Promise<SelectAutomationRunStep[]> {
    return storage()
        .select()
        .from(automationRunSteps)
        .where(eq(automationRunSteps.runId, runId))
        .orderBy(asc(automationRunSteps.createdAt), asc(automationRunSteps.id));
}

export async function getAutomationEventCursor(
    key = defaultCursorKey,
): Promise<number> {
    const [cursor] = await storage()
        .select()
        .from(automationEventCursors)
        .where(eq(automationEventCursors.key, key))
        .limit(1);

    return cursor?.lastEventId ?? 0;
}

export async function initializeAutomationEventCursorToLatest({
    key = defaultCursorKey,
    db = storage(),
}: {
    key?: string;
    db?: DatabaseClient;
} = {}): Promise<number> {
    const [latestEvent] = await db
        .select({
            lastEventId: sql<number>`coalesce(max(${events.id}), 0)`,
        })
        .from(events);
    const lastEventId = Number(latestEvent?.lastEventId ?? 0);

    await db
        .insert(automationEventCursors)
        .values({
            key,
            lastEventId,
        })
        .onConflictDoNothing({
            target: automationEventCursors.key,
        });

    return lastEventId;
}

export async function advanceAutomationEventCursor({
    lastEventId,
    key = defaultCursorKey,
    db = storage(),
}: {
    lastEventId: number;
    key?: string;
    db?: DatabaseClient;
}) {
    await db
        .insert(automationEventCursors)
        .values({
            key,
            lastEventId,
        })
        .onConflictDoUpdate({
            target: automationEventCursors.key,
            set: {
                lastEventId,
                updatedAt: new Date(),
            },
        });
}

export function listDomainEventsAfterId({
    afterEventId,
    eventTypes,
    limit = 500,
    db = storage(),
}: {
    afterEventId: number;
    eventTypes?: string[];
    limit?: number;
    db?: DatabaseClient;
}): Promise<DomainEventRow[]> {
    return db
        .select()
        .from(events)
        .where(
            and(
                gt(events.id, afterEventId),
                eventTypes && eventTypes.length > 0
                    ? inArray(events.type, eventTypes)
                    : undefined,
            ),
        )
        .orderBy(asc(events.id))
        .limit(limit);
}

export function listRecentDomainEvents({
    eventTypes,
    limit = 25,
    db = storage(),
}: {
    eventTypes?: string[];
    limit?: number;
    db?: DatabaseClient;
} = {}): Promise<DomainEventRow[]> {
    return db
        .select()
        .from(events)
        .where(
            eventTypes && eventTypes.length > 0
                ? inArray(events.type, eventTypes)
                : undefined,
        )
        .orderBy(desc(events.id))
        .limit(limit);
}

export async function getDomainEventById(
    eventId: number,
): Promise<DomainEventRow | null> {
    const [event] = await storage()
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

    return event ?? null;
}

export async function getRunnableAutomationEventTypes() {
    const rows = await storage()
        .selectDistinct({ eventType: automationDefinitions.triggerEventType })
        .from(automationDefinitions)
        .where(
            and(
                eq(automationDefinitions.status, 'enabled'),
                sql`${automationDefinitions.triggerEventType} is not null`,
            ),
        );

    return rows
        .map((row) => row.eventType)
        .filter((eventType): eventType is string => Boolean(eventType));
}

export async function enqueueAutomationRunsForEvent(
    event: DomainEventRow,
): Promise<SelectAutomationRun[]> {
    const definitions = await listEnabledAutomationDefinitionsForEventType(
        event.type,
    );
    const createdRuns: SelectAutomationRun[] = [];

    for (const definition of definitions) {
        const run = await createAutomationRun({
            automationDefinition: definition,
            source: 'event',
            sourceEvent: event,
            input: {
                eventId: event.id,
                eventType: event.type,
                aggregateId: event.aggregateId,
                data:
                    event.data && typeof event.data === 'object'
                        ? (event.data as AutomationJsonObject)
                        : {},
            },
        });

        if (run) {
            createdRuns.push(run);
        }
    }

    return createdRuns;
}

export async function getAutomationRunWithSteps(id: number) {
    const [run, steps] = await Promise.all([
        getAutomationRunById(id),
        listAutomationRunSteps(id),
    ]);

    if (!run) {
        return null;
    }

    return {
        ...run,
        steps,
    };
}
