import {
    type EntityPriceHistorySummary,
    getEntityPriceHistory,
} from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import type { ReactNode } from 'react';
import { formatPrice } from '../../lib/formatPrice';
import type { OperationPriceAvailability } from '../../lib/operationPricing';
import { AttributeCard } from './DetailCard';

const changeDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
});

type PriceEntityTypeName = 'plant' | 'plantSort' | 'operation';

function priceAttributeName(entityTypeName: PriceEntityTypeName) {
    return entityTypeName === 'operation' ? 'perOperation' : 'perPlant';
}

async function getPriceHistory({
    entityId,
    entityTypeName,
    currentPrice,
}: {
    entityId: number;
    entityTypeName: PriceEntityTypeName;
    currentPrice: number;
}): Promise<EntityPriceHistorySummary> {
    const key = `${entityTypeName}:${entityId}`;
    const fallback = {
        lowestPrice: currentPrice,
        lastChangedAt: null,
    };

    if (!process.env.POSTGRES_URL) {
        return fallback;
    }

    try {
        const history = await getEntityPriceHistory([
            {
                key,
                entityId,
                entityTypeName,
                attributeCategory: 'prices',
                attributeName: priceAttributeName(entityTypeName),
                currentPrice,
            },
        ]);

        return history[key] ?? fallback;
    } catch (error) {
        console.error('Failed to load detail price history', {
            entityId,
            entityTypeName,
            error,
        });
        return fallback;
    }
}

export async function PriceAttributeCard({
    icon,
    header,
    entityId,
    entityTypeName,
    currentPrice,
    availability,
    description,
    navigateLabel,
    navigateHref,
}: {
    icon: ReactNode;
    header: string;
    entityId: number;
    entityTypeName: PriceEntityTypeName;
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

    const history = await getPriceHistory({
        entityId,
        entityTypeName,
        currentPrice,
    });

    return (
        <AttributeCard
            icon={icon}
            header={header}
            description={description}
            navigateLabel={navigateLabel}
            navigateHref={navigateHref}
            value={
                <span className="block">
                    <span className="block font-semibold">
                        {formatPrice(currentPrice)}
                    </span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Najniža cijena u 30 dana:{' '}
                        <span className="font-medium text-foreground">
                            {formatPrice(history.lowestPrice)}
                        </span>
                    </span>
                    {history.lastChangedAt && (
                        <span className="block text-xs font-normal text-muted-foreground">
                            Zadnja promjena:{' '}
                            <time
                                dateTime={history.lastChangedAt.toISOString()}
                            >
                                {changeDateFormatter.format(
                                    history.lastChangedAt,
                                )}
                            </time>
                        </span>
                    )}
                </span>
            }
        />
    );
}
