import type { SeedData } from '@gredice/client';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { ItemCard } from '../../components/shared/ItemCard';
import { formatPrice } from '../../lib/formatPrice';
import { KnownPages } from '../../src/KnownPages';
import { getSeedImageViewTransitionName } from './catalogueViewTransition';
import { SeedImage } from './SeedImage';
import { formatSeedWeight } from './seedPresentation';

export function SeedCard({ seed }: { seed: SeedData }) {
    const price =
        typeof seed.attributes.price === 'number'
            ? formatPrice(seed.attributes.price)
            : null;
    const weight =
        typeof seed.attributes.weight === 'number'
            ? formatSeedWeight(seed.attributes.weight)
            : null;

    return (
        <ItemCard
            label={
                <Stack spacing={2}>
                    <Typography semiBold>{seed.information.name}</Typography>
                    <Typography level="body3" secondary>
                        {seed.information.brand.information.name}
                    </Typography>
                    <Typography level="body3" secondary>
                        {seed.information.plantSort.information.name}
                    </Typography>
                    {weight || price ? (
                        <Row justifyContent="space-between" spacing={2}>
                            {weight ? (
                                <Typography level="body2">{weight}</Typography>
                            ) : (
                                <span />
                            )}
                            {price ? (
                                <Typography level="body2" semiBold>
                                    {price}
                                </Typography>
                            ) : null}
                        </Row>
                    ) : null}
                </Stack>
            }
            href={KnownPages.Seed(seed.slug || seed.information.name)}
            mediaViewTransitionName={getSeedImageViewTransitionName(seed.id)}
        >
            <SeedImage
                seed={seed}
                fill
                sizes="(max-width: 768px) 50vw, (min-width: 768px) 33vw, (min-width: 1200px) 16vw"
            />
        </ItemCard>
    );
}
