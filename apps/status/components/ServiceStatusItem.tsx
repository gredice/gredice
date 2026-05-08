import { formatDuration, formatTimestamp } from '../lib/status/statusFormat';
import type { ServiceStatusItem as ServiceStatusItemData } from '../lib/status/types';
import { ServiceHistory } from './ServiceHistory';
import { StatusBadge } from './StatusBadge';

type ServiceStatusItemProps = {
    service: ServiceStatusItemData;
};

export function ServiceStatusItem({ service }: ServiceStatusItemProps) {
    return (
        <article className="status-card px-4 py-4">
            <div className="flex h-full flex-col gap-5">
                <div className="min-w-0">
                    <ServiceStatusTitle service={service} />
                </div>
                <ServiceStatusDetails service={service} />
            </div>
        </article>
    );
}

type ServiceStatusSubcomponentProps = {
    service: ServiceStatusItemData;
};

export function ServiceStatusTitle({
    service,
}: ServiceStatusSubcomponentProps) {
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">
                    {service.name}
                </h2>
                <StatusBadge status={service.status} />
            </div>
            {service.url && (
                <a
                    className="block truncate text-xs hover:underline text-muted-foreground"
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {service.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
            )}
        </>
    );
}

export function ServiceStatusDetails({
    service,
}: ServiceStatusSubcomponentProps) {
    return (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
                <dt className="text-muted-foreground">Zadnja provjera</dt>
                <dd className="font-medium text-foreground">
                    {formatTimestamp(service.updatedAt)}
                </dd>
            </div>
            <div>
                <dt className="text-muted-foreground">Odziv</dt>
                <dd className="font-medium text-foreground">
                    {formatDuration(
                        service.shortestRun ??
                            service.longestRun ??
                            service.history[0]?.responseTime ??
                            null,
                    )}
                </dd>
            </div>
            <div className="sm:col-span-2">
                <dt className="mb-2 text-muted-foreground">Povijest</dt>
                <dd>
                    <ServiceHistory history={service.history} />
                </dd>
            </div>
        </dl>
    );
}
