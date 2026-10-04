import type { BrandData, SeedData } from '@gredice/client';
import { orderBy } from '@gredice/js/arrays';
import { Gallery } from '@gredice/ui/Gallery';
import { SeedBrandCard } from './SeedBrandCard';

function SeedBrandGalleryItem({
    brand,
    seedCount,
}: {
    id: string;
    brand: BrandData;
    seedCount: number;
}) {
    return <SeedBrandCard brand={brand} seedCount={seedCount} />;
}

export function SeedBrandsGallery({
    brands,
    seeds,
}: {
    brands: BrandData[];
    seeds: SeedData[];
}) {
    const items = orderBy(brands, (left, right) =>
        left.information.name.localeCompare(right.information.name, 'hr-HR'),
    ).map((brand) => ({
        id: brand.id.toString(),
        brand,
        seedCount: seeds.filter(
            (seed) => seed.information.brand.id === brand.id,
        ).length,
    }));

    return (
        <Gallery
            gridHeader=""
            items={items}
            itemComponent={SeedBrandGalleryItem}
        />
    );
}
