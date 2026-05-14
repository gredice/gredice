import type { EmailStatus } from '@gredice/storage';
import { Chip } from '@signalco/ui-primitives/Chip';

function getStatusMetadata(status: EmailStatus) {
    switch (status) {
        case 'queued':
            return { label: 'Na čekanju', color: 'neutral' as const };
        case 'sending':
            return { label: 'U slanju', color: 'info' as const };
        case 'sent':
            return { label: 'Poslano', color: 'success' as const };
        case 'failed':
            return { label: 'Neuspješno', color: 'error' as const };
        case 'bounced':
            return { label: 'Odbijeno', color: 'warning' as const };
        default:
            return { label: status, color: 'neutral' as const };
    }
}

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
    const { label, color } = getStatusMetadata(status);

    return (
        <Chip color={color} className="w-fit">
            {label}
        </Chip>
    );
}
