const deliveryRequestIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDeliveryRunRequestBody(value: unknown) {
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
