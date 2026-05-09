export function buildScheduledDeliveryEmailKey(
    accountId: string | null | undefined,
    deliveryInfo: unknown,
): string | null {
    if (!accountId) {
        return null;
    }

    if (typeof deliveryInfo !== 'object' || deliveryInfo === null) {
        return null;
    }

    const mode = Reflect.get(deliveryInfo, 'mode');
    if (mode !== 'delivery') {
        return null;
    }

    const slotId = Reflect.get(deliveryInfo, 'slotId');
    if (typeof slotId !== 'number') {
        return null;
    }

    const addressId = Reflect.get(deliveryInfo, 'addressId');
    const keyParts = [accountId, mode, String(slotId)];

    if (typeof addressId === 'number') {
        keyParts.push(`address:${addressId}`);
    }

    return keyParts.join('|');
}

export async function notifyScheduledDeliveryEmailOnce(params: {
    requestId: string;
    accountId: string | null | undefined;
    deliveryInfo: unknown;
    notifiedKeys?: Set<string>;
    notify: (requestId: string) => Promise<boolean>;
}) {
    const notificationKey = buildScheduledDeliveryEmailKey(
        params.accountId,
        params.deliveryInfo,
    );

    if (!notificationKey) {
        return false;
    }

    if (params.notifiedKeys?.has(notificationKey)) {
        return true;
    }

    const sent = await params.notify(params.requestId);
    if (sent) {
        params.notifiedKeys?.add(notificationKey);
    }

    return sent;
}
