import { Chip } from '@gredice/ui/Chip';
import type { ReactNode } from 'react';
import { formatPrice } from '../../lib/formatPrice';
import type { OperationPriceAvailability } from '../../lib/operationPricing';
import { AttributeCard } from './DetailCard';

export function PriceAttributeCard({
    icon,
    header,
    currentPrice,
    availability,
    description,
    navigateLabel,
    navigateHref,
}: {
    icon: ReactNode;
    header: string;
    currentPrice: number;
    availability?: OperationPriceAvailability;
    description?: string;
    navigateLabel?: string;
    navigateHref?: string;
}) {
    const resolvedAvailability =
        availability ?? (currentPrice > 0 ? 'available' : 'unavailable');

    if (resolvedAvailability !== 'available') {
        return (
            <AttributeCard
                icon={icon}
                header={header}
                description={description}
                navigateLabel={navigateLabel}
                navigateHref={navigateHref}
                value={
                    resolvedAvailability === 'internal' ? (
                        <span className="block">
                            <Chip color="warning" size="sm" variant="soft">
                                Interna radnja
                            </Chip>
                            <span className="mt-1 block font-semibold">
                                Bez naplate
                            </span>
                        </span>
                    ) : (
                        <Chip color="neutral" size="sm" variant="outlined">
                            Nije dostupno
                        </Chip>
                    )
                }
            />
        );
    }

    return (
        <AttributeCard
            icon={icon}
            header={header}
            description={description}
            navigateLabel={navigateLabel}
            navigateHref={navigateHref}
            value={
                <span className="block font-semibold">
                    {formatPrice(currentPrice)}
                </span>
            }
        />
    );
}
