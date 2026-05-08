import { getOverallStatusMessage } from '../lib/status/statusDisplay';
import type { ServiceStatusItem, StatusLevel } from '../lib/status/types';
import { StatusBadge } from './StatusBadge';

type OverallStatusProps = {
    services: ServiceStatusItem[];
    status: StatusLevel;
};

export function OverallStatus({ services, status }: OverallStatusProps) {
    const affectedServices = services.filter(
        (service) => service.status !== 'operational',
    ).length;
    const affectedLabel =
        affectedServices === 1
            ? '1 usluga traži pažnju'
            : `${affectedServices} usluga traži pažnju`;

    return (
        <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Trenutni status
                    </p>
                    <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                        {getOverallStatusMessage(status)}
                    </h1>
                </div>
                <div className="flex shrink-0 flex-row items-center gap-4 sm:gap-0 sm:flex-col sm:items-end">
                    <StatusBadge status={status} />
                    <div className="text-sm text-muted-foreground">
                        {affectedLabel}
                    </div>
                </div>
            </div>
        </section>
    );
}
