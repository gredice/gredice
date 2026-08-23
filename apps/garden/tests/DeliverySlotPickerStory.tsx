import { useState } from 'react';
import {
    DeliverySlotPicker,
    type DeliverySlotPickerProps,
} from '../../../packages/game/src/shared-ui/delivery/DeliverySlotPicker';

type DeliverySlotPickerStoryProps = Pick<
    DeliverySlotPickerProps,
    'autoSelectFirstDeliverySlot' | 'referenceDate' | 'slots'
> & {
    containerClassName?: string;
};

export function DeliverySlotPickerStory({
    autoSelectFirstDeliverySlot,
    containerClassName = 'w-[44rem]',
    referenceDate,
    slots,
}: DeliverySlotPickerStoryProps) {
    const [value, setValue] = useState<number>();

    return (
        <div className={`${containerClassName} p-6`}>
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
