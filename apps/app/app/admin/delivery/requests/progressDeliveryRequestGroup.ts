import { getNextDeliveryRequestStatus } from './DeliveryRequestStatusFlow';

type ProgressDeliveryRequestGroupDependencies = {
    getRequest: (requestId: string) => Promise<{ state: string } | undefined>;
    applyStatus: (input: {
        requestId: string;
        status: string;
        actorUserId: string;
    }) => Promise<void>;
    notifyGroup: (requestIds: string[]) => Promise<void>;
};

async function notifyProgressedRequests(
    requestIds: string[],
    notifyGroup: ProgressDeliveryRequestGroupDependencies['notifyGroup'],
) {
    if (requestIds.length > 0) {
        await notifyGroup(requestIds);
    }
}

export async function progressDeliveryRequestGroup({
    requestIds,
    actorUserId,
    dependencies,
}: {
    requestIds: string[];
    actorUserId: string;
    dependencies: ProgressDeliveryRequestGroupDependencies;
}) {
    const progressedRequestIds: string[] = [];

    try {
        for (const requestId of new Set(requestIds)) {
            const request = await dependencies.getRequest(requestId);
            if (!request) {
                continue;
            }

            const nextStatus = getNextDeliveryRequestStatus(request.state);
            if (!nextStatus) {
                continue;
            }

            await dependencies.applyStatus({
                requestId,
                status: nextStatus,
                actorUserId,
            });
            progressedRequestIds.push(requestId);
        }
    } catch (error) {
        await notifyProgressedRequests(
            progressedRequestIds,
            dependencies.notifyGroup,
        );
        throw error;
    }

    await notifyProgressedRequests(
        progressedRequestIds,
        dependencies.notifyGroup,
    );
    return progressedRequestIds;
}
