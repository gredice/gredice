'use client';

import { cancelRaisedBedFieldAction } from '../../(actions)/raisedBedFieldsActions';
import { CancelRequestModal } from './CancelRequestModal';

interface CancelRaisedBedFieldModalProps {
    field: {
        raisedBedId: number;
        positionIndex: number;
    };
    fieldLabel: string;
    trigger: React.ReactElement;
}

export function CancelRaisedBedFieldModal({
    field,
    fieldLabel,
    trigger,
}: CancelRaisedBedFieldModalProps) {
    return (
        <CancelRequestModal
            label={fieldLabel}
            trigger={trigger}
            onSubmit={cancelRaisedBedFieldAction}
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
            description="Sijanje će biti otkazano i korisnik će biti obaviješten o otkazivanju. Ako je sijanje plaćeno suncokretima, oni će biti refundirani."
            confirmLabel="Otkaži sijanje"
        />
    );
}

export default CancelRaisedBedFieldModal;
