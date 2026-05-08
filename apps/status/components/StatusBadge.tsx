import {
    getStatusLabel,
    getStatusPillClassName,
} from '../lib/status/statusDisplay';
import type { StatusLevel } from '../lib/status/types';

type StatusBadgeProps = {
    status: StatusLevel;
};

export function StatusBadge({ status }: StatusBadgeProps) {
    return (
        <span
            className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${getStatusPillClassName(status)}`}
        >
            <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-white/85 animate-pulse"
            />
            {getStatusLabel(status)}
        </span>
    );
}
