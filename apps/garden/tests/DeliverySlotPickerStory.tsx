import { useState } from 'react';
import {
    DeliverySlotPicker,
    type DeliverySlotPickerProps,
} from '../../../packages/game/src/shared-ui/delivery/DeliverySlotPicker';

type DeliverySlotPickerStoryProps = Pick<
    DeliverySlotPickerProps,
    'autoSelectFirstDeliverySlot' | 'referenceDate' | 'slots'
>;

export function DeliverySlotPickerStory({
    autoSelectFirstDeliverySlot,
    referenceDate,
    slots,
}: DeliverySlotPickerStoryProps) {
    const [value, setValue] = useState<number>();

    return (
        <div className="w-[44rem] p-6">
            <DeliverySlotPicker
                autoFocus={false}
                autoSelectFirstDeliverySlot={autoSelectFirstDeliverySlot}
                referenceDate={referenceDate}
                slots={slots}
                value={value}
                onValueChange={setValue}
            />
            <output data-testid="selected-delivery-slot">{value ?? ''}</output>
        </div>
    );
}
