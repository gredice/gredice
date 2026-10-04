import type {
    AutomationDefinitionStatus,
    AutomationRunStatus,
} from '@gredice/storage';
import { Check, History } from '@gredice/ui/icons';
import type { FilterOption } from '../../../components/shared/filters';
import { automationRunStatusMeta, automationStatusMeta } from './presentation';

export function automationDefinitionStatusFilterOption(
    statuses: AutomationDefinitionStatus[],
): FilterOption {
    return {
        key: 'status',
        label: 'Status definicije',
        activeLabel: null,
        icon: <Check className="size-4" />,
        options: [
            { value: 'enabled', label: 'Uključene' },
            { value: 'all', label: 'Svi statusi' },
            ...statuses
                .filter((status) => status !== 'enabled')
                .map((status) => ({
                    value: status,
                    label: automationStatusMeta(status).label,
                })),
        ],
    };
}

export function automationRunStatusFilterOption(
    statuses: AutomationRunStatus[],
): FilterOption {
    return {
        key: 'runStatus',
        label: 'Status izvođenja',
        activeLabel: null,
        icon: <History className="size-4" />,
        options: [
            { value: 'withoutSkipped', label: 'Bez preskočenih' },
            { value: 'all', label: 'Svi statusi' },
            ...statuses.map((status) => ({
                value: status,
                label: automationRunStatusMeta(status).label,
            })),
        ],
    };
}
