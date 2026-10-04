export type DeliveryRequestProgressStatus =
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'fulfilled';

export function getNextDeliveryRequestStatus(
    state: string,
): DeliveryRequestProgressStatus | undefined {
    switch (state) {
        case 'pending':
            return 'confirmed';
        case 'confirmed':
            return 'preparing';
        case 'preparing':
            return 'ready';
        case 'ready':
            return 'fulfilled';
        default:
            return undefined;
    }
}
