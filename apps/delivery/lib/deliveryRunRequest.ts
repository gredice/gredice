const deliveryRequestIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deliveryRunPreparationTokenPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;

function deliveryRequestIds(value: unknown) {
    if (
        typeof value !== 'object' ||
        value === null ||
        !('deliveryRequestIds' in value) ||
        !Array.isArray(value.deliveryRequestIds) ||
        value.deliveryRequestIds.length === 0
    ) {
        return null;
    }

    const requestIds = value.deliveryRequestIds;
    if (
        !requestIds.every(
            (requestId): requestId is string =>
                typeof requestId === 'string' &&
                deliveryRequestIdPattern.test(requestId),
        )
    ) {
        return null;
    }

    const uniqueRequestIds = Array.from(new Set(requestIds));
    return uniqueRequestIds.length === requestIds.length
        ? uniqueRequestIds
        : null;
}

export function parseDeliveryRunPreflightRequestBody(value: unknown) {
    return deliveryRequestIds(value);
}

export function parseDeliveryRunStartRequestBody(value: unknown) {
    const requestIds = deliveryRequestIds(value);
    if (!requestIds || typeof value !== 'object' || value === null) {
        return null;
    }

    const preparationToken =
        'preparationToken' in value ? value.preparationToken : undefined;
    if (
        preparationToken !== undefined &&
        (typeof preparationToken !== 'string' ||
            !deliveryRunPreparationTokenPattern.test(preparationToken))
    ) {
        return null;
    }

    return {
        deliveryRequestIds: requestIds,
        preparationToken,
    };
}
