'use client';

import { cancelRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { CancelRequestModal } from './CancelRequestModal';

interface CancelRaisedBedFieldModalProps {
    field: {
        raisedBedId: number;
        positionIndex: number;
        expectedPlantCycleEventId: number;
        expectedPlantCycleVersionEventId: number;
        expectedPlantSortId: number;
    };
    fieldLabel: string;
    trigger: React.ReactElement;
    onSubmit?: (formData: FormData) => unknown | Promise<unknown>;
}

export function CancelRaisedBedFieldModal({
    field,
    fieldLabel,
    trigger,
    onSubmit,
}: CancelRaisedBedFieldModalProps) {
    return (
        <CancelRequestModal
            label={fieldLabel}
            trigger={trigger}
            onSubmit={onSubmit ?? cancelRaisedBedFieldAction}
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
            description="Sijanje će biti otkazano i korisnik će biti obaviješten o otkazivanju. Ako je sijanje plaćeno suncokretima, oni će biti refundirani."
            confirmLabel="Otkaži sijanje"
        />
    );
}

export default CancelRaisedBedFieldModal;
