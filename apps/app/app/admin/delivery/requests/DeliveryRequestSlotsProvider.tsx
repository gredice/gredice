'use client';

import { createContext, type PropsWithChildren, useContext } from 'react';
import type { DeliveryRequestSlotOption } from './DeliveryRequestTypes';

const DeliveryRequestSlotsContext = createContext<DeliveryRequestSlotOption[]>(
    [],
);

export function DeliveryRequestSlotsProvider({
    children,
    slots,
}: PropsWithChildren<{ slots: DeliveryRequestSlotOption[] }>) {
    return (
        <DeliveryRequestSlotsContext.Provider value={slots}>
            {children}
        </DeliveryRequestSlotsContext.Provider>
    );
}

export function useDeliveryRequestSlots() {
    return useContext(DeliveryRequestSlotsContext);
}
