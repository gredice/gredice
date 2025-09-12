'use client';

import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Check } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Typography } from '@signalco/ui-primitives/Typography';

interface AcceptRequestModalProps {
    label: string;
    onConfirm: () => Promise<void>;
    trigger?: React.ReactElement;
    title?: string;
    header?: string;
}

export function AcceptRequestModal({
    label,
    onConfirm,
    trigger,
    title = 'Potvrda zadatka',
    header = 'Potvrda zadatka',
}: AcceptRequestModalProps) {
    return (
        <ModalConfirm
            title={title}
            header={header}
            onConfirm={onConfirm}
            trigger={
                trigger ?? (
                    <IconButton variant="plain" title="Potvrdi">
                        <Check className="size-4 shrink-0" />
                    </IconButton>
                )
            }
        >
            <Typography>
                Jeste li sigurni da želite potvrditi zadatak:{' '}
                <strong>{label}</strong>?
            </Typography>
        </ModalConfirm>
    );
}

export default AcceptRequestModal;
