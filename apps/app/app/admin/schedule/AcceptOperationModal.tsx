import { IconButton } from '@gredice/ui/IconButton';
import { Check } from '@gredice/ui/icons';
import { acceptOperationAction } from '../../(actions)/operationActions';
import { AcceptRequestModal } from './AcceptRequestModal';

interface AcceptOperationModalProps {
    operationId: number;
    label: string;
    disabled?: boolean;
    onConfirm?: () => unknown | Promise<unknown>;
}

export function AcceptOperationModal({
    operationId,
    label,
    disabled = false,
    onConfirm,
}: AcceptOperationModalProps) {
    const handleConfirm = async () => {
        if (onConfirm) {
            await onConfirm();
            return;
        }

        await acceptOperationAction(operationId);
    };

    return (
        <AcceptRequestModal
            label={label}
            onConfirm={handleConfirm}
            trigger={
                <IconButton
                    variant="plain"
                    title="Potvrdi operaciju"
                    disabled={disabled}
                >
                    <Check className="size-4 shrink-0" />
                </IconButton>
            }
            title="Potvrda radnje"
            header="Potvrda radnje"
        />
    );
}

export default AcceptOperationModal;
