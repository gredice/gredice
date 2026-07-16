import type { EntityStandardized, OperationStatus } from '@gredice/storage';
import {
    getScheduleOperationCompletionRequirements,
    type ScheduleOperationCompletionRequirements,
} from './schedule/scheduleOperationRequirements';
import {
    compareScheduleDates,
    getOperationDurationMinutes,
    getScheduleTaskAgeIndicator,
    isScheduleDatePast,
    PLANTING_TASK_DURATION_MINUTES,
    type ScheduleTaskAgeIndicator,
} from './schedule/scheduleShared';
import {
    getScheduleOperationTaskAssignment,
    getSchedulePlantingTaskAssignment,
    type ScheduleTaskAssignment,
} from './schedule/scheduleTaskAssignment';
import {
    getOperationTaskState,
    getPlantingTaskState,
    getScheduleTaskSummary,
    type ScheduleTaskState,
} from './schedule/scheduleTaskState';

type DateInput = Date | string | null | undefined;

export type FarmTodaySource<T> =
    | { status: 'ready'; data: T }
    | { status: 'unavailable' };

export type FarmTodayFarmInput = {
    id: number;
    name: string;
};

export type FarmTodayPlantingInput = {
    active?: boolean;
    assignedUserId?: string | null;
    assignedUserIds?: string[];
    id: number;
    plantScheduledDate?: DateInput;
    plantSortId?: number | null;
    plantSowDate?: DateInput;
    plantStatus?: string | null;
    positionIndex: number;
    raisedBedId: number;
    sowingLocation?: 'direct' | 'greenhouse';
};

export type FarmTodayRaisedBedInput = {
    farmId: number | null;
    fields: FarmTodayPlantingInput[];
    id: number;
    physicalId?: string | null;
};

export type FarmTodayOperationInput = {
    assignedUserId?: string | null;
    assignedUserIds?: string[];
    completedAt?: DateInput;
    entityId: number;
    farmId: number | null;
    id: number;
    raisedBedFieldId?: number | null;
    raisedBedId: number | null;
    scheduledDate?: DateInput;
    status: OperationStatus;
};

export type FarmTodayPlantingsSourceData = {
    raisedBeds: FarmTodayRaisedBedInput[];
    scheduledFields: FarmTodayPlantingInput[];
};

export type FarmTodayOperationsSourceData = {
    authorizationScope: 'farmMembership';
    pendingOperations: FarmTodayOperationInput[];
    pendingOperationsComplete: boolean;
    raisedBeds: FarmTodayRaisedBedInput[];
    raisedBedsComplete: boolean;
    scheduledOperations: FarmTodayOperationInput[];
    scheduledOperationsComplete: boolean;
};

export type FarmTodayDataIssue =
    | 'farmsUnavailable'
    | 'plantingsUnavailable'
    | 'operationsUnavailable'
    | 'scheduledOperationsUnavailable'
    | 'pendingOperationsUnavailable'
    | 'plantSortsUnavailable'
    | 'operationDefinitionsUnavailable'
    | 'plantSortMetadataMissing'
    | 'operationDefinitionMissing';

export type FarmTodayTaskAssignment = Exclude<ScheduleTaskAssignment, 'other'>;

export type FarmTodayTaskLocation =
    | {
          kind: 'farm';
          farmId: number;
          label: string;
      }
    | {
          kind: 'raisedBed' | 'greenhouse';
          label: string;
          positionIndex: number | null;
          raisedBedId: number;
      };

type FarmTodayTaskBase = {
    ageIndicator: ScheduleTaskAgeIndicator | null;
    assignment: FarmTodayTaskAssignment;
    durationMinutes: number | null;
    href: string;
    key: string;
    label: string;
    location: FarmTodayTaskLocation;
    occurredAt: string | null;
    overdue: boolean;
    scheduledDate: string | null;
    state: ScheduleTaskState;
};

export type FarmTodayOperationTask = FarmTodayTaskBase & {
    kind: 'operation';
    operationId: number;
    proofRequirements: ScheduleOperationCompletionRequirements;
};

export type FarmTodayPlantingTask = FarmTodayTaskBase & {
    fieldId: number;
    kind: 'planting';
    plantSortId: number;
    proofRequirements: {
        images: 'none';
        notes: 'none';
    };
    raisedBedId: number;
};

export type FarmTodayTask = FarmTodayOperationTask | FarmTodayPlantingTask;

export type FarmTodayAttentionReason =
    | 'canceled'
    | 'failed'
    | 'overdue'
    | 'pendingVerification'
    | 'unassigned';

export type FarmTodayAttentionItem = {
    reasons: FarmTodayAttentionReason[];
    task: FarmTodayTask;
};

export type FarmTodaySummary = {
    assignedToMe: number;
    completed: number;
    countsComplete: boolean;
    overdue: number;
    pendingVerification: number;
    remaining: number;
    remainingDuration: {
        complete: boolean;
        minutes: number;
    };
    unassigned: number;
};

export type FarmTodayWorkState =
    | 'allDone'
    | 'empty'
    | 'hasWork'
    | 'incomplete'
    | 'noAssignedWork';

type FarmTodayAvailableData = {
    attentionItems: FarmTodayAttentionItem[];
    dataIssues: FarmTodayDataIssue[];
    dateKey: string;
    focusQueue: FarmTodayTask[];
    status: 'partial' | 'ready';
    summary: FarmTodaySummary;
    workState: FarmTodayWorkState;
};

export type FarmTodayData =
    | FarmTodayAvailableData
    | {
          dataIssues: [];
          dateKey: string;
          status: 'noFarm';
      }
    | {
          dataIssues: FarmTodayDataIssue[];
          dateKey: string;
          status: 'unavailable';
      };

export type ComposeFarmTodayDataInput = {
    dateKey: string;
    farms: FarmTodaySource<FarmTodayFarmInput[]>;
    operationDefinitions: FarmTodaySource<EntityStandardized[]>;
    operations: FarmTodaySource<FarmTodayOperationsSourceData>;
    plantings: FarmTodaySource<FarmTodayPlantingsSourceData>;
    plantSorts: FarmTodaySource<EntityStandardized[]>;
    referenceDate: Date;
    userId: string;
};

type CandidateBuildResult = {
    authorizedCandidateCount: number;
    tasks: FarmTodayTask[];
};

const dataIssueOrder: FarmTodayDataIssue[] = [
    'farmsUnavailable',
    'plantingsUnavailable',
    'operationsUnavailable',
    'scheduledOperationsUnavailable',
    'pendingOperationsUnavailable',
    'plantSortsUnavailable',
    'operationDefinitionsUnavailable',
    'plantSortMetadataMissing',
    'operationDefinitionMissing',
];

function orderedIssues(issues: Set<FarmTodayDataIssue>) {
    return dataIssueOrder.filter((issue) => issues.has(issue));
}

function toIsoString(value: DateInput) {
    if (!value) {
        return null;
    }

    const parsed = typeof value === 'string' ? new Date(value) : value;
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function getRaisedBedLabel(raisedBed: FarmTodayRaisedBedInput) {
    return raisedBed.physicalId
        ? `Gr ${raisedBed.physicalId}`
        : `Gredica ${raisedBed.id}`;
}

function getRaisedBedLocation({
    greenhouse,
    positionIndex,
    raisedBed,
}: {
    greenhouse: boolean;
    positionIndex: number | null;
    raisedBed: FarmTodayRaisedBedInput;
}): FarmTodayTaskLocation {
    const positionLabel =
        positionIndex === null ? '' : ` · pozicija ${positionIndex + 1}`;
    const raisedBedLabel = `${getRaisedBedLabel(raisedBed)}${positionLabel}`;

    return {
        kind: greenhouse ? 'greenhouse' : 'raisedBed',
        label: greenhouse ? `Staklenik · ${raisedBedLabel}` : raisedBedLabel,
        positionIndex,
        raisedBedId: raisedBed.id,
    };
}

function buildTaskTiming(
    state: ScheduleTaskState,
    scheduledDate: DateInput,
    referenceDate: Date,
) {
    const overdue =
        state === 'actionable' &&
        isScheduleDatePast(scheduledDate, referenceDate);

    return {
        ageIndicator:
            state === 'actionable'
                ? getScheduleTaskAgeIndicator(scheduledDate, referenceDate)
                : null,
        overdue,
        scheduledDate: toIsoString(scheduledDate),
    };
}

function dedupeById<T extends { id: number }>(items: T[]) {
    return [...new Map(items.map((item) => [item.id, item])).values()];
}

function buildPlantingCandidates({
    activeFarmIds,
    issues,
    plantSorts,
    referenceDate,
    source,
    userId,
}: {
    activeFarmIds: Set<number>;
    issues: Set<FarmTodayDataIssue>;
    plantSorts: FarmTodaySource<EntityStandardized[]>;
    referenceDate: Date;
    source: FarmTodayPlantingsSourceData;
    userId: string;
}): CandidateBuildResult {
    const authorizedRaisedBeds = source.raisedBeds.filter(
        (raisedBed) =>
            typeof raisedBed.farmId === 'number' &&
            activeFarmIds.has(raisedBed.farmId),
    );
    const raisedBedById = new Map(
        authorizedRaisedBeds.map((raisedBed) => [raisedBed.id, raisedBed]),
    );
    const pendingFields = authorizedRaisedBeds
        .flatMap((raisedBed) => raisedBed.fields)
        .filter(
            (field) =>
                field.active !== false &&
                field.plantSortId &&
                getPlantingTaskState(field.plantStatus) ===
                    'pendingVerification',
        );
    const fields = dedupeById([...source.scheduledFields, ...pendingFields]);
    const plantSortById =
        plantSorts.status === 'ready'
            ? new Map(
                  plantSorts.data.map((plantSort) => [plantSort.id, plantSort]),
              )
            : new Map<number, EntityStandardized>();
    const tasks: FarmTodayTask[] = [];
    let authorizedCandidateCount = 0;

    for (const field of fields) {
        const raisedBed = raisedBedById.get(field.raisedBedId);
        const state = getPlantingTaskState(field.plantStatus);
        if (!raisedBed || !field.plantSortId || !state) {
            continue;
        }

        authorizedCandidateCount += 1;
        const assignment = getSchedulePlantingTaskAssignment(field, userId);
        if (assignment === 'other') {
            continue;
        }

        const plantSort = plantSortById.get(field.plantSortId);
        if (plantSorts.status === 'ready' && !plantSort) {
            issues.add('plantSortMetadataMissing');
        }
        const plantName = plantSort?.information?.name ?? 'Nepoznata biljka';
        const greenhouse = field.sowingLocation === 'greenhouse';

        tasks.push({
            ...buildTaskTiming(state, field.plantScheduledDate, referenceDate),
            assignment,
            durationMinutes: PLANTING_TASK_DURATION_MINUTES,
            fieldId: field.id,
            href: `/raised-beds/${field.raisedBedId}`,
            key: `planting:${field.id}`,
            kind: 'planting',
            label: `${greenhouse ? 'Sijanje u stakleniku' : 'Sijanje'}: ${plantName}`,
            location: getRaisedBedLocation({
                greenhouse,
                positionIndex: field.positionIndex,
                raisedBed,
            }),
            occurredAt: toIsoString(field.plantSowDate),
            plantSortId: field.plantSortId,
            proofRequirements: {
                images: 'none',
                notes: 'none',
            },
            raisedBedId: field.raisedBedId,
            state,
        });
    }

    return { authorizedCandidateCount, tasks };
}

function isOperationAuthorized(
    operation: FarmTodayOperationInput,
    activeFarmIds: Set<number>,
    authorizedRaisedBedFarmIds: Map<number, number>,
    authorizationScope: FarmTodayOperationsSourceData['authorizationScope'],
    raisedBedsComplete: boolean,
) {
    if (
        typeof operation.farmId === 'number' &&
        !activeFarmIds.has(operation.farmId)
    ) {
        return false;
    }

    if (typeof operation.raisedBedId === 'number') {
        const raisedBedFarmId = authorizedRaisedBedFarmIds.get(
            operation.raisedBedId,
        );
        if (typeof raisedBedFarmId === 'number') {
            return (
                operation.farmId === null ||
                operation.farmId === raisedBedFarmId
            );
        }

        if (raisedBedsComplete) {
            return false;
        }

        return operation.farmId === null
            ? authorizationScope === 'farmMembership'
            : activeFarmIds.has(operation.farmId);
    }

    return (
        typeof operation.farmId === 'number' &&
        activeFarmIds.has(operation.farmId)
    );
}

function buildOperationCandidates({
    activeFarmIds,
    farms,
    issues,
    operationDefinitions,
    referenceDate,
    source,
    userId,
}: {
    activeFarmIds: Set<number>;
    farms: FarmTodayFarmInput[];
    issues: Set<FarmTodayDataIssue>;
    operationDefinitions: FarmTodaySource<EntityStandardized[]>;
    referenceDate: Date;
    source: FarmTodayOperationsSourceData;
    userId: string;
}): CandidateBuildResult {
    const authorizedRaisedBeds = source.raisedBeds.filter(
        (raisedBed) =>
            typeof raisedBed.farmId === 'number' &&
            activeFarmIds.has(raisedBed.farmId),
    );
    const raisedBedById = new Map(
        authorizedRaisedBeds.map((raisedBed) => [raisedBed.id, raisedBed]),
    );
    const authorizedRaisedBedFarmEntries: [number, number][] = [];
    for (const raisedBed of authorizedRaisedBeds) {
        if (typeof raisedBed.farmId === 'number') {
            authorizedRaisedBedFarmEntries.push([
                raisedBed.id,
                raisedBed.farmId,
            ]);
        }
    }
    const authorizedRaisedBedFarmIds = new Map(authorizedRaisedBedFarmEntries);
    const pendingOperations = source.pendingOperations.filter(
        (operation) =>
            getOperationTaskState(operation.status) === 'pendingVerification',
    );
    const operations = dedupeById([
        ...source.scheduledOperations,
        ...pendingOperations,
    ]);
    const farmById = new Map(farms.map((farm) => [farm.id, farm]));
    const operationDefinitionById =
        operationDefinitions.status === 'ready'
            ? new Map(
                  operationDefinitions.data.map((definition) => [
                      definition.id,
                      definition,
                  ]),
              )
            : new Map<number, EntityStandardized>();
    const tasks: FarmTodayTask[] = [];
    let authorizedCandidateCount = 0;

    for (const operation of operations) {
        if (
            !isOperationAuthorized(
                operation,
                activeFarmIds,
                authorizedRaisedBedFarmIds,
                source.authorizationScope,
                source.raisedBedsComplete,
            )
        ) {
            continue;
        }

        authorizedCandidateCount += 1;
        const assignment = getScheduleOperationTaskAssignment(
            operation,
            userId,
        );
        if (assignment === 'other') {
            continue;
        }

        const state = getOperationTaskState(operation.status);
        const operationDefinition = operationDefinitionById.get(
            operation.entityId,
        );
        if (operationDefinitions.status === 'ready' && !operationDefinition) {
            issues.add('operationDefinitionMissing');
        }
        const raisedBed =
            typeof operation.raisedBedId === 'number'
                ? raisedBedById.get(operation.raisedBedId)
                : undefined;
        const raisedBedField = raisedBed?.fields.find(
            (field) => field.id === operation.raisedBedFieldId,
        );
        let location: FarmTodayTaskLocation;
        if (raisedBed) {
            location = getRaisedBedLocation({
                greenhouse: false,
                positionIndex: raisedBedField?.positionIndex ?? null,
                raisedBed,
            });
        } else if (typeof operation.raisedBedId === 'number') {
            location = {
                kind: 'raisedBed',
                label: `Gredica ${operation.raisedBedId}`,
                positionIndex: null,
                raisedBedId: operation.raisedBedId,
            };
        } else {
            if (typeof operation.farmId !== 'number') {
                continue;
            }

            const farm = farmById.get(operation.farmId);
            location = {
                kind: 'farm',
                farmId: operation.farmId,
                label: farm?.name ?? `Farma ${operation.farmId}`,
            };
        }

        tasks.push({
            ...buildTaskTiming(state, operation.scheduledDate, referenceDate),
            assignment,
            durationMinutes: operationDefinition
                ? getOperationDurationMinutes(operationDefinition)
                : null,
            href: `/operations/${operation.entityId}`,
            key: `operation:${operation.id}`,
            kind: 'operation',
            label:
                operationDefinition?.information?.label ??
                operationDefinition?.information?.name ??
                `Radnja #${operation.entityId}`,
            location,
            occurredAt: toIsoString(operation.completedAt),
            operationId: operation.id,
            proofRequirements: getScheduleOperationCompletionRequirements(
                operationDefinition,
                operationDefinitions.status === 'ready',
            ),
            state,
        });
    }

    return { authorizedCandidateCount, tasks };
}

function compareFocusTasks(left: FarmTodayTask, right: FarmTodayTask) {
    const assignmentComparison =
        Number(left.assignment === 'shared') -
        Number(right.assignment === 'shared');
    if (assignmentComparison !== 0) {
        return assignmentComparison;
    }

    const overdueComparison = Number(right.overdue) - Number(left.overdue);
    if (overdueComparison !== 0) {
        return overdueComparison;
    }

    const dateComparison = compareScheduleDates(
        left.scheduledDate,
        right.scheduledDate,
    );
    return dateComparison || left.key.localeCompare(right.key);
}

function getAttentionReasons(task: FarmTodayTask) {
    const reasons: FarmTodayAttentionReason[] = [];

    if (task.state === 'failed') {
        reasons.push('failed');
    } else if (task.state === 'canceled') {
        reasons.push('canceled');
    } else if (task.state === 'pendingVerification') {
        reasons.push('pendingVerification');
    }

    if (task.overdue) {
        reasons.push('overdue');
    }

    if (task.assignment === 'shared' && task.state !== 'completed') {
        reasons.push('unassigned');
    }

    return reasons;
}

function attentionPriority(item: FarmTodayAttentionItem) {
    if (item.reasons.includes('failed')) {
        return 0;
    }
    if (item.reasons.includes('canceled')) {
        return 1;
    }
    if (item.reasons.includes('pendingVerification')) {
        return 2;
    }
    if (item.reasons.includes('overdue')) {
        return 3;
    }
    return 4;
}

function compareAttentionItems(
    left: FarmTodayAttentionItem,
    right: FarmTodayAttentionItem,
) {
    const priorityComparison =
        attentionPriority(left) - attentionPriority(right);
    return priorityComparison || compareFocusTasks(left.task, right.task);
}

function getWorkState(
    tasks: FarmTodayTask[],
    authorizedCandidateCount: number,
    summary: FarmTodaySummary,
): FarmTodayWorkState {
    if (!summary.countsComplete && summary.remaining === 0) {
        return 'incomplete';
    }

    if (tasks.length === 0) {
        return authorizedCandidateCount > 0 ? 'noAssignedWork' : 'empty';
    }

    if (summary.remaining === 0 && summary.pendingVerification === 0) {
        return 'allDone';
    }

    return 'hasWork';
}

function buildSummary(
    tasks: FarmTodayTask[],
    countsComplete: boolean,
): FarmTodaySummary {
    const stateSummary = getScheduleTaskSummary(
        tasks.map((task) => ({
            state: task.state,
            durationMinutes: task.durationMinutes ?? 0,
        })),
    );
    const actionableTasks = tasks.filter((task) => task.state === 'actionable');

    return {
        assignedToMe: actionableTasks.filter(
            (task) => task.assignment === 'mine',
        ).length,
        completed: stateSummary.completed.count,
        countsComplete,
        overdue: actionableTasks.filter((task) => task.overdue).length,
        pendingVerification: stateSummary.pendingVerification.count,
        remaining: stateSummary.actionable.count,
        remainingDuration: {
            complete:
                countsComplete &&
                actionableTasks.every((task) => task.durationMinutes !== null),
            minutes: stateSummary.actionable.durationMinutes,
        },
        unassigned: actionableTasks.filter(
            (task) => task.assignment === 'shared',
        ).length,
    };
}

export function composeFarmTodayData({
    dateKey,
    farms,
    operationDefinitions,
    operations,
    plantings,
    plantSorts,
    referenceDate,
    userId,
}: ComposeFarmTodayDataInput): FarmTodayData {
    if (farms.status === 'unavailable') {
        return {
            dataIssues: ['farmsUnavailable'],
            dateKey,
            status: 'unavailable',
        };
    }

    if (farms.data.length === 0) {
        return {
            dataIssues: [],
            dateKey,
            status: 'noFarm',
        };
    }

    const issues = new Set<FarmTodayDataIssue>();
    if (plantings.status === 'unavailable') {
        issues.add('plantingsUnavailable');
    }
    if (operations.status === 'unavailable') {
        issues.add('operationsUnavailable');
    } else if (
        !operations.data.scheduledOperationsComplete &&
        !operations.data.pendingOperationsComplete
    ) {
        issues.add('operationsUnavailable');
    } else {
        if (!operations.data.scheduledOperationsComplete) {
            issues.add('scheduledOperationsUnavailable');
        }
        if (!operations.data.pendingOperationsComplete) {
            issues.add('pendingOperationsUnavailable');
        }
    }
    if (plantSorts.status === 'unavailable') {
        issues.add('plantSortsUnavailable');
    }
    if (operationDefinitions.status === 'unavailable') {
        issues.add('operationDefinitionsUnavailable');
    }

    const operationsHaveTaskData =
        operations.status === 'ready' &&
        (operations.data.scheduledOperationsComplete ||
            operations.data.pendingOperationsComplete);
    if (plantings.status === 'unavailable' && !operationsHaveTaskData) {
        return {
            dataIssues: orderedIssues(issues),
            dateKey,
            status: 'unavailable',
        };
    }

    const activeFarmIds = new Set(farms.data.map((farm) => farm.id));
    const plantingResult =
        plantings.status === 'ready'
            ? buildPlantingCandidates({
                  activeFarmIds,
                  issues,
                  plantSorts,
                  referenceDate,
                  source: plantings.data,
                  userId,
              })
            : { authorizedCandidateCount: 0, tasks: [] };
    const operationResult =
        operations.status === 'ready'
            ? buildOperationCandidates({
                  activeFarmIds,
                  farms: farms.data,
                  issues,
                  operationDefinitions,
                  referenceDate,
                  source: operations.data,
                  userId,
              })
            : { authorizedCandidateCount: 0, tasks: [] };
    const tasks = [...plantingResult.tasks, ...operationResult.tasks];
    const countsComplete =
        plantings.status === 'ready' &&
        operations.status === 'ready' &&
        operations.data.scheduledOperationsComplete &&
        operations.data.pendingOperationsComplete;
    const summary = buildSummary(tasks, countsComplete);
    const focusQueue = tasks
        .filter((task) => task.state === 'actionable')
        .sort(compareFocusTasks);
    const attentionItems = tasks
        .map((task) => ({ reasons: getAttentionReasons(task), task }))
        .filter((item) => item.reasons.length > 0)
        .sort(compareAttentionItems);
    const dataIssues = orderedIssues(issues);
    const authorizedCandidateCount =
        plantingResult.authorizedCandidateCount +
        operationResult.authorizedCandidateCount;

    return {
        attentionItems,
        dataIssues,
        dateKey,
        focusQueue,
        status: dataIssues.length > 0 ? 'partial' : 'ready',
        summary,
        workState: getWorkState(tasks, authorizedCandidateCount, summary),
    };
}
