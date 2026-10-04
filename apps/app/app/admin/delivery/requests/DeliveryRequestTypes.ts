export type DeliveryRequestMode = 'delivery' | 'pickup';

export type DeliveryRequestSlotOption = {
    id: number;
    startAt: Date | string;
    endAt: Date | string;
    type: DeliveryRequestMode | undefined;
};

export type DeliveryRequestActionData = {
    id: string;
    state: string;
    mode: DeliveryRequestMode | undefined;
    operationId: number;
    slot:
        | {
              id: number;
              startAt: Date | string;
              endAt: Date | string;
          }
        | undefined;
};

export function toDeliveryRequestMode(
    mode: string | null | undefined,
): DeliveryRequestMode | undefined {
    return mode === 'delivery' || mode === 'pickup' ? mode : undefined;
}
