import { Checkbox } from '@gredice/ui/Checkbox';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
    onSubmit?: (formData: FormData) => unknown | Promise<unknown>;
}

export function CancelOperationModal({
    operation,
    operationLabel,
    trigger,
    onSubmit,
}: CancelOperationModalProps) {
    return (
        <CancelRequestModal
            label={operationLabel}
            trigger={trigger}
            onSubmit={onSubmit ?? cancelOperationAction}
            hiddenFields={
                <input type="hidden" name="operationId" value={operation.id} />
            }
            description={`Operacija će biti otkazana. Koristi opcije ispod za povrat suncokreta i slanje obavijesti korisniku.${
                operation.status === 'planned'
                    ? ' Ako je operacija plaćena suncokretima, preporučujemo da ih vratiš.'
                    : ''
            }`}
            additionalFields={
                <Stack spacing={2}>
                    <input type="hidden" name="shouldRefund" value="false" />
                    <Checkbox
                        className="size-5"
                        name="shouldRefund"
                        value="true"
                        defaultChecked
                        label={
                            <Typography level="body2">
                                Vrati suncokrete
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
                                Pošalji obavijest korisniku
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
