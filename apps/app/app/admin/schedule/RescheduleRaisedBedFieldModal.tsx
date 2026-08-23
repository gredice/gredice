'use client';

import { rescheduleRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { RescheduleModal } from './RescheduleModal';

interface RescheduleRaisedBedFieldModalProps {
    field: {
        raisedBedId: number;
        positionIndex: number;
        expectedPlantCycleEventId: number;
        expectedPlantCycleVersionEventId: number;
        expectedPlantSortId: number;
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
                    <input
                        type="hidden"
                        name="expectedPlantCycleEventId"
                        value={field.expectedPlantCycleEventId}
                    />
                    <input
                        type="hidden"
                        name="expectedPlantCycleVersionEventId"
                        value={field.expectedPlantCycleVersionEventId}
                    />
                    <input
                        type="hidden"
                        name="expectedPlantSortId"
                        value={field.expectedPlantSortId}
                    />
                </>
            }
        />
    );
}

export default RescheduleRaisedBedFieldModal;
