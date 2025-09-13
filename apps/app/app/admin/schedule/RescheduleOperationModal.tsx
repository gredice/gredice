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
}

export function RescheduleOperationModal({
    operation,
    operationLabel,
    trigger,
}: RescheduleOperationModalProps) {
    return (
        <RescheduleModal
            label={operationLabel}
            scheduledDate={operation.scheduledDate}
            trigger={trigger}
            onSubmit={rescheduleOperationAction}
            hiddenFields={
                <input type="hidden" name="operationId" value={operation.id} />
            }
        />
    );
}

export default RescheduleOperationModal;
