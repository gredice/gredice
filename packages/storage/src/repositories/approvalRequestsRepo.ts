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

const approvalRequestEventTypes = [
    knownEventTypes.approvalRequests.create,
    knownEventTypes.approvalRequests.approve,
    knownEventTypes.approvalRequests.reject,
];

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

export async function getApprovalRequests(filter?: ApprovalRequestsFilter) {
    const approvalEvents = await storage().query.events.findMany({
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

export async function getApprovalRequest(requestId: string) {
    const requests = await getApprovalRequests();
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
) {
    const request = await getApprovalRequest(requestId);
    if (!request) {
        throw new Error('Zahtjev za odobrenje nije pronađen.');
    }

    if (request.status !== 'pending') {
        return request;
    }

    await createEvent(
        knownEvents.approvalRequests.approvedV1(requestId, {
            reviewedBy,
            reviewedAt: new Date().toISOString(),
            note,
        }),
    );

    const approvedRequest = await getApprovalRequest(requestId);
    if (!approvedRequest) {
        throw new Error('Odobreni zahtjev nije pronađen.');
    }

    return approvedRequest;
}

export async function rejectApprovalRequest(
    requestId: string,
    reviewedBy: string,
    note?: string | null,
) {
    const request = await getApprovalRequest(requestId);
    if (!request) {
        throw new Error('Zahtjev za odobrenje nije pronađen.');
    }

    if (request.status !== 'pending') {
        return request;
    }

    await createEvent(
        knownEvents.approvalRequests.rejectedV1(requestId, {
            reviewedBy,
            reviewedAt: new Date().toISOString(),
            note,
        }),
    );

    const rejectedRequest = await getApprovalRequest(requestId);
    if (!rejectedRequest) {
        throw new Error('Odbijeni zahtjev nije pronađen.');
    }

    return rejectedRequest;
}
