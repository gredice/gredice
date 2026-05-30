import { Chip } from '@gredice/ui/Chip';
import type { PayoutStatus } from '@gredice/storage';

const config: Record<
    PayoutStatus,
    { label: string; color: 'neutral' | 'info' | 'success' | 'error' | 'warning' }
> = {
    pending: { label: 'Na čekanju', color: 'warning' },
    approved: { label: 'Odobreno', color: 'info' },
    paid: { label: 'Plaćeno', color: 'success' },
    rejected: { label: 'Odbijeno', color: 'error' },
};

export function PayoutStatusChip({ status }: { status: string }) {
    const cfg = config[status as PayoutStatus] ?? { label: status, color: 'neutral' as const };
    return (
        <Chip color={cfg.color} size="sm" variant="soft">
            {cfg.label}
        </Chip>
    );
}
