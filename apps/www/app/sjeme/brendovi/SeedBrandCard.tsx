import type { BrandData } from '@gredice/client';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { ItemCard } from '../../../components/shared/ItemCard';
import { KnownPages } from '../../../src/KnownPages';
import { BrandLogo } from '../BrandLogo';
import { getSeedBrandLogoViewTransitionName } from '../catalogueViewTransition';
import { seedCountLabel } from '../seedPresentation';

export function SeedBrandCard({
    brand,
    seedCount,
}: {
    brand: BrandData;
    seedCount: number;
}) {
    return (
        <ItemCard
            label={
                <Stack spacing={2}>
                    <Typography semiBold>{brand.information.name}</Typography>
                    {brand.information.country ? (
                        <Typography level="body3" secondary>
                            {brand.information.country}
                        </Typography>
                    ) : null}
                    <Typography level="body3" secondary>
                        {seedCountLabel(seedCount)}
                    </Typography>
                </Stack>
            }
            href={KnownPages.SeedBrand(brand.slug || brand.information.name)}
            mediaViewTransitionName={getSeedBrandLogoViewTransitionName(
                brand.id,
            )}
        >
            <BrandLogo
                brand={brand}
                fill
                sizes="(max-width: 768px) 50vw, (min-width: 768px) 33vw, (min-width: 1200px) 16vw"
            />
        </ItemCard>
    );
}
