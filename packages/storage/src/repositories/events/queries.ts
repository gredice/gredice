import {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    inArray,
    like,
    lte,
    or,
    sql,
} from 'drizzle-orm';
import {
    bustDeliveryRequestsCache,
    bustScheduleCache,
} from '../../cache/scheduleCache';
import { automationRunSteps, automationRuns, events } from '../../schema';
import { storage } from '../../storage';
import { enqueueAutomationRunsForEvent } from '../automationsRepo';
import { knownEventTypes } from './knownEventTypes';
import type {
    AiRequestKind,
    DeliveryRequestLifecycleNotificationDecisionPayload,
    Event,
    UserBirthdayRewardPayload,
} from './types';

type DatabaseClient = ReturnType<typeof storage>;
const DEFAULT_ALL_EVENTS_PAGE_SIZE = 10000;

export type AiAnalyticsOperationType =
    | 'raisedBedImageAnalysis'
    | 'raisedBedFieldImageAnalysis'
    | 'raisedBedImagePlantStatusReview';

export const aiAnalyticsOperationTypes: AiAnalyticsOperationType[] = [
    'raisedBedImageAnalysis',
    'raisedBedFieldImageAnalysis',
    'raisedBedImagePlantStatusReview',
];

export type AiAnalyticsOperationData = {
    markdown?: string;
    imageUrl?: string;
    imageUrls?: string[];
    model?: string | null;
    analyzedAt?: string;
    referenceDate?: string;
    accountId?: string;
    aiRequestKind?: AiRequestKind;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    source?: string;
    summary?: string;
    raisedBedId?: number | null;
    operationId?: number | null;
    focusPositionIndex?: number | null;
    imageCount?: number | null;
    skippedInvalidImageCount?: number | null;
    proposalCount?: number | null;
    acceptedProposalCount?: number | null;
    requestCount?: number | null;
};

export type AiAnalyticsOperation = {
    id: number;
    type: string;
    version: number;
    aggregateId: string;
    data: AiAnalyticsOperationData | null;
    createdAt: Date;
    aiOperationType: AiAnalyticsOperationType;
    source: 'domainEvent' | 'automationRunStep';
    automationRunId?: number | null;
    sourceEventType?: string | null;
    sourceAggregateId?: string | null;
};

type AiAnalysisEventsFilter = {
    from?: Date;
    to?: Date;
    operationTypes?: AiAnalyticsOperationType[];
};

const aiAnalysisEventTypes = [
    knownEventTypes.raisedBeds.aiAnalysis,
    knownEventTypes.raisedBedFields.aiAnalysis,
];

const aiPlantStatusReviewModuleKey =
    'action.createPlantStatusRequestsFromImageAnalysis';

const scheduleInvalidatingEventTypes = new Set<string>([
    knownEventTypes.operations.acceptance,
    knownEventTypes.operations.assign,
    knownEventTypes.operations.entityChange,
    knownEventTypes.operations.schedule,
    knownEventTypes.operations.complete,
    knownEventTypes.operations.block,
    knownEventTypes.operations.completionEvidenceUpdate,
    knownEventTypes.operations.verify,
    knownEventTypes.operations.fail,
    knownEventTypes.operations.cancel,
    knownEventTypes.approvalRequests.create,
    knownEventTypes.approvalRequests.approve,
    knownEventTypes.approvalRequests.reject,
    knownEventTypes.raisedBedFields.create,
    knownEventTypes.raisedBedFields.delete,
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantSchedule,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedFields.plantBlock,
    knownEventTypes.raisedBedFields.plantReplaceSort,
]);

const deliveryInvalidatingEventTypes = new Set<string>([
    knownEventTypes.delivery.requestCreated,
    knownEventTypes.delivery.requestCancelled,
    knownEventTypes.delivery.requestAddressChanged,
    knownEventTypes.delivery.requestConfirmed,
    knownEventTypes.delivery.requestPreparing,
    knownEventTypes.delivery.requestReady,
    knownEventTypes.delivery.requestFulfilled,
    knownEventTypes.delivery.requestExceptionRecorded,
    knownEventTypes.delivery.requestExceptionRecovered,
    knownEventTypes.delivery.requestSurveySent,
    knownEventTypes.delivery.requestSlotChanged,
    knownEventTypes.delivery.userCancelled,
    knownEventTypes.delivery.runReassigned,
    knownEventTypes.delivery.runAbandoned,
]);

function eventTypeFilter(type: string | string[]) {
    return Array.isArray(type)
        ? inArray(events.type, type)
        : eq(events.type, type);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
        ? value
        : undefined;
}

function optionalNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : undefined;
}

function optionalAiRequestKind(value: unknown): AiRequestKind | undefined {
    return value === 'raisedBedImageAnalysis' ? value : undefined;
}

function normalizeAiAnalyticsData(
    value: unknown,
): AiAnalyticsOperationData | null {
    if (!isRecord(value)) {
        return null;
    }

    const markdown = optionalString(value.markdown);
    const imageUrl = optionalString(value.imageUrl);
    const imageUrls = optionalStringArray(value.imageUrls);
    const model = optionalString(value.model);
    const analyzedAt = optionalString(value.analyzedAt);
    const referenceDate = optionalString(value.referenceDate);
    const accountId = optionalString(value.accountId);
    const aiRequestKind = optionalAiRequestKind(value.aiRequestKind);
    const source = optionalString(value.source);
    const summary = optionalString(value.summary);

    return {
        ...(markdown ? { markdown } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(imageUrls ? { imageUrls } : {}),
        ...(model ? { model } : {}),
        ...(analyzedAt ? { analyzedAt } : {}),
        ...(referenceDate ? { referenceDate } : {}),
        ...(accountId ? { accountId } : {}),
        ...(aiRequestKind ? { aiRequestKind } : {}),
        inputTokens: optionalNumber(value.inputTokens),
        outputTokens: optionalNumber(value.outputTokens),
        totalTokens: optionalNumber(value.totalTokens),
        ...(source ? { source } : {}),
        ...(summary ? { summary } : {}),
        raisedBedId: optionalNumber(value.raisedBedId),
        operationId: optionalNumber(value.operationId),
        focusPositionIndex: optionalNumber(value.focusPositionIndex),
        imageCount: optionalNumber(value.imageCount),
        skippedInvalidImageCount: optionalNumber(
            value.skippedInvalidImageCount,
        ),
        proposalCount: optionalNumber(value.proposalCount),
        acceptedProposalCount: optionalNumber(value.acceptedProposalCount),
        requestCount: optionalNumber(value.requestCount),
    };
}

function aiAnalysisEventTypesForFilter(
    operationTypes?: AiAnalyticsOperationType[],
) {
    if (!operationTypes?.length) {
        return aiAnalysisEventTypes;
    }

    const eventTypes: string[] = [];
    if (operationTypes.includes('raisedBedImageAnalysis')) {
        eventTypes.push(knownEventTypes.raisedBeds.aiAnalysis);
    }
    if (operationTypes.includes('raisedBedFieldImageAnalysis')) {
        eventTypes.push(knownEventTypes.raisedBedFields.aiAnalysis);
    }

    return eventTypes;
}

function includesAutomationAiAnalysisType(
    operationTypes?: AiAnalyticsOperationType[],
) {
    return (
        !operationTypes?.length ||
        operationTypes.includes('raisedBedImagePlantStatusReview')
    );
}

function aiOperationTypeForDomainEvent(type: string): AiAnalyticsOperationType {
    return type === knownEventTypes.raisedBedFields.aiAnalysis
        ? 'raisedBedFieldImageAnalysis'
        : 'raisedBedImageAnalysis';
}

async function bustReadModelCachesForEvent(event: Event) {
    await Promise.all([
        scheduleInvalidatingEventTypes.has(event.type)
            ? bustScheduleCache()
            : undefined,
        deliveryInvalidatingEventTypes.has(event.type)
            ? bustDeliveryRequestsCache()
            : undefined,
    ]);
}

export function getEvents(
    type: string | string[],
    aggregateIds: string[],
    offset: number = 0,
    limit: number = 1000,
    db: DatabaseClient = storage(),
) {
    return db.query.events.findMany({
        where: and(
            inArray(events.aggregateId, aggregateIds),
            eventTypeFilter(type),
        ),
        orderBy: [asc(events.createdAt), asc(events.id)],
        offset,
        limit,
    });
}

export async function getAllEvents(
    type: string | string[],
    aggregateIds: string[],
    options: {
        db?: DatabaseClient;
        pageSize?: number;
    } = {},
) {
    if (aggregateIds.length === 0) {
        return [];
    }

    const pageSize = options.pageSize ?? DEFAULT_ALL_EVENTS_PAGE_SIZE;
    if (!Number.isInteger(pageSize) || pageSize <= 0) {
        throw new Error('Event page size must be a positive integer');
    }

    const allEvents: Awaited<ReturnType<typeof getEvents>> = [];
    const db = options.db ?? storage();

    for (let offset = 0; ; offset += pageSize) {
        const page = await getEvents(type, aggregateIds, offset, pageSize, db);
        allEvents.push(...page);

        if (page.length < pageSize) {
            return allEvents;
        }
    }
}

export function getLatestEvents(
    type: string | string[],
    aggregateIds: string[],
    offset: number = 0,
    limit: number = 1000,
    db: DatabaseClient = storage(),
) {
    return db.query.events.findMany({
        where: and(
            inArray(events.aggregateId, aggregateIds),
            eventTypeFilter(type),
        ),
        orderBy: [desc(events.createdAt), desc(events.id)],
        offset,
        limit,
    });
}

export async function getEventById(
    eventId: number,
    db: DatabaseClient = storage(),
) {
    return db.query.events.findFirst({
        where: eq(events.id, eventId),
    });
}

export function getLatestEventsByAggregateIdPrefix(
    type: string | string[],
    aggregateIdPrefix: string,
    offset: number = 0,
    limit: number = 1000,
    db: DatabaseClient = storage(),
) {
    return db.query.events.findMany({
        where: and(
            like(events.aggregateId, `${aggregateIdPrefix}%`),
            eventTypeFilter(type),
        ),
        orderBy: [desc(events.createdAt), desc(events.id)],
        offset,
        limit,
    });
}

export async function getEventAggregateIdsByAggregateIdPrefix(
    type: string | string[],
    aggregateIdPrefix: string,
    db: DatabaseClient = storage(),
) {
    const rows = await db
        .selectDistinct({ aggregateId: events.aggregateId })
        .from(events)
        .where(
            and(
                like(events.aggregateId, `${aggregateIdPrefix}%`),
                eventTypeFilter(type),
            ),
        )
        .orderBy(asc(events.aggregateId));

    return rows.map((row) => row.aggregateId);
}

export async function getPlantUpdateEvents(filter?: {
    status?: string;
    from?: Date;
    to?: Date;
}) {
    const results = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.raisedBedFields.plantUpdate),
            filter?.from ? gte(events.createdAt, filter.from) : undefined,
            filter?.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [asc(events.createdAt)],
    });

    if (!filter?.status) {
        return results;
    }

    return results.filter((event) => {
        const status = (event.data as { status?: unknown } | null | undefined)
            ?.status;
        return status === filter.status;
    });
}

export async function getPlantPlaceEventsCount() {
    const result = await storage()
        .select({ count: count() })
        .from(events)
        .where(eq(events.type, knownEventTypes.raisedBedFields.plantPlace));
    return result[0]?.count ?? 0;
}

export async function countEventsSince(
    type: string,
    since: Date,
    aggregateIds: string[],
) {
    if (aggregateIds.length === 0) {
        return 0;
    }

    const result = await storage()
        .select({ count: count() })
        .from(events)
        .where(
            and(
                eq(events.type, type),
                gte(events.createdAt, since),
                inArray(events.aggregateId, aggregateIds),
            ),
        );
    return result[0]?.count ?? 0;
}

export async function countAiRequestEventsSince({
    type,
    legacyType,
    since,
    accountId,
    requestKind,
    legacyAggregateIds = [],
}: {
    type: string | string[];
    legacyType?: string | string[];
    since: Date;
    accountId: string;
    requestKind: string;
    legacyAggregateIds?: string[];
}) {
    const typeFilter = Array.isArray(type)
        ? inArray(events.type, type)
        : eq(events.type, type);
    const accountRequestFilter = and(
        typeFilter,
        sql<boolean>`(${events.data}->>'accountId') = ${accountId}`,
        sql<boolean>`(${events.data}->>'aiRequestKind') = ${requestKind}`,
    );
    const legacyRequestFilter =
        legacyType && legacyAggregateIds.length > 0
            ? and(
                  Array.isArray(legacyType)
                      ? inArray(events.type, legacyType)
                      : eq(events.type, legacyType),
                  inArray(events.aggregateId, legacyAggregateIds),
                  sql<boolean>`(${events.data}->>'aiRequestKind') is null`,
              )
            : undefined;
    const requestFilter = legacyRequestFilter
        ? or(accountRequestFilter, legacyRequestFilter)
        : accountRequestFilter;

    const result = await storage()
        .select({ count: count() })
        .from(events)
        .where(and(gte(events.createdAt, since), requestFilter));
    return result[0]?.count ?? 0;
}

export async function createEvent(
    { type, version, aggregateId, data, createdAt }: Event,
    db: DatabaseClient = storage(),
) {
    const [event] = await db
        .insert(events)
        .values({
            type,
            version,
            aggregateId,
            data,
            ...(createdAt && { createdAt }),
        })
        .returning();
    if (!event) {
        throw new Error('Failed to create event.');
    }

    await enqueueAutomationRunsForEvent(event, { db });
    await bustReadModelCachesForEvent({ type, version, aggregateId, data });

    return event;
}

export async function createDeliveryLifecycleNotificationDecisionOnce(event: {
    aggregateId: string;
    data: DeliveryRequestLifecycleNotificationDecisionPayload;
    type: string;
    version: number;
}) {
    if (
        event.type !==
            knownEventTypes.delivery.requestLifecycleNotificationDecision ||
        event.version !== 1
    ) {
        throw new Error('Invalid delivery lifecycle notification decision.');
    }
    const { data } = event;
    const scopeByMilestone = data.reason === 'eta_threshold_already_emitted';
    const lockKey = [
        'delivery-lifecycle-notification-decision',
        event.aggregateId,
        scopeByMilestone ? 'milestone-scope' : data.sourceId,
        data.milestone,
        data.reason,
        String(data.retryAttempt),
        data.runId,
        data.stopId,
    ].join(':');
    return await storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${lockKey}));`,
        );
        const existing = await tx
            .select({ id: events.id })
            .from(events)
            .where(
                and(
                    eq(events.type, event.type),
                    eq(events.version, event.version),
                    eq(events.aggregateId, event.aggregateId),
                    eq(sql<string>`${events.data}->>'decision'`, data.decision),
                    eq(
                        sql<string>`${events.data}->>'milestone'`,
                        data.milestone,
                    ),
                    eq(sql<string>`${events.data}->>'reason'`, data.reason),
                    eq(
                        sql<string>`${events.data}->>'retryAttempt'`,
                        String(data.retryAttempt),
                    ),
                    eq(sql<string>`${events.data}->>'runId'`, data.runId),
                    scopeByMilestone
                        ? undefined
                        : eq(
                              sql<string>`${events.data}->>'sourceId'`,
                              data.sourceId,
                          ),
                    eq(sql<string>`${events.data}->>'stopId'`, data.stopId),
                ),
            )
            .limit(1);
        if (existing[0]) return false;
        await createEvent(event, tx);
        return true;
    });
}

async function getDomainAiAnalysisEvents(
    filter?: AiAnalysisEventsFilter,
): Promise<AiAnalyticsOperation[]> {
    const eventTypes = aiAnalysisEventTypesForFilter(filter?.operationTypes);
    if (eventTypes.length === 0) {
        return [];
    }

    const results = await storage().query.events.findMany({
        where: and(
            inArray(events.type, eventTypes),
            filter?.from ? gte(events.createdAt, filter.from) : undefined,
            filter?.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [desc(events.createdAt), desc(events.id)],
    });

    return results.map((event) => ({
        id: event.id,
        type: event.type,
        version: event.version,
        aggregateId: event.aggregateId,
        data: normalizeAiAnalyticsData(event.data),
        createdAt: event.createdAt,
        aiOperationType: aiOperationTypeForDomainEvent(event.type),
        source: 'domainEvent',
    }));
}

async function getAutomationAiAnalysisEvents(
    filter?: AiAnalysisEventsFilter,
): Promise<AiAnalyticsOperation[]> {
    if (!includesAutomationAiAnalysisType(filter?.operationTypes)) {
        return [];
    }

    const results = await storage()
        .select({
            id: automationRunSteps.id,
            runId: automationRunSteps.runId,
            output: automationRunSteps.output,
            completedAt: automationRunSteps.completedAt,
            createdAt: automationRunSteps.createdAt,
            sourceEventType: automationRuns.sourceEventType,
            sourceAggregateId: automationRuns.sourceAggregateId,
        })
        .from(automationRunSteps)
        .innerJoin(
            automationRuns,
            eq(automationRunSteps.runId, automationRuns.id),
        )
        .where(
            and(
                eq(automationRunSteps.moduleKey, aiPlantStatusReviewModuleKey),
                eq(automationRunSteps.status, 'succeeded'),
                eq(automationRuns.dryRun, false),
                sql<boolean>`${automationRunSteps.output}->>'model' is not null`,
                filter?.from
                    ? gte(automationRunSteps.completedAt, filter.from)
                    : undefined,
                filter?.to
                    ? lte(automationRunSteps.completedAt, filter.to)
                    : undefined,
            ),
        )
        .orderBy(
            desc(automationRunSteps.completedAt),
            desc(automationRunSteps.id),
        );

    return results.map((row) => ({
        id: row.id,
        type: aiPlantStatusReviewModuleKey,
        version: 1,
        aggregateId:
            row.sourceAggregateId ??
            normalizeAiAnalyticsData(row.output)?.raisedBedId?.toString() ??
            row.runId.toString(),
        data: normalizeAiAnalyticsData(row.output),
        createdAt: row.completedAt ?? row.createdAt,
        aiOperationType: 'raisedBedImagePlantStatusReview',
        source: 'automationRunStep',
        automationRunId: row.runId,
        sourceEventType: row.sourceEventType,
        sourceAggregateId: row.sourceAggregateId,
    }));
}

export async function getAiAnalysisEvents(
    filter?: AiAnalysisEventsFilter,
): Promise<AiAnalyticsOperation[]> {
    const [domainEvents, automationEvents] = await Promise.all([
        getDomainAiAnalysisEvents(filter),
        getAutomationAiAnalysisEvents(filter),
    ]);

    return [...domainEvents, ...automationEvents].sort((a, b) => {
        const dateDifference = b.createdAt.getTime() - a.createdAt.getTime();
        if (dateDifference !== 0) {
            return dateDifference;
        }
        return b.id - a.id;
    });
}

async function getDomainAiAnalysisCount(filter?: AiAnalysisEventsFilter) {
    const eventTypes = aiAnalysisEventTypesForFilter(filter?.operationTypes);
    if (eventTypes.length === 0) {
        return 0;
    }

    const result = await storage()
        .select({ count: count() })
        .from(events)
        .where(
            and(
                inArray(events.type, eventTypes),
                filter?.from ? gte(events.createdAt, filter.from) : undefined,
                filter?.to ? lte(events.createdAt, filter.to) : undefined,
            ),
        );

    return result[0]?.count ?? 0;
}

async function getAutomationAiAnalysisCount(filter?: AiAnalysisEventsFilter) {
    if (!includesAutomationAiAnalysisType(filter?.operationTypes)) {
        return 0;
    }

    const result = await storage()
        .select({ count: count() })
        .from(automationRunSteps)
        .innerJoin(
            automationRuns,
            eq(automationRunSteps.runId, automationRuns.id),
        )
        .where(
            and(
                eq(automationRunSteps.moduleKey, aiPlantStatusReviewModuleKey),
                eq(automationRunSteps.status, 'succeeded'),
                eq(automationRuns.dryRun, false),
                sql<boolean>`${automationRunSteps.output}->>'model' is not null`,
                filter?.from
                    ? gte(automationRunSteps.completedAt, filter.from)
                    : undefined,
                filter?.to
                    ? lte(automationRunSteps.completedAt, filter.to)
                    : undefined,
            ),
        );

    return result[0]?.count ?? 0;
}

export async function getAiAnalysisTotals(filter?: AiAnalysisEventsFilter) {
    const [domainCount, automationCount] = await Promise.all([
        getDomainAiAnalysisCount(filter),
        getAutomationAiAnalysisCount(filter),
    ]);

    return {
        count: domainCount + automationCount,
    };
}

type SunflowersDailyPoint = {
    date: string;
    spent: number;
    earned: number;
};

export async function getSunflowersDailyTotals(filter?: {
    from?: Date;
    to?: Date;
}) {
    const results = await storage().query.events.findMany({
        where: and(
            inArray(events.type, [
                knownEventTypes.accounts.earnSunflowers,
                knownEventTypes.accounts.earnSunflowerDrop,
                knownEventTypes.accounts.spendSunflowers,
            ]),
            filter?.from ? gte(events.createdAt, filter.from) : undefined,
            filter?.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [asc(events.createdAt)],
    });

    const byDay = new Map<string, SunflowersDailyPoint>();

    for (const event of results) {
        const key = event.createdAt.toISOString().split('T')[0];
        const existing = byDay.get(key) ?? { date: key, spent: 0, earned: 0 };
        const payload = event.data as
            | { amount?: unknown; reason?: unknown }
            | null
            | undefined;
        const amount =
            typeof payload?.amount === 'number' &&
            Number.isFinite(payload.amount)
                ? Math.max(0, payload.amount)
                : 0;
        if (event.type === knownEventTypes.accounts.spendSunflowers) {
            existing.spent += amount;
        } else if (
            event.type === knownEventTypes.accounts.earnSunflowers ||
            event.type === knownEventTypes.accounts.earnSunflowerDrop
        ) {
            existing.earned += amount;
        }

        byDay.set(key, existing);
    }

    return Array.from(byDay.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
    );
}

export async function deleteEventById(eventId: number) {
    const event = await getEventById(eventId);
    await storage().delete(events).where(eq(events.id, eventId));
    if (event) {
        await bustReadModelCachesForEvent(event);
    }
}

export async function updateEventCreatedAt(
    eventId: number,
    createdAt: Date,
    db: DatabaseClient = storage(),
) {
    const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
    });
    if (!event) {
        return;
    }
    await db.update(events).set({ createdAt }).where(eq(events.id, eventId));
    await bustReadModelCachesForEvent(event);
}

export async function getLastBirthdayRewardEvent(
    userId: string,
    db: DatabaseClient = storage(),
) {
    const event = await db.query.events.findFirst({
        where: and(
            eq(events.aggregateId, userId),
            eq(events.type, knownEventTypes.users.birthdayReward),
        ),
        orderBy: [desc(events.createdAt)],
    });
    if (!event) {
        return null;
    }
    return {
        ...event,
        data: event.data as UserBirthdayRewardPayload,
    };
}
