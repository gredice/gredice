import 'server-only';
import { asc, inArray } from 'drizzle-orm';
import { v4 as uuidV4 } from 'uuid';
import { events } from '../schema';
import { storage } from '../storage';
import type {
    ApprovalRequestCreatePayload,
    ApprovalRequestReviewPayload,
    ApprovalRequestTarget,
    PlantStatusApprovalTarget,
} from './events/types';
import { createEvent, knownEvents, knownEventTypes } from './eventsRepo';
import { getRaisedBedFieldsWithEvents } from './raisedBedFieldsRepo';
import {
    acquireScheduleTaskAdvisoryLock,
    type ScheduleTaskTransaction,
    withPlantingScheduleTaskTransaction,
} from './scheduleTaskTransactionsRepo';

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected';

export type ApprovalRequest = {
    id: string;
    status: ApprovalRequestStatus;
    target: ApprovalRequestTarget;
    requestedBy: string;
    requestedAt: Date;
    createdAt: Date;
    note?: string | null;
    reviewedBy?: string;
    reviewedAt?: Date;
    reviewNote?: string | null;
};

type ApprovalRequestsFilter = {
    status?: ApprovalRequestStatus;
    kind?: ApprovalRequestTarget['kind'];
};

type CreatePlantStatusApprovalRequestInput = {
    raisedBedId: number;
    positionIndex: number;
    plantCycleEventId: number;
    plantCycleVersionEventId: number;
    requestedStatus: string;
    requestedBy: string;
    raisedBedFieldId?: number | null;
    accountId?: string | null;
    gardenId?: number | null;
    plantSortId?: number | null;
    currentStatus?: string | null;
    effectiveAt?: Date;
    note?: string | null;
};

type StorageClient = ReturnType<typeof storage>;
type DatabaseClient = StorageClient | ScheduleTaskTransaction;

type ApprovePlantStatusApprovalRequestDependencies = {
    appendApprovalEvent: typeof createEvent;
};

const defaultApprovePlantStatusApprovalRequestDependencies: ApprovePlantStatusApprovalRequestDependencies =
    {
        appendApprovalEvent: createEvent,
    };

const approvalRequestEventTypes = [
    knownEventTypes.approvalRequests.create,
    knownEventTypes.approvalRequests.approve,
    knownEventTypes.approvalRequests.reject,
];

const plantingTaskEvidenceStatuses = new Set([
    'blocked',
    'pendingVerification',
    'sowed',
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'notSprouted',
    'died',
    'ready',
    'harvested',
    'removed',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown) {
    return typeof value === 'string' ? value : null;
}

function optionalNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseDate(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePlantStatusTarget(
    value: unknown,
): PlantStatusApprovalTarget | null {
    if (!isRecord(value) || value.kind !== 'raisedBedField.plantStatus') {
        return null;
    }

    const raisedBedId = optionalNumber(value.raisedBedId);
    const positionIndex = optionalNumber(value.positionIndex);
    const requestedStatus = optionalString(value.requestedStatus);
    if (
        raisedBedId === null ||
        positionIndex === null ||
        requestedStatus === null
    ) {
        return null;
    }

    return {
        kind: 'raisedBedField.plantStatus',
        raisedBedId,
        positionIndex,
        plantCycleEventId: optionalNumber(value.plantCycleEventId),
        plantCycleVersionEventId: optionalNumber(
            value.plantCycleVersionEventId,
        ),
        raisedBedFieldId: optionalNumber(value.raisedBedFieldId),
        accountId: optionalString(value.accountId),
        gardenId: optionalNumber(value.gardenId),
        plantSortId: optionalNumber(value.plantSortId),
        currentStatus: optionalString(value.currentStatus),
        requestedStatus,
        effectiveAt: optionalString(value.effectiveAt),
    };
}

function parseCreatePayload(
    data: unknown,
): ApprovalRequestCreatePayload | null {
    if (!isRecord(data)) {
        return null;
    }

    const target = parsePlantStatusTarget(data.target);
    const requestedBy = optionalString(data.requestedBy);
    const requestedAt = optionalString(data.requestedAt);
    if (!target || !requestedBy || !requestedAt) {
        return null;
    }

    return {
        target,
        requestedBy,
        requestedAt,
        note: optionalString(data.note),
    };
}

function parseReviewPayload(
    data: unknown,
): ApprovalRequestReviewPayload | null {
    if (!isRecord(data)) {
        return null;
    }

    const reviewedBy = optionalString(data.reviewedBy);
    const reviewedAt = optionalString(data.reviewedAt);
    if (!reviewedBy || !reviewedAt) {
        return null;
    }

    return {
        reviewedBy,
        reviewedAt,
        note: optionalString(data.note),
    };
}

function isSamePlantStatusTarget(
    left: PlantStatusApprovalTarget,
    right: Pick<PlantStatusApprovalTarget, 'raisedBedId' | 'positionIndex'>,
) {
    return (
        left.raisedBedId === right.raisedBedId &&
        left.positionIndex === right.positionIndex
    );
}

function canApplyPlantStatusApproval(
    currentStatus: string,
    requestedStatus: string,
) {
    if (currentStatus === requestedStatus) {
        return true;
    }
    if (
        requestedStatus === 'blocked' ||
        requestedStatus === 'pendingVerification'
    ) {
        return false;
    }
    if (
        plantingTaskEvidenceStatuses.has(currentStatus) &&
        (requestedStatus === 'new' || requestedStatus === 'planned')
    ) {
        return false;
    }
    return currentStatus !== 'blocked';
}

function isPositiveSafeInteger(value: number | null | undefined) {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}

async function acquireApprovalRequestReviewLock(
    transaction: ScheduleTaskTransaction,
    requestId: string,
) {
    await acquireScheduleTaskAdvisoryLock(
        transaction,
        `approval-request:${requestId}`,
    );
}

type ReviewApprovalRequestInput = {
    requestId: string;
    reviewedBy: string;
    status: Exclude<ApprovalRequestStatus, 'pending'>;
    note?: string | null;
};

async function appendApprovalReview(
    input: ReviewApprovalRequestInput,
    transaction: ScheduleTaskTransaction,
    dependencies: ApprovePlantStatusApprovalRequestDependencies = defaultApprovePlantStatusApprovalRequestDependencies,
) {
    const request = await getApprovalRequest(input.requestId, transaction);
    if (!request) {
        throw new Error('Zahtjev za odobrenje nije pronađen.');
    }
    if (request.status !== 'pending') {
        return request;
    }

    const reviewPayload = {
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date().toISOString(),
        note: input.note,
    };
    await dependencies.appendApprovalEvent(
        input.status === 'approved'
            ? knownEvents.approvalRequests.approvedV1(
                  input.requestId,
                  reviewPayload,
              )
            : knownEvents.approvalRequests.rejectedV1(
                  input.requestId,
                  reviewPayload,
              ),
        transaction,
    );

    const reviewedRequest = await getApprovalRequest(
        input.requestId,
        transaction,
    );
    if (!reviewedRequest) {
        throw new Error('Pregledani zahtjev nije pronađen.');
    }
    return reviewedRequest;
}

async function reviewApprovalRequest(
    input: ReviewApprovalRequestInput,
    transaction?: ScheduleTaskTransaction,
) {
    const run = async (tx: ScheduleTaskTransaction) => {
        await acquireApprovalRequestReviewLock(tx, input.requestId);
        return appendApprovalReview(input, tx);
    };

    return transaction
        ? run(transaction)
        : storage().transaction(async (tx) => run(tx));
}

export async function getApprovalRequests(
    filter?: ApprovalRequestsFilter,
    db: DatabaseClient = storage(),
) {
    const approvalEvents = await db.query.events.findMany({
        where: inArray(events.type, approvalRequestEventTypes),
        orderBy: [asc(events.createdAt), asc(events.id)],
    });

    const requestsById = new Map<string, ApprovalRequest>();

    for (const event of approvalEvents) {
        if (event.type === knownEventTypes.approvalRequests.create) {
            const payload = parseCreatePayload(event.data);
            const requestedAt = parseDate(payload?.requestedAt);
            if (!payload || !requestedAt) {
                continue;
            }

            requestsById.set(event.aggregateId, {
                id: event.aggregateId,
                status: 'pending',
                target: payload.target,
                requestedBy: payload.requestedBy,
                requestedAt,
                createdAt: event.createdAt,
                note: payload.note,
            });
            continue;
        }

        const request = requestsById.get(event.aggregateId);
        if (request?.status !== 'pending') {
            continue;
        }

        const payload = parseReviewPayload(event.data);
        const reviewedAt = parseDate(payload?.reviewedAt);
        if (!payload || !reviewedAt) {
            continue;
        }

        requestsById.set(event.aggregateId, {
            ...request,
            status:
                event.type === knownEventTypes.approvalRequests.approve
                    ? 'approved'
                    : 'rejected',
            reviewedBy: payload.reviewedBy,
            reviewedAt,
            reviewNote: payload.note,
        });
    }

    return [...requestsById.values()]
        .filter((request) =>
            filter?.status ? request.status === filter.status : true,
        )
        .filter((request) =>
            filter?.kind ? request.target.kind === filter.kind : true,
        )
        .sort(
            (left, right) =>
                right.requestedAt.getTime() - left.requestedAt.getTime(),
        );
}

export async function approvePlantStatusApprovalRequest(
    input: {
        requestId: string;
        reviewedBy: string;
        note?: string | null;
    },
    dependencies: ApprovePlantStatusApprovalRequestDependencies = defaultApprovePlantStatusApprovalRequestDependencies,
) {
    const initialRequest = await getApprovalRequest(input.requestId);
    if (!initialRequest) {
        throw new Error('Zahtjev za odobrenje nije pronađen.');
    }
    if (initialRequest.status === 'approved') {
        return initialRequest;
    }
    if (initialRequest.status === 'rejected') {
        throw new Error('Zahtjev za odobrenje već je odbijen.');
    }

    const initialTarget = initialRequest.target;
    return withPlantingScheduleTaskTransaction(
        initialTarget.raisedBedId,
        initialTarget.positionIndex,
        async (transaction) => {
            await acquireApprovalRequestReviewLock(
                transaction,
                input.requestId,
            );
            const request = await getApprovalRequest(
                input.requestId,
                transaction,
            );
            if (!request) {
                throw new Error('Zahtjev za odobrenje nije pronađen.');
            }
            if (request.status === 'approved') {
                return request;
            }
            if (request.status === 'rejected') {
                throw new Error('Zahtjev za odobrenje već je odbijen.');
            }

            const target = request.target;
            const field = (
                await getRaisedBedFieldsWithEvents(
                    target.raisedBedId,
                    transaction,
                )
            ).find(
                (candidate) =>
                    candidate.positionIndex === target.positionIndex &&
                    candidate.active,
            );
            const activePlantCycle = field?.plantCycles.find(
                (plantCycle) => plantCycle.active,
            );
            if (
                !field ||
                !activePlantCycle ||
                !isPositiveSafeInteger(target.raisedBedFieldId) ||
                !isPositiveSafeInteger(target.plantSortId) ||
                !isPositiveSafeInteger(target.plantCycleEventId) ||
                !isPositiveSafeInteger(target.plantCycleVersionEventId) ||
                field.id !== target.raisedBedFieldId ||
                field.plantSortId !== target.plantSortId ||
                activePlantCycle.plantPlaceEventId !==
                    target.plantCycleEventId ||
                activePlantCycle.endedEventId !==
                    target.plantCycleVersionEventId ||
                field.plantStatus !== target.currentStatus
            ) {
                throw new Error(
                    'Biljka se promijenila nakon slanja zahtjeva. Osvježi podatke i pregledaj novi zahtjev.',
                );
            }
            if (
                !target.currentStatus ||
                !canApplyPlantStatusApproval(
                    target.currentStatus,
                    target.requestedStatus,
                )
            ) {
                throw new Error(
                    'Tražena promjena stanja biljke više nije dopuštena.',
                );
            }

            await createEvent(
                knownEvents.raisedBedFields.plantUpdateV1(
                    `${target.raisedBedId.toString()}|${target.positionIndex.toString()}`,
                    {
                        status: target.requestedStatus,
                        ...(target.effectiveAt
                            ? { effectiveDate: target.effectiveAt }
                            : {}),
                    },
                ),
                transaction,
            );

            return appendApprovalReview(
                {
                    note: input.note,
                    requestId: input.requestId,
                    reviewedBy: input.reviewedBy,
                    status: 'approved',
                },
                transaction,
                dependencies,
            );
        },
    );
}

export async function getApprovalRequest(
    requestId: string,
    db: DatabaseClient = storage(),
) {
    const requests = await getApprovalRequests(undefined, db);
    return requests.find((request) => request.id === requestId) ?? null;
}

export async function getPendingApprovalRequestsCount() {
    const pendingRequests = await getApprovalRequests({ status: 'pending' });
    return pendingRequests.length;
}

export async function createPlantStatusApprovalRequest(
    input: CreatePlantStatusApprovalRequestInput,
) {
    const pendingPlantStatusRequests = await getApprovalRequests({
        status: 'pending',
        kind: 'raisedBedField.plantStatus',
    });
    const existingPendingRequest = pendingPlantStatusRequests.find(
        (request) =>
            request.target.kind === 'raisedBedField.plantStatus' &&
            isSamePlantStatusTarget(request.target, input),
    );

    if (existingPendingRequest) {
        if (
            existingPendingRequest.target.kind ===
                'raisedBedField.plantStatus' &&
            existingPendingRequest.target.requestedStatus ===
                input.requestedStatus
        ) {
            return existingPendingRequest;
        }

        throw new Error('Već postoji zahtjev za promjenu stanja ove biljke.');
    }

    const requestId = uuidV4();
    const requestedAt = new Date();
    await createEvent(
        knownEvents.approvalRequests.createdV1(requestId, {
            requestedBy: input.requestedBy,
            requestedAt: requestedAt.toISOString(),
            note: input.note,
            target: {
                kind: 'raisedBedField.plantStatus',
                raisedBedId: input.raisedBedId,
                positionIndex: input.positionIndex,
                plantCycleEventId: input.plantCycleEventId,
                plantCycleVersionEventId: input.plantCycleVersionEventId,
                raisedBedFieldId: input.raisedBedFieldId,
                accountId: input.accountId,
                gardenId: input.gardenId,
                plantSortId: input.plantSortId,
                currentStatus: input.currentStatus,
                requestedStatus: input.requestedStatus,
                effectiveAt: input.effectiveAt?.toISOString() ?? null,
            },
        }),
    );

    const createdRequest = await getApprovalRequest(requestId);
    if (!createdRequest) {
        throw new Error('Zahtjev za odobrenje nije pronađen nakon spremanja.');
    }

    return createdRequest;
}

export async function approveApprovalRequest(
    requestId: string,
    reviewedBy: string,
    note?: string | null,
    transaction?: ScheduleTaskTransaction,
) {
    return reviewApprovalRequest(
        { note, requestId, reviewedBy, status: 'approved' },
        transaction,
    );
}

export async function rejectApprovalRequest(
    requestId: string,
    reviewedBy: string,
    note?: string | null,
    transaction?: ScheduleTaskTransaction,
) {
    return reviewApprovalRequest(
        { note, requestId, reviewedBy, status: 'rejected' },
        transaction,
    );
}
