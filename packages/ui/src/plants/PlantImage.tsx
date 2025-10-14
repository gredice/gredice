import type { PlantData, PlantSortData } from '@gredice/client';
import { isAbsoluteUrl } from '@signalco/js';
import Image, { type ImageProps } from 'next/image';

/**
 * Minimal type for plant data - compatible with PlantData from @gredice/client
 */
type PlantLike = Pick<PlantData, 'image' | 'information'>;

/**
 * Minimal type for plant sort data - compatible with PlantSortData from @gredice/client
 */
type PlantSortLike = Pick<PlantSortData, 'image' | 'information'>;

type PlantOrSortImageProps = Omit<ImageProps, 'src' | 'alt'> &
    (
        | {
              /**
               * Plant data object containing image and information.
               */
              plant: PlantLike;
              plantSort?: never;
              /**
               * Optional custom alt text. If not provided, uses plant.information.name
               */
              alt?: string;
          }
        | {
              /**
               * Plant sort data object containing image and information.
               * Will fall back to plant image if sort image is not available.
               */
              plantSort: PlantSortLike;
              plant?: never;
              /**
               * Optional custom alt text. If not provided, uses plantSort.information.name
               */
              alt?: string;
          }
        | {
              /**
               * Direct cover URL (for backward compatibility)
               */
              coverUrl: string | null | undefined;
              plant?: never;
              plantSort?: never;
              /**
               * Alt text is required when using coverUrl directly
               */
              alt: string;
          }
    ) & {
        /**
         * Base URL to prepend to relative paths. Defaults to 'https://www.gredice.com'
         */
        baseUrl?: string;
        /**
         * Fallback image URL to use when no image is available.
         * Defaults to '/assets/plants/placeholder.png'
         */
        fallbackUrl?: string;
    };

/**
 * A component for rendering plant or plant sort images with automatic URL resolution.
 * Handles both absolute URLs and relative paths, with fallback to placeholder.
 * Automatically resolves cover URLs from plant or plantSort objects.
 *
 * @example
 * ```tsx
 * // Using with plantSort object (preferred - will fall back to plant image)
 * <PlantOrSortImage
 *   plantSort={plantSort}
 *   width={60}
 *   height={60}
 * />
 *
 * // Using with plant object
 * <PlantOrSortImage
 *   plant={plant}
 *   width={60}
 *   height={60}
 * />
 *
 * // Using with direct URL (backward compatibility)
 * <PlantOrSortImage
 *   coverUrl={plantSort.image?.cover?.url}
 *   alt={plantSort.information.name}
 *   width={60}
 *   height={60}
 * />
 * ```
 */
export function PlantOrSortImage(props: PlantOrSortImageProps) {
    const {
        baseUrl = 'https://www.gredice.com',
        fallbackUrl = '/assets/plants/placeholder.png',
        ...rest
    } = props;

    // Extract the specific props based on the discriminated union
    const plant = 'plant' in props ? props.plant : undefined;
    const plantSort = 'plantSort' in props ? props.plantSort : undefined;
    const coverUrl = 'coverUrl' in props ? props.coverUrl : undefined;
    const alt = 'alt' in props ? props.alt : undefined;

    // Resolve cover URL from plantSort (with fallback to plant) or plant object
    const resolvedCoverUrl =
        coverUrl ??
        plantSort?.image?.cover?.url ??
        plantSort?.information?.plant?.image?.cover?.url ??
        plant?.image?.cover?.url;

    // Resolve alt text
    const resolvedAlt =
        alt ??
        plantSort?.information?.name ??
        plant?.information?.name ??
        'Slika biljke';

    // Use the resolved or fallback URL
    const effectiveCoverUrl = resolvedCoverUrl ?? fallbackUrl;

    // Resolve to absolute URL
    const resolvedUrl = isAbsoluteUrl(effectiveCoverUrl)
        ? effectiveCoverUrl
        : `${baseUrl}/${effectiveCoverUrl.replace(/^\//, '')}`;

    // Prepare remaining image props
    // Exclude plant, plantSort, coverUrl, alt, baseUrl, fallbackUrl from being passed to Image
    const {
        plant: _,
        plantSort: __,
        coverUrl: ___,
        alt: ____,
        baseUrl: _____,
        fallbackUrl: ______,
        ...imageProps
        // biome-ignore lint/suspicious/noExplicitAny: Destructuring discriminated union requires type assertion
    } = props as any;

    return <Image src={resolvedUrl} alt={resolvedAlt} {...imageProps} />;
}
