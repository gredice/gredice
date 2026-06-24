import type { EntityStandardized } from '../@types/EntityStandardized';
import { getEntityFormatted } from '../repositories/entitiesRepo';
import {
    buildRaisedBedFieldPlantUpdatePayload,
    createEvent,
    knownEvents,
    knownEventTypes,
    type RaisedBedFieldSowingLocation,
} from '../repositories/events';
import { getFarms } from '../repositories/farmsRepo';
import {
    getAllRaisedBeds,
    getGardens,
    getRaisedBed,
} from '../repositories/gardensRepo';
import {
    acceptOperation,
    createOperation,
    getFarmAcceptedOperationsByScheduleRange,
    getOperationById,
} from '../repositories/operationsRepo';
import { getOutletOffers } from '../repositories/outletOffersRepo';
import {
    queuePostTransplantWateringOperations,
    queueSeasonalSowingOfferOperations,
    RAISED_BED_WATERING_50L_OPERATION_ID,
} from '../repositories/seasonalOffersRepo';
import type { AutomationGraphNode, AutomationJsonObject } from '../schema';
import {
    hasRaisedBedImagePlantStatusReviewAiConfig,
    previewRaisedBedImagePlantStatusReview,
    RAISED_BED_IMAGE_PLANT_STATUS_REVIEW_REQUESTER,
    runRaisedBedImagePlantStatusReview,
} from './raisedBedImagePlantStatusAnalysis';
import {
    type AutomationModule,
    AutomationModuleExecutionError,
    type AutomationModuleMetadata,
    type AutomationModuleResult,
    type AutomationSourceEvent,
} from './types';

const domainEventTriggerKey = 'trigger.domainEvent';
const scheduleTriggerKey = 'trigger.schedule';
const scheduleMonthlyTriggerKey = 'trigger.scheduleMonthly';
const eventDataEqualsConditionKey = 'condition.eventDataEquals';
const operationMatchesConditionKey = 'condition.operationMatches';
const plantStatusEqualsConditionKey = 'condition.plantStatusEquals';
const queueSeasonalSowingOfferOperationsActionKey =
    'action.queueSeasonalSowingOfferOperations';
const queuePostTransplantWateringOperationsActionKey =
    'action.queuePostTransplantWateringOperations';
const createOperationActionKey = 'action.createOperation';
const createFarmInventoryOperationsActionKey =
    'action.createFarmInventoryOperations';
const createGreenhouseSeedlingWateringOperationsActionKey =
    'action.createGreenhouseSeedlingWateringOperations';
const updateRaisedBedFieldPlantAttributesActionKey =
    'action.updateRaisedBedFieldPlantAttributes';
const createPlantStatusRequestsFromImageAnalysisActionKey =
    'action.createPlantStatusRequestsFromImageAnalysis';
const logActionKey = 'action.log';
export const automationScheduleEventType = 'automation.schedule';
const legacyMonthlyScheduleEventType = 'automation.schedule.monthly';
const defaultScheduleTimeZone = 'Europe/Zagreb';
const defaultImagePlantStatusReviewMinConfidence = 0.9;
const defaultBiweeklyAnchorDate = '2026-01-05';
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const millisecondsPerWeek = 7 * millisecondsPerDay;

const scheduleFrequencyValues = [
    'daily',
    'weekly',
    'biweekly',
    'monthly',
] as const;
type ScheduleFrequency = (typeof scheduleFrequencyValues)[number];

const weekDayValues = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
] as const;
type WeekDay = (typeof weekDayValues)[number];

const jsDayToWeekDay = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
] as const satisfies readonly WeekDay[];

const weekDayAliases = new Map<string, WeekDay>([
    ['mon', 'monday'],
    ['monday', 'monday'],
    ['1', 'monday'],
    ['tue', 'tuesday'],
    ['tues', 'tuesday'],
    ['tuesday', 'tuesday'],
    ['2', 'tuesday'],
    ['wed', 'wednesday'],
    ['wednesday', 'wednesday'],
    ['3', 'wednesday'],
    ['thu', 'thursday'],
    ['thur', 'thursday'],
    ['thurs', 'thursday'],
    ['thursday', 'thursday'],
    ['4', 'thursday'],
    ['fri', 'friday'],
    ['friday', 'friday'],
    ['5', 'friday'],
    ['sat', 'saturday'],
    ['saturday', 'saturday'],
    ['6', 'saturday'],
    ['sun', 'sunday'],
    ['sunday', 'sunday'],
    ['0', 'sunday'],
    ['7', 'sunday'],
]);

export const automationModuleKeys = {
    triggerDomainEvent: domainEventTriggerKey,
    triggerSchedule: scheduleTriggerKey,
    triggerScheduleMonthly: scheduleMonthlyTriggerKey,
    conditionEventDataEquals: eventDataEqualsConditionKey,
    conditionOperationMatches: operationMatchesConditionKey,
    conditionPlantStatusEquals: plantStatusEqualsConditionKey,
    actionQueueSeasonalSowingOfferOperations:
        queueSeasonalSowingOfferOperationsActionKey,
    actionQueuePostTransplantWateringOperations:
        queuePostTransplantWateringOperationsActionKey,
    actionCreateOperation: createOperationActionKey,
    actionCreateFarmInventoryOperations: createFarmInventoryOperationsActionKey,
    actionCreateGreenhouseSeedlingWateringOperations:
        createGreenhouseSeedlingWateringOperationsActionKey,
    actionUpdateRaisedBedFieldPlantAttributes:
        updateRaisedBedFieldPlantAttributesActionKey,
    actionCreatePlantStatusRequestsFromImageAnalysis:
        createPlantStatusRequestsFromImageAnalysisActionKey,
    actionLog: logActionKey,
} as const;

export function isScheduleTriggerModuleKey(moduleKey: string) {
    return (
        moduleKey === scheduleTriggerKey ||
        moduleKey === scheduleMonthlyTriggerKey
    );
}

export function isAutomationScheduleEventType(
    eventType: string | null | undefined,
) {
    return (
        eventType === automationScheduleEventType ||
        eventType === legacyMonthlyScheduleEventType
    );
}

function getRecord(value: unknown): AutomationJsonObject {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as AutomationJsonObject)
        : {};
}

function getString(config: AutomationJsonObject, key: string) {
    const value = config[key];
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}

function getNumber(config: AutomationJsonObject, key: string) {
    const value = config[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function requiredString(config: AutomationJsonObject, key: string) {
    const value = getString(config, key);
    return value ? [] : [`${key} is required.`];
}

function isValidTimeZone(timeZone: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

function getTimeZoneDateParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value]),
    );
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day)
    ) {
        throw new Error(`Unable to resolve date parts for ${timeZone}.`);
    }
    const localDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = jsDayToWeekDay[localDate.getUTCDay()];
    if (!dayOfWeek) {
        throw new Error(`Unable to resolve day of week for ${timeZone}.`);
    }

    return {
        year,
        month,
        day,
        dayOfWeek,
        dateKey: `${parts.year}-${parts.month}-${parts.day}`,
        periodKey: `${parts.year}-${parts.month}`,
    };
}

function getScheduleFrequency(
    config: AutomationJsonObject,
    moduleKey = scheduleTriggerKey,
): ScheduleFrequency | null {
    if (moduleKey === scheduleMonthlyTriggerKey) {
        return 'monthly';
    }

    const frequency = getString(config, 'frequency');
    return scheduleFrequencyValues.find((value) => value === frequency) ?? null;
}

function parseWeekDay(value: unknown): WeekDay | null {
    const key =
        typeof value === 'number' && Number.isInteger(value)
            ? value.toString()
            : typeof value === 'string'
              ? value.trim().toLowerCase()
              : '';

    return weekDayAliases.get(key) ?? null;
}

function weekDayLabel(day: WeekDay) {
    return day.charAt(0).toUpperCase() + day.slice(1);
}

function getConfiguredWeekDays(config: AutomationJsonObject) {
    const candidates: unknown[] = [];
    const dayOfWeek = config.dayOfWeek;
    const daysOfWeek = config.daysOfWeek;

    if (dayOfWeek !== undefined) {
        candidates.push(dayOfWeek);
    }
    if (Array.isArray(daysOfWeek)) {
        candidates.push(...daysOfWeek);
    } else if (typeof daysOfWeek === 'string') {
        candidates.push(...daysOfWeek.split(','));
    } else if (typeof daysOfWeek === 'number') {
        candidates.push(daysOfWeek);
    }

    const days: WeekDay[] = [];
    const invalidValues: string[] = [];
    for (const candidate of candidates) {
        const day = parseWeekDay(candidate);
        if (!day) {
            invalidValues.push(String(candidate));
            continue;
        }
        if (!days.includes(day)) {
            days.push(day);
        }
    }

    return {
        days,
        invalidValues,
    };
}

function parseLocalDateKey(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return {
        year,
        month,
        day,
        dateKey: value.trim(),
    };
}

function localDateUtcMs({
    day,
    month,
    year,
}: {
    day: number;
    month: number;
    year: number;
}) {
    return Date.UTC(year, month - 1, day);
}

function localIsoWeekStartUtcMs(parts: {
    day: number;
    month: number;
    year: number;
}) {
    const dateMs = localDateUtcMs(parts);
    const dayOfWeek = new Date(dateMs).getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    return dateMs - daysSinceMonday * millisecondsPerDay;
}

function getBiweeklyWeekOffset(
    parts: ReturnType<typeof getTimeZoneDateParts>,
    anchorDate: string,
) {
    const anchorParts = parseLocalDateKey(anchorDate);
    if (!anchorParts) {
        return null;
    }

    return Math.floor(
        (localIsoWeekStartUtcMs(parts) - localIsoWeekStartUtcMs(anchorParts)) /
            millisecondsPerWeek,
    );
}

function validateScheduleConfigForModule(
    config: AutomationJsonObject,
    moduleKey = scheduleTriggerKey,
) {
    const errors: string[] = [];
    const timeZone = getString(config, 'timeZone') ?? defaultScheduleTimeZone;
    const frequency = getScheduleFrequency(config, moduleKey);

    if (!frequency) {
        errors.push('frequency must be daily, weekly, biweekly, or monthly.');
    }

    if (!isValidTimeZone(timeZone)) {
        errors.push('timeZone must be a valid IANA time zone.');
    }

    if (frequency === 'monthly') {
        const dayOfMonth = getNumber(config, 'dayOfMonth');
        if (
            !Number.isInteger(dayOfMonth) ||
            dayOfMonth === undefined ||
            dayOfMonth < 1 ||
            dayOfMonth > 31
        ) {
            errors.push('dayOfMonth must be an integer from 1 to 31.');
        }
    }

    if (frequency === 'weekly' || frequency === 'biweekly') {
        const { days, invalidValues } = getConfiguredWeekDays(config);
        if (invalidValues.length > 0) {
            errors.push('daysOfWeek must contain valid weekdays.');
        }
        if (days.length === 0) {
            errors.push(
                'dayOfWeek or daysOfWeek is required for weekly schedules.',
            );
        }
    }

    if (frequency === 'biweekly') {
        const anchorDate = getString(config, 'anchorDate');
        if (!anchorDate || !parseLocalDateKey(anchorDate)) {
            errors.push('anchorDate must be a valid YYYY-MM-DD date.');
        }
    }

    return errors;
}

function buildScheduleOccurrence(
    node: AutomationGraphNode,
    {
        enforceDue,
        now,
    }: {
        enforceDue: boolean;
        now: Date;
    },
) {
    const frequency = getScheduleFrequency(node.config, node.moduleKey);
    const timeZone =
        getString(node.config, 'timeZone') ?? defaultScheduleTimeZone;

    if (
        !frequency ||
        validateScheduleConfigForModule(node.config, node.moduleKey).length > 0
    ) {
        return null;
    }

    const parts = getTimeZoneDateParts(now, timeZone);
    const input: AutomationJsonObject = {
        scheduleType: frequency,
        frequency,
        triggerModuleKey: node.moduleKey,
        occurrenceDate: parts.dateKey,
        timeZone,
        enqueuedAt: now.toISOString(),
    };
    let occurrenceKey: string | null = null;

    if (frequency === 'daily') {
        occurrenceKey = `${node.moduleKey}:${timeZone}:daily:${parts.dateKey}`;
    } else if (frequency === 'monthly') {
        const dayOfMonth = getNumber(node.config, 'dayOfMonth');
        if (!dayOfMonth || (enforceDue && parts.day !== dayOfMonth)) {
            return null;
        }
        occurrenceKey =
            node.moduleKey === scheduleMonthlyTriggerKey
                ? `${scheduleMonthlyTriggerKey}:${timeZone}:${parts.periodKey}:day-${dayOfMonth}`
                : `${node.moduleKey}:${timeZone}:monthly:${parts.periodKey}:day-${dayOfMonth}`;
        input.period = parts.periodKey;
        input.dayOfMonth = dayOfMonth;
    } else {
        const { days } = getConfiguredWeekDays(node.config);
        if (enforceDue && !days.includes(parts.dayOfWeek)) {
            return null;
        }

        if (frequency === 'biweekly') {
            const anchorDate = getString(node.config, 'anchorDate');
            if (!anchorDate) {
                return null;
            }
            const weekOffset = getBiweeklyWeekOffset(parts, anchorDate);
            if (
                weekOffset === null ||
                weekOffset < 0 ||
                (enforceDue && weekOffset % 2 !== 0)
            ) {
                return null;
            }
            input.intervalWeeks = 2;
            input.anchorDate = anchorDate;
            input.weekOffset = weekOffset;
        } else {
            input.intervalWeeks = 1;
        }

        occurrenceKey = `${node.moduleKey}:${timeZone}:${frequency}:${parts.dateKey}:${parts.dayOfWeek}`;
        input.dayOfWeek = parts.dayOfWeek;
        input.daysOfWeek = days;
    }

    if (!occurrenceKey) {
        return null;
    }
    input.occurrenceKey = occurrenceKey;

    return {
        eventType: automationScheduleEventType,
        aggregateId: occurrenceKey,
        input,
    };
}

export function getScheduleOccurrence(
    node: AutomationGraphNode,
    now = new Date(),
) {
    return buildScheduleOccurrence(node, { enforceDue: true, now });
}

export function getScheduleTestOccurrence(
    node: AutomationGraphNode,
    now = new Date(),
) {
    return buildScheduleOccurrence(node, { enforceDue: false, now });
}

export function getMonthlyScheduleOccurrence(
    node: AutomationGraphNode,
    now = new Date(),
) {
    return getScheduleOccurrence(node, now);
}

type FarmInventoryOperationConfig = {
    entityId: number;
    entityTypeName: string;
    scheduledInDays: number;
};

const greenhouseSeedlingPlantStatuses = new Set([
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
]);

type RaisedBedForGreenhouseCare = Awaited<
    ReturnType<typeof getAllRaisedBeds>
>[number];
type RaisedBedFieldForGreenhouseCare =
    RaisedBedForGreenhouseCare['fields'][number];

type GreenhouseFarmEligibility = {
    farmId: number;
    greenhouseRaisedBedCount: number;
    greenhouseFieldCount: number;
    activeOutletOfferCount: number;
    reasons: string[];
};

type GreenhouseFarmSkip = {
    farmId: number;
    reason: string;
};

type ExistingOperationSkip = {
    farmId: number;
    operationId: number;
    scheduledDate: string;
};

function parseFarmInventoryOperationConfigs(
    value: unknown,
): FarmInventoryOperationConfig[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return [];
        }

        const entityId = Reflect.get(item, 'entityId');
        const entityTypeName = Reflect.get(item, 'entityTypeName');
        const scheduledInDays = Reflect.get(item, 'scheduledInDays');
        const hasScheduledInDays = Reflect.has(item, 'scheduledInDays');
        if (
            typeof entityId !== 'number' ||
            !Number.isInteger(entityId) ||
            entityId <= 0
        ) {
            return [];
        }
        if (
            hasScheduledInDays &&
            (typeof scheduledInDays !== 'number' ||
                !Number.isInteger(scheduledInDays))
        ) {
            return [];
        }

        return [
            {
                entityId,
                entityTypeName:
                    typeof entityTypeName === 'string' &&
                    entityTypeName.trim().length > 0
                        ? entityTypeName.trim()
                        : 'operation',
                scheduledInDays:
                    typeof scheduledInDays === 'number' ? scheduledInDays : 0,
            },
        ];
    });
}

function validateFarmInventoryOperationsConfig(config: AutomationJsonObject) {
    const operations = config.operations;
    if (!Array.isArray(operations) || operations.length === 0) {
        return ['operations must be a non-empty JSON array.'];
    }

    const validOperations = parseFarmInventoryOperationConfigs(operations);
    if (validOperations.length !== operations.length) {
        return [
            'Each operation must include a positive integer entityId. Optional fields: entityTypeName, integer scheduledInDays.',
        ];
    }

    return [];
}

function parseSingleOperationConfig(
    config: AutomationJsonObject,
): FarmInventoryOperationConfig | null {
    const entityId = getNumber(config, 'entityId');
    if (!entityId || !Number.isInteger(entityId) || entityId <= 0) {
        return null;
    }

    const scheduledInDays = getNumber(config, 'scheduledInDays');
    if (
        scheduledInDays !== undefined &&
        (!Number.isInteger(scheduledInDays) || scheduledInDays < 0)
    ) {
        return null;
    }

    return {
        entityId,
        entityTypeName: getString(config, 'entityTypeName') ?? 'operation',
        scheduledInDays: scheduledInDays ?? 0,
    };
}

function validateGreenhouseSeedlingWateringConfig(
    config: AutomationJsonObject,
) {
    const entityId = getNumber(config, 'entityId');
    const scheduledInDays = getNumber(config, 'scheduledInDays');
    const errors: string[] = [];

    if (!entityId || !Number.isInteger(entityId) || entityId <= 0) {
        errors.push('entityId is required.');
    }
    if (
        scheduledInDays !== undefined &&
        (!Number.isInteger(scheduledInDays) || scheduledInDays < 0)
    ) {
        errors.push('scheduledInDays must be a non-negative integer.');
    }

    return errors;
}

function validateImagePlantStatusReviewConfig(config: AutomationJsonObject) {
    const minConfidence =
        getNumber(config, 'minConfidence') ??
        defaultImagePlantStatusReviewMinConfidence;
    if (minConfidence < 0 || minConfidence > 1) {
        return ['minConfidence must be a number from 0 to 1.'];
    }

    return [];
}

function readPath(source: AutomationJsonObject, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
        if (!segment || !current || typeof current !== 'object') {
            return undefined;
        }

        return Reflect.get(current, segment);
    }, source);
}

function compareValue(left: unknown, operator: string, right: string) {
    if (operator === 'exists') {
        return left !== undefined && left !== null;
    }

    if (operator === 'notExists') {
        return left === undefined || left === null;
    }

    const leftText =
        typeof left === 'string' || typeof left === 'number'
            ? left.toString()
            : typeof left === 'boolean'
              ? left
                  ? 'true'
                  : 'false'
              : undefined;

    if (operator === 'notEquals') {
        return leftText !== right;
    }

    return leftText === right;
}

function skip(reason: string, output: AutomationJsonObject = {}) {
    return {
        status: 'skipped',
        reason,
        output: {
            reason,
            ...output,
        },
    } satisfies AutomationModuleResult;
}

function success(output: AutomationJsonObject = {}) {
    return {
        status: 'succeeded',
        output,
    } satisfies AutomationModuleResult;
}

function addUtcDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate;
}

function toUtcDayKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

function getScheduleReferenceDate(input: AutomationJsonObject) {
    const enqueuedAt = input.enqueuedAt;
    if (typeof enqueuedAt === 'string') {
        const date = new Date(enqueuedAt);
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return new Date();
}

function getScheduleOccurrenceReferenceDate(input: AutomationJsonObject) {
    const occurrenceDate = input.occurrenceDate;
    if (
        typeof occurrenceDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)
    ) {
        return new Date(`${occurrenceDate}T00:00:00.000Z`);
    }

    return getScheduleReferenceDate(input);
}

function farmOperationKey({
    entityId,
    entityTypeName,
    scheduledDate,
}: {
    entityId: number;
    entityTypeName: string;
    scheduledDate: Date;
}) {
    return `${entityTypeName}:${entityId}:${toUtcDayKey(scheduledDate)}`;
}

function isCurrentlyGreenhouseSeedling(field: RaisedBedFieldForGreenhouseCare) {
    return Boolean(
        field.active &&
            field.sowingLocation === 'greenhouse' &&
            typeof field.plantSortId === 'number' &&
            greenhouseSeedlingPlantStatuses.has(field.plantStatus ?? '') &&
            !field.plantDeadDate &&
            !field.plantHarvestedDate &&
            !field.plantRemovedDate,
    );
}

async function getGreenhouseFieldCountsByFarmId() {
    const [raisedBeds, gardens] = await Promise.all([
        getAllRaisedBeds(),
        getGardens(),
    ]);
    const farmIdByGardenId = new Map(
        gardens
            .filter((garden) => !garden.isDeleted && !garden.isSandbox)
            .map((garden) => [garden.id, garden.farmId]),
    );
    const countsByFarmId = new Map<
        number,
        { greenhouseRaisedBedIds: Set<number>; greenhouseFieldCount: number }
    >();

    for (const raisedBed of raisedBeds) {
        if (!raisedBed.gardenId) {
            continue;
        }

        const farmId = farmIdByGardenId.get(raisedBed.gardenId);
        if (!farmId) {
            continue;
        }

        const greenhouseFieldCount = raisedBed.fields.filter(
            isCurrentlyGreenhouseSeedling,
        ).length;
        if (greenhouseFieldCount === 0) {
            continue;
        }

        const farmCounts = countsByFarmId.get(farmId) ?? {
            greenhouseRaisedBedIds: new Set<number>(),
            greenhouseFieldCount: 0,
        };
        farmCounts.greenhouseRaisedBedIds.add(raisedBed.id);
        farmCounts.greenhouseFieldCount += greenhouseFieldCount;
        countsByFarmId.set(farmId, farmCounts);
    }

    return countsByFarmId;
}

function parseRaisedBedFieldAggregateId(aggregateId: string) {
    const [raisedBedIdRaw, positionIndexRaw] = aggregateId.split('|');
    const raisedBedId = Number(raisedBedIdRaw);
    const positionIndex = Number(positionIndexRaw);

    if (
        !Number.isInteger(raisedBedId) ||
        raisedBedId <= 0 ||
        !Number.isInteger(positionIndex) ||
        positionIndex < 0
    ) {
        return null;
    }

    return { raisedBedId, positionIndex };
}

function parseSowingLocation(
    value: unknown,
): RaisedBedFieldSowingLocation | null {
    return value === 'direct' || value === 'greenhouse' ? value : null;
}

function getTargetSowingLocation(config: AutomationJsonObject) {
    const value = getString(config, 'targetSowingLocation');
    return value ? parseSowingLocation(value) : null;
}

function hasTargetSowingLocation(config: AutomationJsonObject) {
    return Boolean(getString(config, 'targetSowingLocation'));
}

function validateRaisedBedFieldPlantAttributesConfig(
    config: AutomationJsonObject,
) {
    const errors: string[] = [];
    const targetStatus = getString(config, 'targetStatus');
    const targetSowingLocation = getTargetSowingLocation(config);

    if (!targetStatus && !targetSowingLocation) {
        errors.push(
            'At least one of targetStatus or targetSowingLocation is required.',
        );
    }

    if (hasTargetSowingLocation(config) && !targetSowingLocation) {
        errors.push('targetSowingLocation must be direct or greenhouse.');
    }

    return errors;
}

async function resolveOperationRaisedBedFieldTarget(
    event: AutomationSourceEvent | undefined,
) {
    if (!event) {
        return {
            ok: false as const,
            result: skip('No source event is available.'),
        };
    }

    const operationId = Number(event.aggregateId);
    if (!Number.isInteger(operationId) || operationId <= 0) {
        return {
            ok: false as const,
            result: skip('Source event aggregate is not an operation id.'),
        };
    }

    const operation = await getOperationById(operationId);
    if (!operation?.raisedBedId || !operation.raisedBedFieldId) {
        return {
            ok: false as const,
            result: skip('Operation has no raised-bed field target.', {
                operationId,
            }),
        };
    }

    const raisedBed = await getRaisedBed(operation.raisedBedId);
    const field = raisedBed?.fields.find(
        (candidate) => candidate.id === operation.raisedBedFieldId,
    );
    if (!raisedBed || !field) {
        return {
            ok: false as const,
            result: skip('Operation target field was not found.', {
                operationId,
                raisedBedId: operation.raisedBedId,
                raisedBedFieldId: operation.raisedBedFieldId,
            }),
        };
    }

    return {
        ok: true as const,
        operationId,
        raisedBed,
        field,
    };
}

function configFieldsForEventType() {
    return [
        {
            key: 'eventType',
            label: 'Event type',
            type: 'string',
            required: true,
            placeholder: knownEventTypes.raisedBedFields.plantUpdate,
        },
    ] satisfies AutomationModuleMetadata['configFields'];
}

const triggerDomainEventModule: AutomationModule = {
    key: domainEventTriggerKey,
    kind: 'trigger',
    title: 'Domain event',
    description: 'Starts an automation from a stored Gredice domain event.',
    category: 'Events',
    configFields: configFieldsForEventType(),
    inputDescription: 'A row from the `events` table.',
    outputDescription: 'The event id, type, aggregate id, and event data.',
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    validateConfig: (config) => requiredString(config, 'eventType'),
    execute: async (context, node) => {
        const eventType = getString(node.config, 'eventType');
        if (!context.event) {
            throw new AutomationModuleExecutionError(
                'Automation run is missing a source event.',
                'missing_source_event',
            );
        }

        if (eventType && context.event.type !== eventType) {
            return skip('Source event type did not match trigger config.', {
                expected: eventType,
                actual: context.event.type,
            });
        }

        return success({
            eventId: context.event.id ?? null,
            eventType: context.event.type,
            aggregateId: context.event.aggregateId,
            data: context.event.data,
        });
    },
};

function scheduleConfigFields() {
    return [
        {
            key: 'frequency',
            label: 'Frequency',
            type: 'select',
            required: true,
            options: [
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Biweekly' },
                { value: 'monthly', label: 'Monthly' },
            ],
        },
        {
            key: 'dayOfWeek',
            label: 'Day of week',
            type: 'select',
            required: false,
            options: weekDayValues.map((day) => ({
                value: day,
                label: weekDayLabel(day),
            })),
            description:
                'For weekly or biweekly schedules. Use daysOfWeek for multiple selected weekdays.',
        },
        {
            key: 'daysOfWeek',
            label: 'Days of week',
            type: 'json',
            required: false,
            description:
                'Optional JSON array for weekly or biweekly schedules, for example ["tuesday", "friday"].',
        },
        {
            key: 'anchorDate',
            label: 'Biweekly anchor date',
            type: 'string',
            required: false,
            placeholder: defaultBiweeklyAnchorDate,
            description:
                'Required for biweekly schedules. Weeks are counted from this local YYYY-MM-DD date.',
        },
        {
            key: 'dayOfMonth',
            label: 'Day of month',
            type: 'number',
            required: false,
            placeholder: '1',
            description: 'Required for monthly schedules.',
        },
        {
            key: 'timeZone',
            label: 'Time zone',
            type: 'string',
            required: false,
            placeholder: defaultScheduleTimeZone,
        },
    ] satisfies AutomationModuleMetadata['configFields'];
}

function executeScheduleTrigger(
    context: Parameters<AutomationModule['execute']>[0],
    node: AutomationGraphNode,
) {
    const input = context.run.input;
    const frequency = getScheduleFrequency(node.config, node.moduleKey);
    const scheduleType = input.scheduleType;
    const triggerModuleKey = input.triggerModuleKey;
    const occurrenceKey = input.occurrenceKey;

    if (
        !frequency ||
        scheduleType !== frequency ||
        triggerModuleKey !== node.moduleKey ||
        typeof occurrenceKey !== 'string'
    ) {
        return skip('Automation run is not a matching schedule occurrence.');
    }

    return success({
        occurrenceKey,
        frequency,
        scheduleType,
        period: typeof input.period === 'string' ? input.period : null,
        occurrenceDate:
            typeof input.occurrenceDate === 'string'
                ? input.occurrenceDate
                : null,
        dayOfMonth:
            typeof input.dayOfMonth === 'number' ? input.dayOfMonth : null,
        dayOfWeek: typeof input.dayOfWeek === 'string' ? input.dayOfWeek : null,
        daysOfWeek: Array.isArray(input.daysOfWeek) ? input.daysOfWeek : [],
        intervalWeeks:
            typeof input.intervalWeeks === 'number'
                ? input.intervalWeeks
                : null,
        anchorDate:
            typeof input.anchorDate === 'string' ? input.anchorDate : null,
        timeZone:
            typeof input.timeZone === 'string'
                ? input.timeZone
                : defaultScheduleTimeZone,
    });
}

const triggerScheduleModule: AutomationModule = {
    key: scheduleTriggerKey,
    kind: 'trigger',
    title: 'Schedule',
    description:
        'Starts an automation from a daily, weekly, biweekly, or monthly schedule.',
    category: 'Schedules',
    configFields: scheduleConfigFields(),
    inputDescription:
        'A scheduled occurrence generated by the automation runner.',
    outputDescription: 'The occurrence key and configured local date.',
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    validateConfig: (config) =>
        validateScheduleConfigForModule(config, scheduleTriggerKey),
    execute: async (context, node) => executeScheduleTrigger(context, node),
};

const triggerScheduleMonthlyModule: AutomationModule = {
    key: scheduleMonthlyTriggerKey,
    kind: 'trigger',
    title: 'Monthly schedule',
    description:
        'Starts an automation once per month on the configured local day.',
    category: 'Schedules',
    configFields: [
        {
            key: 'dayOfMonth',
            label: 'Day of month',
            type: 'number',
            required: true,
            placeholder: '1',
        },
        {
            key: 'timeZone',
            label: 'Time zone',
            type: 'string',
            required: false,
            placeholder: defaultScheduleTimeZone,
        },
    ],
    inputDescription:
        'A scheduled monthly occurrence generated by the automation runner.',
    outputDescription: 'The monthly occurrence key and configured local date.',
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    validateConfig: (config) =>
        validateScheduleConfigForModule(config, scheduleMonthlyTriggerKey),
    execute: async (context, node) => executeScheduleTrigger(context, node),
};

const eventDataEqualsConditionModule: AutomationModule = {
    key: eventDataEqualsConditionKey,
    kind: 'condition',
    title: 'Event data comparison',
    description: 'Checks a value in the event payload before continuing.',
    category: 'Event filters',
    configFields: [
        {
            key: 'path',
            label: 'Data path',
            type: 'string',
            required: true,
            placeholder: 'status',
        },
        {
            key: 'operator',
            label: 'Operator',
            type: 'select',
            required: true,
            options: [
                { value: 'equals', label: 'Equals' },
                { value: 'notEquals', label: 'Does not equal' },
                { value: 'exists', label: 'Exists' },
                { value: 'notExists', label: 'Does not exist' },
            ],
        },
        {
            key: 'value',
            label: 'Value',
            type: 'string',
            required: false,
            placeholder: 'sowed',
        },
    ],
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    validateConfig: (config) => [
        ...requiredString(config, 'path'),
        ...requiredString(config, 'operator'),
    ],
    execute: async (context, node) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const path = getString(node.config, 'path') ?? '';
        const operator = getString(node.config, 'operator') ?? 'equals';
        const expected = getString(node.config, 'value') ?? '';
        const actual = readPath(context.event.data, path);
        const matched = compareValue(actual, operator, expected);

        if (!matched) {
            return skip('Event data condition did not match.', {
                path,
                operator,
                expected,
                actual:
                    typeof actual === 'string' ||
                    typeof actual === 'number' ||
                    typeof actual === 'boolean'
                        ? actual
                        : null,
            });
        }

        return success({ path, operator, matched: true });
    },
};

const operationMatchesConditionModule: AutomationModule = {
    key: operationMatchesConditionKey,
    kind: 'condition',
    title: 'Operation matches',
    description:
        'Checks operation state or operation directory metadata for operation events.',
    category: 'Operations',
    configFields: [
        {
            key: 'status',
            label: 'Operation status',
            type: 'string',
            placeholder: 'completed',
        },
        {
            key: 'entityId',
            label: 'Operation entity ID',
            type: 'number',
        },
        {
            key: 'application',
            label: 'Operation application',
            type: 'string',
            placeholder: 'plant',
        },
    ],
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    execute: async (context, node) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const operationId = Number(context.event.aggregateId);
        if (!Number.isInteger(operationId) || operationId <= 0) {
            return skip('Source event aggregate is not an operation id.');
        }

        const operation = await getOperationById(operationId);
        if (!operation) {
            return skip('Operation was not found.', { operationId });
        }

        const expectedStatus = getString(node.config, 'status');
        if (expectedStatus && operation.status !== expectedStatus) {
            return skip('Operation status did not match.', {
                expected: expectedStatus,
                actual: operation.status,
            });
        }

        const expectedEntityId = getNumber(node.config, 'entityId');
        if (expectedEntityId && operation.entityId !== expectedEntityId) {
            return skip('Operation entity id did not match.', {
                expected: expectedEntityId,
                actual: operation.entityId,
            });
        }

        const expectedApplication = getString(node.config, 'application');
        if (expectedApplication) {
            const operationEntity =
                await getEntityFormatted<EntityStandardized>(
                    operation.entityId,
                );
            const actualApplication =
                typeof operationEntity?.attributes?.application === 'string'
                    ? operationEntity.attributes.application
                    : null;

            if (actualApplication !== expectedApplication) {
                return skip('Operation application did not match.', {
                    expected: expectedApplication,
                    actual: actualApplication,
                });
            }
        }

        return success({
            operationId,
            operationStatus: operation.status,
            entityId: operation.entityId,
            raisedBedId: operation.raisedBedId,
            raisedBedFieldId: operation.raisedBedFieldId,
        });
    },
};

const plantStatusEqualsConditionModule: AutomationModule = {
    key: plantStatusEqualsConditionKey,
    kind: 'condition',
    title: 'Plant status comparison',
    description: 'Checks the current raised-bed field plant status.',
    category: 'Raised-bed fields',
    configFields: [
        {
            key: 'status',
            label: 'Plant status',
            type: 'string',
            required: true,
            placeholder: 'sowed',
        },
    ],
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    validateConfig: (config) => requiredString(config, 'status'),
    execute: async (context, node) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const expectedStatus = getString(node.config, 'status');
        if (!expectedStatus) {
            throw new AutomationModuleExecutionError(
                'Plant status condition is missing status config.',
                'invalid_config',
            );
        }

        const parsed = parseRaisedBedFieldAggregateId(
            context.event.aggregateId,
        );
        if (!parsed) {
            return skip(
                'Source event aggregate is not a raised-bed field aggregate.',
            );
        }

        const raisedBed = await getRaisedBed(parsed.raisedBedId);
        const field = raisedBed?.fields.find(
            (candidate) =>
                candidate.positionIndex === parsed.positionIndex &&
                candidate.active,
        );
        const actualStatus = field?.plantStatus ?? null;

        if (actualStatus !== expectedStatus) {
            return skip('Plant status did not match.', {
                expected: expectedStatus,
                actual: actualStatus,
            });
        }

        return success({
            raisedBedId: parsed.raisedBedId,
            positionIndex: parsed.positionIndex,
            plantStatus: actualStatus,
        });
    },
};

const queueSeasonalSowingOfferOperationsActionModule: AutomationModule = {
    key: queueSeasonalSowingOfferOperationsActionKey,
    kind: 'action',
    title: 'Queue seasonal watering operations',
    description:
        'Queues the current seasonal free watering offer after a field is sowed.',
    category: 'Operations',
    configFields: [],
    inputDescription:
        'A `raisedBedField.plantUpdate` event with aggregate id `raisedBedId|positionIndex`.',
    outputDescription: 'Created operation ids, or a skip reason.',
    dryRunSupported: true,
    mutatesData: true,
    retryable: true,
    execute: async (context) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const parsed = parseRaisedBedFieldAggregateId(
            context.event.aggregateId,
        );
        if (!parsed) {
            return skip(
                'Source event aggregate is not a raised-bed field aggregate.',
            );
        }

        const raisedBed = await getRaisedBed(parsed.raisedBedId);
        if (!raisedBed?.accountId) {
            return skip('Raised bed or account was not found.', {
                raisedBedId: parsed.raisedBedId,
            });
        }

        if (context.dryRun) {
            return success({
                dryRun: true,
                accountId: raisedBed.accountId,
                gardenId: raisedBed.gardenId,
                raisedBedId: raisedBed.id,
            });
        }

        const createdOperationIds = await queueSeasonalSowingOfferOperations({
            accountId: raisedBed.accountId,
            ...(raisedBed.gardenId ? { gardenId: raisedBed.gardenId } : {}),
            raisedBedId: raisedBed.id,
            referenceDate: context.event.createdAt ?? new Date(),
        });

        if (createdOperationIds.length === 0) {
            return skip('No seasonal watering operations were queued.', {
                accountId: raisedBed.accountId,
                raisedBedId: raisedBed.id,
            });
        }

        return success({
            createdOperationIds,
            createdCount: createdOperationIds.length,
        });
    },
};

const queuePostTransplantWateringOperationsActionModule: AutomationModule = {
    key: queuePostTransplantWateringOperationsActionKey,
    kind: 'action',
    title: 'Queue post-transplant watering operations',
    description:
        'Queues 50L raised-bed watering operations for the two days after a seedling transplant is verified.',
    category: 'Operations',
    configFields: [],
    inputDescription:
        'An `operation.verify` event for a seedling transplant operation with a raised-bed target.',
    outputDescription: 'Created operation ids, or a skip reason.',
    dryRunSupported: true,
    mutatesData: true,
    retryable: true,
    execute: async (context) => {
        if (!context.event) {
            return skip('No source event is available.');
        }

        const operationId = Number(context.event.aggregateId);
        if (!Number.isInteger(operationId) || operationId <= 0) {
            return skip('Source event aggregate is not an operation id.');
        }

        let operation: Awaited<ReturnType<typeof getOperationById>> | null =
            null;
        try {
            operation = await getOperationById(operationId);
        } catch {
            return skip('Operation was not found.', { operationId });
        }

        if (!operation.raisedBedId) {
            return skip('Operation has no raised-bed target.', {
                operationId,
            });
        }

        const raisedBed = await getRaisedBed(operation.raisedBedId);
        if (!raisedBed?.accountId) {
            return skip('Raised bed or account was not found.', {
                operationId,
                raisedBedId: operation.raisedBedId,
            });
        }

        const referenceDate = context.event.createdAt ?? new Date();
        const gardenId = operation.gardenId ?? raisedBed.gardenId ?? undefined;

        if (context.dryRun) {
            return success({
                dryRun: true,
                operationId,
                accountId: raisedBed.accountId,
                gardenId: gardenId ?? null,
                raisedBedId: raisedBed.id,
                wateringOperationEntityId: RAISED_BED_WATERING_50L_OPERATION_ID,
                scheduledDates: [1, 2].map((dayOffset) =>
                    addUtcDays(referenceDate, dayOffset).toISOString(),
                ),
            });
        }

        const createdOperationIds = await queuePostTransplantWateringOperations(
            {
                accountId: raisedBed.accountId,
                ...(gardenId ? { gardenId } : {}),
                raisedBedId: raisedBed.id,
                referenceDate,
            },
        );

        if (createdOperationIds.length === 0) {
            return skip('Post-transplant watering operations already exist.', {
                operationId,
                raisedBedId: raisedBed.id,
                wateringOperationEntityId: RAISED_BED_WATERING_50L_OPERATION_ID,
            });
        }

        return success({
            createdOperationIds,
            createdCount: createdOperationIds.length,
            wateringOperationEntityId: RAISED_BED_WATERING_50L_OPERATION_ID,
        });
    },
};

const createOperationActionModule: AutomationModule = {
    key: createOperationActionKey,
    kind: 'action',
    title: 'Create operation',
    description: 'Creates a Gredice operation for the current event context.',
    category: 'Operations',
    configFields: [
        {
            key: 'entityId',
            label: 'Operation entity ID',
            type: 'number',
            required: true,
        },
        {
            key: 'entityTypeName',
            label: 'Entity type',
            type: 'string',
            placeholder: 'operation',
        },
        {
            key: 'scheduledInDays',
            label: 'Schedule after days',
            type: 'number',
        },
    ],
    dryRunSupported: true,
    mutatesData: true,
    retryable: true,
    validateConfig: (config) =>
        getNumber(config, 'entityId') ? [] : ['entityId is required.'],
    execute: async (context, node) => {
        const entityId = getNumber(node.config, 'entityId');
        if (!entityId) {
            throw new AutomationModuleExecutionError(
                'Create operation action is missing entityId.',
                'invalid_config',
            );
        }

        const event = context.event;
        let accountId: string | undefined;
        let gardenId: number | undefined;
        let raisedBedId: number | undefined;
        let raisedBedFieldId: number | undefined;

        if (event?.type.startsWith('operation.')) {
            const operation = await getOperationById(Number(event.aggregateId));
            accountId = operation?.accountId ?? undefined;
            gardenId = operation?.gardenId ?? undefined;
            raisedBedId = operation?.raisedBedId ?? undefined;
            raisedBedFieldId = operation?.raisedBedFieldId ?? undefined;
        } else if (event?.aggregateId) {
            const parsed = parseRaisedBedFieldAggregateId(event.aggregateId);
            if (parsed) {
                const raisedBed = await getRaisedBed(parsed.raisedBedId);
                const field = raisedBed?.fields.find(
                    (candidate) =>
                        candidate.positionIndex === parsed.positionIndex &&
                        candidate.active,
                );
                accountId = raisedBed?.accountId ?? undefined;
                gardenId = raisedBed?.gardenId ?? undefined;
                raisedBedId = raisedBed?.id;
                raisedBedFieldId = field?.id;
            }
        }

        if (!accountId && !raisedBedId) {
            return skip('No operation target could be resolved.');
        }

        const scheduledInDays = getNumber(node.config, 'scheduledInDays');
        const scheduledDate =
            scheduledInDays === undefined
                ? undefined
                : new Date(
                      (event?.createdAt ?? new Date()).getTime() +
                          scheduledInDays * 24 * 60 * 60 * 1000,
                  );

        if (context.dryRun) {
            return success({
                dryRun: true,
                entityId,
                accountId,
                gardenId,
                raisedBedId,
                raisedBedFieldId,
                scheduledDate: scheduledDate?.toISOString() ?? null,
            });
        }

        const operationId = await createOperation({
            entityId,
            entityTypeName:
                getString(node.config, 'entityTypeName') ?? 'operation',
            accountId,
            gardenId,
            raisedBedId,
            raisedBedFieldId,
        });

        if (scheduledDate) {
            await createEvent(
                knownEvents.operations.scheduledV1(operationId.toString(), {
                    scheduledDate: scheduledDate.toISOString(),
                }),
            );
        }

        return success({
            operationId,
            scheduledDate: scheduledDate?.toISOString() ?? null,
        });
    },
};

const createFarmInventoryOperationsActionModule: AutomationModule = {
    key: createFarmInventoryOperationsActionKey,
    kind: 'action',
    title: 'Create farm inventory operations',
    description:
        'Creates configured inventory task operations for every active farm.',
    category: 'Operations',
    configFields: [
        {
            key: 'operations',
            label: 'Operations',
            type: 'json',
            required: true,
            description:
                'JSON array: [{"entityId": 123, "entityTypeName": "operation", "scheduledInDays": 0}]',
        },
    ],
    inputDescription: 'A monthly schedule occurrence.',
    outputDescription: 'Created operation ids and skipped existing counts.',
    dryRunSupported: true,
    mutatesData: true,
    retryable: true,
    validateConfig: validateFarmInventoryOperationsConfig,
    execute: async (context, node) => {
        const operationConfigs = parseFarmInventoryOperationConfigs(
            node.config.operations,
        );
        if (operationConfigs.length === 0) {
            throw new AutomationModuleExecutionError(
                'Farm inventory operation action is missing operations config.',
                'invalid_config',
            );
        }

        const referenceDate = getScheduleOccurrenceReferenceDate(
            context.run.input,
        );
        const scheduledDates = operationConfigs.map((operationConfig) =>
            addUtcDays(referenceDate, operationConfig.scheduledInDays),
        );
        const from = new Date(
            Math.min(...scheduledDates.map((date) => date.getTime())),
        );
        const to = addUtcDays(
            new Date(Math.max(...scheduledDates.map((date) => date.getTime()))),
            1,
        );
        const activeFarms = (await getFarms()).filter(
            (farm) => !farm.isDeleted,
        );

        if (activeFarms.length === 0) {
            return skip('No active farms were found.');
        }

        let skippedExistingCount = 0;
        let repairedScheduledCount = 0;
        const createdOperationIds: number[] = [];
        const repairedScheduledOperationIds: number[] = [];

        for (const farm of activeFarms) {
            const existingOperations =
                await getFarmAcceptedOperationsByScheduleRange({
                    farmId: farm.id,
                    from,
                    to,
                });
            const existingOperationsByKey = new Map(
                existingOperations.flatMap((operation) => {
                    if (
                        operation.status === 'canceled' ||
                        operation.status === 'failed'
                    ) {
                        return [];
                    }

                    return [
                        [
                            farmOperationKey({
                                entityId: operation.entityId,
                                entityTypeName: operation.entityTypeName,
                                scheduledDate:
                                    operation.scheduledDate ??
                                    operation.timestamp,
                            }),
                            operation,
                        ],
                    ];
                }),
            );
            const existingOperationKeys = new Set(
                existingOperationsByKey.keys(),
            );

            for (const operationConfig of operationConfigs) {
                const scheduledDate = addUtcDays(
                    referenceDate,
                    operationConfig.scheduledInDays,
                );
                const operationKey = farmOperationKey({
                    entityId: operationConfig.entityId,
                    entityTypeName: operationConfig.entityTypeName,
                    scheduledDate,
                });
                const existingOperation =
                    existingOperationsByKey.get(operationKey);

                if (
                    existingOperation ||
                    existingOperationKeys.has(operationKey)
                ) {
                    skippedExistingCount += 1;
                    if (existingOperation && !existingOperation.scheduledDate) {
                        repairedScheduledCount += 1;
                        if (!context.dryRun) {
                            await createEvent(
                                knownEvents.operations.scheduledV1(
                                    existingOperation.id.toString(),
                                    {
                                        scheduledDate:
                                            scheduledDate.toISOString(),
                                    },
                                ),
                            );
                            repairedScheduledOperationIds.push(
                                existingOperation.id,
                            );
                        }
                    }
                    continue;
                }

                if (context.dryRun) {
                    continue;
                }

                const operationId = await createOperation({
                    entityId: operationConfig.entityId,
                    entityTypeName: operationConfig.entityTypeName,
                    farmId: farm.id,
                    timestamp: scheduledDate,
                });
                await acceptOperation(operationId);
                await createEvent(
                    knownEvents.operations.scheduledV1(operationId.toString(), {
                        scheduledDate: scheduledDate.toISOString(),
                    }),
                );
                createdOperationIds.push(operationId);
                existingOperationKeys.add(operationKey);
            }
        }

        if (context.dryRun) {
            const projectedCreateCount =
                activeFarms.length * operationConfigs.length -
                skippedExistingCount;
            return success({
                dryRun: true,
                farmCount: activeFarms.length,
                operationCount: operationConfigs.length,
                createdCount: projectedCreateCount,
                projectedCreateCount,
                skippedCount: skippedExistingCount,
                skippedExistingCount,
                skippedScheduledCount: skippedExistingCount,
                repairedScheduledCount,
            });
        }

        if (
            createdOperationIds.length === 0 &&
            repairedScheduledOperationIds.length === 0
        ) {
            return skip(
                'All configured farm inventory operations already exist.',
                {
                    farmCount: activeFarms.length,
                    operationCount: operationConfigs.length,
                    createdCount: 0,
                    skippedCount: skippedExistingCount,
                    skippedExistingCount,
                    skippedScheduledCount: skippedExistingCount,
                    repairedScheduledCount: 0,
                },
            );
        }

        return success({
            createdOperationIds,
            createdCount: createdOperationIds.length,
            repairedScheduledOperationIds,
            repairedScheduledCount: repairedScheduledOperationIds.length,
            skippedCount: skippedExistingCount,
            skippedExistingCount,
            skippedScheduledCount: skippedExistingCount,
            farmCount: activeFarms.length,
            operationCount: operationConfigs.length,
        });
    },
};

const createGreenhouseSeedlingWateringOperationsActionModule: AutomationModule =
    {
        key: createGreenhouseSeedlingWateringOperationsActionKey,
        kind: 'action',
        title: 'Create greenhouse seedling watering operations',
        description:
            'Creates one daily farm-scoped greenhouse seedling watering operation for farms with greenhouse seedlings or active outlet seedling stock.',
        category: 'Operations',
        configFields: [
            {
                key: 'entityId',
                label: 'Operation entity ID',
                type: 'number',
                required: true,
            },
            {
                key: 'entityTypeName',
                label: 'Entity type',
                type: 'string',
                placeholder: 'operation',
            },
            {
                key: 'scheduledInDays',
                label: 'Schedule after days',
                type: 'number',
                placeholder: '0',
            },
        ],
        inputDescription: 'A daily schedule occurrence.',
        outputDescription:
            'Eligible farms, skipped farms, existing-operation skips, and created operation ids.',
        dryRunSupported: true,
        mutatesData: true,
        retryable: true,
        validateConfig: validateGreenhouseSeedlingWateringConfig,
        execute: async (context, node) => {
            const operationConfig = parseSingleOperationConfig(node.config);
            if (!operationConfig) {
                throw new AutomationModuleExecutionError(
                    'Greenhouse seedling watering action is missing a valid operation config.',
                    'invalid_config',
                );
            }

            const referenceDate = getScheduleOccurrenceReferenceDate(
                context.run.input,
            );
            const availabilityDate = getScheduleReferenceDate(
                context.run.input,
            );
            const scheduledDate = addUtcDays(
                referenceDate,
                operationConfig.scheduledInDays,
            );
            const rangeEnd = addUtcDays(scheduledDate, 1);
            const [activeFarms, greenhouseCountsByFarmId, activeOutletOffers] =
                await Promise.all([
                    getFarms().then((farms) =>
                        farms.filter((farm) => !farm.isDeleted),
                    ),
                    getGreenhouseFieldCountsByFarmId(),
                    getOutletOffers({ now: availabilityDate }),
                ]);

            if (activeFarms.length === 0) {
                return skip('No active farms were found.');
            }

            const activeOutletOfferCount = activeOutletOffers.length;
            const eligibleFarms: GreenhouseFarmEligibility[] = [];
            const skippedFarms: GreenhouseFarmSkip[] = [];

            for (const farm of activeFarms) {
                const greenhouseCounts = greenhouseCountsByFarmId.get(farm.id);
                const greenhouseFieldCount =
                    greenhouseCounts?.greenhouseFieldCount ?? 0;
                const greenhouseRaisedBedCount =
                    greenhouseCounts?.greenhouseRaisedBedIds.size ?? 0;
                const reasons = [
                    ...(greenhouseFieldCount > 0 ? ['greenhouseFields'] : []),
                    ...(activeOutletOfferCount > 0
                        ? ['activeOutletStock']
                        : []),
                ];

                if (reasons.length === 0) {
                    skippedFarms.push({
                        farmId: farm.id,
                        reason: 'No greenhouse-located plants or active outlet seedlings.',
                    });
                    continue;
                }

                eligibleFarms.push({
                    farmId: farm.id,
                    greenhouseRaisedBedCount,
                    greenhouseFieldCount,
                    activeOutletOfferCount,
                    reasons,
                });
            }

            const existingOperationSkips: ExistingOperationSkip[] = [];
            const createdOperationIds: number[] = [];
            const repairedScheduledOperationIds: number[] = [];

            for (const farm of eligibleFarms) {
                const existingOperations =
                    await getFarmAcceptedOperationsByScheduleRange({
                        farmId: farm.farmId,
                        from: scheduledDate,
                        to: rangeEnd,
                    });
                const existingOperationsByKey = new Map(
                    existingOperations.flatMap((operation) => {
                        if (
                            operation.status === 'canceled' ||
                            operation.status === 'failed'
                        ) {
                            return [];
                        }

                        return [
                            [
                                farmOperationKey({
                                    entityId: operation.entityId,
                                    entityTypeName: operation.entityTypeName,
                                    scheduledDate:
                                        operation.scheduledDate ??
                                        operation.timestamp,
                                }),
                                operation,
                            ],
                        ];
                    }),
                );
                const operationKey = farmOperationKey({
                    entityId: operationConfig.entityId,
                    entityTypeName: operationConfig.entityTypeName,
                    scheduledDate,
                });
                const existingOperation =
                    existingOperationsByKey.get(operationKey);

                if (existingOperation) {
                    existingOperationSkips.push({
                        farmId: farm.farmId,
                        operationId: existingOperation.id,
                        scheduledDate: scheduledDate.toISOString(),
                    });
                    if (!existingOperation.scheduledDate && !context.dryRun) {
                        await createEvent(
                            knownEvents.operations.scheduledV1(
                                existingOperation.id.toString(),
                                {
                                    scheduledDate: scheduledDate.toISOString(),
                                },
                            ),
                        );
                        repairedScheduledOperationIds.push(
                            existingOperation.id,
                        );
                    }
                    continue;
                }

                if (context.dryRun) {
                    continue;
                }

                const operationId = await createOperation({
                    entityId: operationConfig.entityId,
                    entityTypeName: operationConfig.entityTypeName,
                    farmId: farm.farmId,
                    timestamp: scheduledDate,
                });
                await acceptOperation(operationId);
                await createEvent(
                    knownEvents.operations.scheduledV1(operationId.toString(), {
                        scheduledDate: scheduledDate.toISOString(),
                    }),
                );
                createdOperationIds.push(operationId);
            }

            const output = {
                dryRun: context.dryRun,
                operationEntityId: operationConfig.entityId,
                entityTypeName: operationConfig.entityTypeName,
                scheduledDate: scheduledDate.toISOString(),
                activeFarmCount: activeFarms.length,
                eligibleFarms,
                eligibleFarmCount: eligibleFarms.length,
                skippedFarms,
                skippedFarmCount: skippedFarms.length,
                existingOperationSkips,
                existingOperationSkipCount: existingOperationSkips.length,
                activeOutletOfferCount,
                outletAvailabilityCheckedAt: availabilityDate.toISOString(),
                projectedCreateCount:
                    eligibleFarms.length - existingOperationSkips.length,
            };

            if (context.dryRun) {
                return success(output);
            }

            if (
                createdOperationIds.length === 0 &&
                repairedScheduledOperationIds.length === 0
            ) {
                if (eligibleFarms.length === 0) {
                    return skip(
                        'No farms require greenhouse seedling watering.',
                        output,
                    );
                }

                return skip(
                    'All greenhouse seedling watering operations already exist.',
                    output,
                );
            }

            return success({
                ...output,
                createdOperationIds,
                createdCount: createdOperationIds.length,
                repairedScheduledOperationIds,
                repairedScheduledCount: repairedScheduledOperationIds.length,
            });
        },
    };

async function updateRaisedBedFieldPlantAttributes({
    context,
    node,
    noChangeReason = 'Plant already has the target attributes.',
}: {
    context: Parameters<AutomationModule['execute']>[0];
    node: AutomationGraphNode;
    noChangeReason?: string;
}) {
    const targetStatus = getString(node.config, 'targetStatus');
    const targetSowingLocation = getTargetSowingLocation(node.config);

    if (!targetStatus && !targetSowingLocation) {
        throw new AutomationModuleExecutionError(
            'Plant attribute action is missing targetStatus or targetSowingLocation.',
            'invalid_config',
        );
    }

    const target = await resolveOperationRaisedBedFieldTarget(context.event);
    if (!target.ok) {
        return target.result;
    }

    const statusChanged =
        Boolean(targetStatus) && target.field.plantStatus !== targetStatus;
    const sowingLocationChanged =
        Boolean(targetSowingLocation) &&
        target.field.sowingLocation !== targetSowingLocation;

    if (!statusChanged && !sowingLocationChanged) {
        return skip(noChangeReason, {
            operationId: target.operationId,
            targetStatus: targetStatus ?? null,
            targetSowingLocation: targetSowingLocation ?? null,
        });
    }

    const output = {
        operationId: target.operationId,
        raisedBedId: target.raisedBed.id,
        positionIndex: target.field.positionIndex,
        previousStatus: target.field.plantStatus ?? null,
        targetStatus: targetStatus ?? null,
        previousSowingLocation: target.field.sowingLocation,
        targetSowingLocation: targetSowingLocation ?? null,
        updatedAttributes: [
            ...(statusChanged ? ['plantStatus'] : []),
            ...(sowingLocationChanged ? ['sowingLocation'] : []),
        ],
    };

    if (context.dryRun) {
        return success({
            dryRun: true,
            ...output,
        });
    }

    const aggregateId = `${target.raisedBed.id}|${target.field.positionIndex}`;
    if (sowingLocationChanged && targetSowingLocation) {
        await createEvent(
            knownEvents.raisedBedFields.plantScheduleV1(aggregateId, {
                scheduledDate:
                    target.field.plantScheduledDate?.toISOString() ?? null,
                sowingLocation: targetSowingLocation,
            }),
        );
    }

    if (statusChanged && targetStatus) {
        await createEvent(
            knownEvents.raisedBedFields.plantUpdateV1(
                aggregateId,
                buildRaisedBedFieldPlantUpdatePayload(
                    targetStatus,
                    target.field.assignedUserIds,
                ),
            ),
        );
    }

    return success(output);
}

const updateRaisedBedFieldPlantAttributesActionModule: AutomationModule = {
    key: updateRaisedBedFieldPlantAttributesActionKey,
    kind: 'action',
    title: 'Update plant attributes',
    description:
        'Updates plant status and/or sowing location for the operation target field.',
    category: 'Raised-bed fields',
    configFields: [
        {
            key: 'targetStatus',
            label: 'Target status',
            type: 'string',
            placeholder: 'sprouted',
        },
        {
            key: 'targetSowingLocation',
            label: 'Target sowing location',
            type: 'select',
            placeholder: 'direct',
            description: 'Optional. Accepted values: direct, greenhouse.',
            options: [
                { value: '', label: 'Do not change' },
                { value: 'direct', label: 'Direct' },
                { value: 'greenhouse', label: 'Greenhouse' },
            ],
        },
    ],
    dryRunSupported: true,
    mutatesData: true,
    retryable: true,
    validateConfig: validateRaisedBedFieldPlantAttributesConfig,
    execute: async (context, node) =>
        updateRaisedBedFieldPlantAttributes({ context, node }),
};

const createPlantStatusRequestsFromImageAnalysisActionModule: AutomationModule =
    {
        key: createPlantStatusRequestsFromImageAnalysisActionKey,
        kind: 'action',
        title: 'Review raised-bed images for plant and weed status',
        description:
            'Analyzes raised-bed images, creates pending plant-status approval requests, and records high-confidence field weed-state observations.',
        category: 'Raised-bed fields',
        configFields: [
            {
                key: 'minConfidence',
                label: 'Minimum confidence',
                type: 'number',
                required: false,
                placeholder:
                    defaultImagePlantStatusReviewMinConfidence.toString(),
                description:
                    'Only proposals at or above this confidence create approval requests.',
            },
            {
                key: 'requestedBy',
                label: 'Requested by',
                type: 'string',
                required: false,
                placeholder: RAISED_BED_IMAGE_PLANT_STATUS_REVIEW_REQUESTER,
            },
        ],
        inputDescription:
            'An operation completion event with hosted images, or a raised-bed image analysis event.',
        outputDescription:
            'Created approval request ids, field weed-state event ids, skipped proposals, token usage, and review summary.',
        dryRunSupported: true,
        mutatesData: true,
        retryable: true,
        validateConfig: validateImagePlantStatusReviewConfig,
        execute: async (context, node) => {
            if (!context.event) {
                return skip('No source event is available.');
            }

            const minConfidence =
                getNumber(node.config, 'minConfidence') ??
                defaultImagePlantStatusReviewMinConfidence;
            const requestedBy =
                getString(node.config, 'requestedBy') ??
                RAISED_BED_IMAGE_PLANT_STATUS_REVIEW_REQUESTER;

            if (context.dryRun) {
                const preview = await previewRaisedBedImagePlantStatusReview(
                    context.event,
                );
                if (!preview.ok) {
                    return skip(preview.reason, preview.output);
                }

                return success({
                    dryRun: true,
                    minConfidence,
                    requestedBy,
                    ...preview.output,
                });
            }

            if (!hasRaisedBedImagePlantStatusReviewAiConfig()) {
                return skip('AI Gateway credentials are not configured.');
            }

            try {
                const result = await runRaisedBedImagePlantStatusReview({
                    event: context.event,
                    minConfidence,
                    requestedBy,
                });
                if (!result.ok) {
                    if ('retryable' in result && result.retryable) {
                        throw new AutomationModuleExecutionError(
                            result.reason,
                            'errorCode' in result &&
                                typeof result.errorCode === 'string'
                                ? result.errorCode
                                : 'raised_bed_image_plant_status_review_failed',
                            true,
                            result.output,
                        );
                    }

                    return skip(result.reason, result.output);
                }

                return success(result.output);
            } catch (error) {
                if (error instanceof AutomationModuleExecutionError) {
                    throw error;
                }

                throw new AutomationModuleExecutionError(
                    error instanceof Error
                        ? error.message
                        : 'Raised-bed image plant-status review failed.',
                    'raised_bed_image_plant_status_review_failed',
                    true,
                );
            }
        },
    };

const logActionModule: AutomationModule = {
    key: logActionKey,
    kind: 'action',
    title: 'Log only',
    description:
        'Records a no-op action result for testing an automation path.',
    category: 'Diagnostics',
    configFields: [
        {
            key: 'message',
            label: 'Message',
            type: 'string',
            placeholder: 'Automation reached this step.',
        },
    ],
    dryRunSupported: true,
    mutatesData: false,
    retryable: false,
    execute: async (_context, node) =>
        success({
            message:
                getString(node.config, 'message') ??
                'Automation reached log action.',
        }),
};

export const automationModules = [
    triggerDomainEventModule,
    triggerScheduleModule,
    triggerScheduleMonthlyModule,
    eventDataEqualsConditionModule,
    operationMatchesConditionModule,
    plantStatusEqualsConditionModule,
    queueSeasonalSowingOfferOperationsActionModule,
    queuePostTransplantWateringOperationsActionModule,
    createOperationActionModule,
    createFarmInventoryOperationsActionModule,
    createGreenhouseSeedlingWateringOperationsActionModule,
    updateRaisedBedFieldPlantAttributesActionModule,
    createPlantStatusRequestsFromImageAnalysisActionModule,
    logActionModule,
] as const satisfies readonly AutomationModule[];

const automationModulesByKey = new Map(
    automationModules.map((module) => [module.key, module]),
);

export function getAutomationModule(key: string) {
    return automationModulesByKey.get(key) ?? null;
}

export function getAutomationModuleMetadata(): AutomationModuleMetadata[] {
    return automationModules.map(
        ({ execute: _execute, validateConfig: _validateConfig, ...metadata }) =>
            metadata,
    );
}

export function validateAutomationNodeConfig(node: AutomationGraphNode) {
    const module = getAutomationModule(node.moduleKey);
    if (!module) {
        return [`Unknown automation module: ${node.moduleKey}.`];
    }

    if (module.kind !== node.kind) {
        return [
            `Module ${node.moduleKey} is a ${module.kind}, not a ${node.kind}.`,
        ];
    }

    return module.validateConfig
        ? module.validateConfig(getRecord(node.config))
        : [];
}
