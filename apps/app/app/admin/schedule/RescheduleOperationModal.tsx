import { rescheduleOperationAction } from '../../(actions)/operationActions';
import { RescheduleModal } from './RescheduleModal';

interface RescheduleOperationModalProps {
    operation: {
        id: number;
        entityId: number;
        scheduledDate?: Date;
    };
    operationLabel: string;
    trigger: React.ReactElement;
    onSubmit?: (formData: FormData) => unknown | Promise<unknown>;
}

export function RescheduleOperationModal({
    operation,
    operationLabel,
    trigger,
    onSubmit,
}: RescheduleOperationModalProps) {
    return (
        <RescheduleModal
            label={operationLabel}
            scheduledDate={operation.scheduledDate}
            trigger={trigger}
            onSubmit={onSubmit ?? rescheduleOperationAction}
            hiddenFields={
                <input type="hidden" name="operationId" value={operation.id} />
            }
        />
    );
}

export default RescheduleOperationModal;
