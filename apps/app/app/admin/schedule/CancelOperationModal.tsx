import { Checkbox } from '@gredice/ui/Checkbox';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cancelOperationAction } from '../../(actions)/operationActions';
import { CancelRequestModal } from './CancelRequestModal';

interface CancelOperationModalProps {
    operation: {
        id: number;
        entityId: number;
        taskVersionEventId: number;
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
    const hasCompletionState =
        operation.status === 'completed' ||
        operation.status === 'pendingVerification';

    return (
        <CancelRequestModal
            label={operationLabel}
            trigger={trigger}
            onSubmit={onSubmit ?? cancelOperationAction}
            hiddenFields={
                <>
                    <input
                        type="hidden"
                        name="operationId"
                        value={operation.id}
                    />
                    <input
                        type="hidden"
                        name="expectedEntityId"
                        value={operation.entityId}
                    />
                    <input
                        type="hidden"
                        name="expectedTaskVersionEventId"
                        value={operation.taskVersionEventId}
                    />
                </>
            }
            description={`Operacija će biti otkazana. Koristi opcije ispod za povrat suncokreta te slanje obavijesti korisniku i farmi u Slacku.${
                operation.status === 'planned'
                    ? ' Ako je operacija plaćena suncokretima, preporučujemo da ih vratiš.'
                    : ''
            }${
                hasCompletionState
                    ? ' Radnja ima zapis završetka; otkazivanje će postaviti najnoviji status na otkazano, ali neće obrisati povijest završetka.'
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
                                Pošalji korisniku i farmi (Slack)
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
