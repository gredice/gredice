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
            description={`Operacija će biti otkazana i korisnik će biti obaviješten o otkazivanju.${
                operation.status === 'planned'
                    ? ' Ako je operacija plaćena suncokretima, oni će biti refundirani.'
                    : ''
            }`}
            confirmLabel="Otkaži operaciju"
        />
    );
}

export default CancelOperationModal;
