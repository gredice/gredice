import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { cancelOperationAction } from '../../(actions)/operationActions';
import { CancelRequestModal } from './CancelRequestModal';

interface CancelOperationModalProps {
    operation: {
        id: number;
        entityId: number;
        scheduledDate?: Date;
        status: string;
    };
    operationLabel: string;
    trigger: React.ReactElement;
}

export function CancelOperationModal({
    operation,
    operationLabel,
    trigger,
}: CancelOperationModalProps) {
    return (
        <CancelRequestModal
            label={operationLabel}
            trigger={trigger}
            onSubmit={cancelOperationAction}
            hiddenFields={
                <input type="hidden" name="operationId" value={operation.id} />
            }
            description={`Operacija će biti otkazana. Koristi opcije ispod za refundiranje suncokreta i slanje obavijesti korisniku.${
                operation.status === 'planned'
                    ? ' Ako je operacija plaćena suncokretima, preporučujemo da ih refundiraš.'
                    : ''
            }`}
            additionalFields={
                <Stack spacing={1}>
                    <input type="hidden" name="shouldRefund" value="false" />
                    <Checkbox
                        className="size-5"
                        name="shouldRefund"
                        value="true"
                        defaultChecked
                        label={
                            <Typography level="body2">
                                Vrati suncokrete za ovu radnju
                            </Typography>
                        }
                    />
                    <input type="hidden" name="shouldNotify" value="false" />
                    <Checkbox
                        className="size-5"
                        name="shouldNotify"
                        value="true"
                        defaultChecked
                        label={
                            <Typography level="body2">
                                Pošalji obavijest korisniku o otkazivanju
                            </Typography>
                        }
                    />
                </Stack>
            }
            confirmLabel="Otkaži operaciju"
        />
    );
}

export default CancelOperationModal;
