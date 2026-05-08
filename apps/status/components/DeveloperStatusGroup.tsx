import type { ServiceStatusItem, StatusLevel } from '../lib/status/types';
import { ServiceStatusDetails, ServiceStatusTitle } from './ServiceStatusItem';
import { StatusBadge } from './StatusBadge';

type DeveloperStatusGroupProps = {
    services: ServiceStatusItem[];
};

export function DeveloperStatusGroup({ services }: DeveloperStatusGroupProps) {
    if (services.length === 0) {
        return null;
    }

    const status = getGroupStatus(services);
    const serviceLabel =
        services.length === 1 ? '1 servis' : `${services.length} servisa`;

    return (
        <details className="status-card group px-4 py-4">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 marker:hidden">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
                            Razvojni servisi
                        </h2>
                        <StatusBadge status={status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Storybook i API
                    </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-[#2e6f40] group-open:hidden dark:text-[#68ba7f]">
                    {serviceLabel}
                </span>
                <span className="hidden shrink-0 text-sm font-medium text-[#2e6f40] group-open:inline dark:text-[#68ba7f]">
                    Sakrij
                </span>
            </summary>
            <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4">
                {services.map((service) => (
                    <section key={service.id} className="min-w-0">
                        <ServiceStatusTitle service={service} />
                        <div className="mt-3">
                            <ServiceStatusDetails service={service} />
                        </div>
                    </section>
                ))}
            </div>
        </details>
    );
}

function getGroupStatus(services: ServiceStatusItem[]): StatusLevel {
    if (services.some((service) => service.status === 'down')) {
        return 'down';
    }

    if (services.some((service) => service.status === 'degraded')) {
        return 'degraded';
    }

    if (services.some((service) => service.status === 'unknown')) {
        return 'unknown';
    }

    return 'operational';
}
