import { Chip } from '@gredice/ui/Chip';
import { Check, Warning } from '@gredice/ui/icons';

/** Connection state of an integration, shown beside its card title. */
export function SettingsStatusChip({
    connected,
    label,
}: {
    connected: boolean;
    label: string;
}) {
    return (
        <Chip
            color={connected ? 'success' : 'warning'}
            variant="soft"
            startDecorator={connected ? <Check /> : <Warning />}
        >
            {label}
        </Chip>
    );
}
