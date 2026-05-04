import type { ServiceStatusItem as ServiceStatusItemData } from '../lib/status/types';
import { DeveloperStatusGroup } from './DeveloperStatusGroup';
import { ServiceStatusItem } from './ServiceStatusItem';

type ServiceStatusListProps = {
    services: ServiceStatusItemData[];
};

export function ServiceStatusList({ services }: ServiceStatusListProps) {
    const developerServices = services.filter(isDeveloperService);
    const publicServices = services.filter(
        (service) => !isDeveloperService(service),
    );

    return (
        <section
            className="grid gap-3 lg:grid-cols-2"
            aria-label="Status servisa"
        >
            {publicServices.map((service) => (
                <ServiceStatusItem key={service.id} service={service} />
            ))}
            <DeveloperStatusGroup services={developerServices} />
        </section>
    );
}

function isDeveloperService(service: ServiceStatusItemData) {
    return service.id === 'storybook' || service.id === 'api';
}
