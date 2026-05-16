'use client';

import { rescheduleRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { RescheduleModal } from './RescheduleModal';

interface RescheduleRaisedBedFieldModalProps {
    field: {
        raisedBedId: number;
        positionIndex: number;
        plantScheduledDate?: Date;
    };
    fieldLabel: string;
    trigger: React.ReactElement;
    onSubmit?: (formData: FormData) => unknown | Promise<unknown>;
}

export function RescheduleRaisedBedFieldModal({
    field,
    fieldLabel,
    trigger,
    onSubmit,
}: RescheduleRaisedBedFieldModalProps) {
    return (
        <RescheduleModal
            label={fieldLabel}
            scheduledDate={field.plantScheduledDate}
            trigger={trigger}
            onSubmit={onSubmit ?? rescheduleRaisedBedFieldAction}
            hiddenFields={
                <>
                    <input
                        type="hidden"
                        name="raisedBedId"
                        value={field.raisedBedId}
                    />
                    <input
                        type="hidden"
                        name="positionIndex"
                        value={field.positionIndex}
                    />
                </>
            }
        />
    );
}

export default RescheduleRaisedBedFieldModal;
