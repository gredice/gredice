import { Check } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { acceptOperationAction } from '../../(actions)/operationActions';
import { AcceptRequestModal } from './AcceptRequestModal';

interface AcceptOperationModalProps {
    operationId: number;
    label: string;
}

export function AcceptOperationModal({
    operationId,
    label,
}: AcceptOperationModalProps) {
    const handleConfirm = async () => {
        try {
            await acceptOperationAction(operationId);
        } catch (error) {
            console.error('Error accepting operation:', error);
        }
    };

    return (
        <AcceptRequestModal
            label={label}
            onConfirm={handleConfirm}
            trigger={
                <IconButton variant="plain" title="Potvrdi operaciju">
                    <Check className="size-4 shrink-0" />
                </IconButton>
            }
            title="Potvrda operacije"
            header="Potvrda operacije"
        />
    );
}

export default AcceptOperationModal;
