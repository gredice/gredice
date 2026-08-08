import type { BrandData, SeedData } from '@gredice/client';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText.ts';

const numberFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 2,
});

type SeedSearchData = {
    information: {
        name: string;
        barcode?: string | null;
        countryOfOrigin?: string;
        brand: { information: { name: string; country?: string } };
        plant: { information: { name: string; latinName: string } };
        plantSort: { information: { name: string; latinName?: string } };
    };
};

export function seedMatchesSearch(seed: SeedSearchData, search: string) {
    const normalizedSearch = normalizeSearchText(search);
    if (!normalizedSearch) {
        return true;
    }

    return [
        seed.information.name,
        seed.information.barcode,
        seed.information.brand.information.name,
        seed.information.brand.information.country,
        seed.information.plant.information.name,
        seed.information.plant.information.latinName,
        seed.information.plantSort.information.name,
        seed.information.plantSort.information.latinName,
        seed.information.countryOfOrigin,
    ].some(
        (value) =>
            value && normalizeSearchText(value).includes(normalizedSearch),
    );
}

export function seedCountLabel(count: number) {
    return `${numberFormatter.format(count)} ${count === 1 ? 'pakiranje' : 'pakiranja'} sjemena`;
}

export function formatSeedWeight(weight: number) {
    return `${numberFormatter.format(weight)} g`;
}

export function formatSeedArea(area: number) {
    return `${numberFormatter.format(area)} m²`;
}

export function seedPageDescription(seed: SeedData) {
    return `${seed.information.name}: sjeme sorte ${seed.information.plantSort.information.name}, biljke ${seed.information.plant.information.name}, brenda ${seed.information.brand.information.name}. Podaci o pakiranju i sjetvi.`;
}

export function brandPageDescription(brand: BrandData, seedCount: number) {
    const country = brand.information.country
        ? ` iz zemlje ${brand.information.country}`
        : '';
    return `Osnovne informacije o brendu sjemena ${brand.information.name}${country} i pregled ${seedCountLabel(seedCount)} u Gredice katalogu.`;
}

export function seedPrimaryImageUrl(seed: SeedData) {
    return (
        seed.images?.cover?.url ??
        seed.information.plantSort.image?.cover?.url ??
        seed.information.plant.image?.cover?.url
    );
}

export function seedPackageImages(seed: SeedData) {
    return [
        seed.images?.cover?.url
            ? {
                  src: seed.images.cover.url,
                  alt: `${seed.information.name} – prednja strana pakiranja`,
              }
            : null,
        seed.images?.back?.url
            ? {
                  src: seed.images.back.url,
                  alt: `${seed.information.name} – stražnja strana pakiranja`,
              }
            : null,
    ].filter((image) => image !== null);
}

export function seedGtin13(seed: { information: { barcode?: string | null } }) {
    if (typeof seed.information.barcode !== 'string') {
        return null;
    }

    const barcode = seed.information.barcode.replace(/\D/g, '');
    return barcode.length === 13 ? barcode : null;
}

export function safeWebsiteUrl(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:'
            ? url.toString()
            : null;
    } catch {
        return null;
    }
}
