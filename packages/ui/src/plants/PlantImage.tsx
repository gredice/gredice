import { Sprout } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import Image, { type ImageProps } from 'next/image';

/**
 * Minimal image shape accepted by PlantOrSortImage.
 */
type ImageLike = {
    cover?: {
        url?: string | null;
    } | null;
} | null;

/**
 * Minimal type for plant data accepted by PlantOrSortImage.
 */
type PlantLike =
    | {
          image?: ImageLike;
          images?: ImageLike;
          information?: {
              name?: string | null;
          } | null;
      }
    | null
    | undefined;

/**
 * Minimal type for plant sort data accepted by PlantOrSortImage.
 */
type PlantSortLike =
    | {
          image?: ImageLike;
          images?: ImageLike;
          information?: {
              name?: string | null;
              plant?: PlantLike;
          } | null;
      }
    | null
    | undefined;

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
              plantSort: PlantSortLike | null;
              plant?: never;
              /**
               * Optional custom alt text. If not provided, uses plantSort.information.name
               */
              alt?: string;
          }
        | {
              /**
               * Direct absolute image URL.
               */
              coverUrl: string | null | undefined;
              plant?: never;
              plantSort?: never;
              /**
               * Alt text is required when using coverUrl directly
               */
              alt: string;
          }
    );

const loggedFallbackWarnings = new Set<string>();

function warnAboutPlantImageFallback(
    reason: 'missing' | 'invalid',
    entityName: string,
) {
    const key = `${reason}:${entityName}`;
    if (loggedFallbackWarnings.has(key)) {
        return;
    }

    loggedFallbackWarnings.add(key);
    console.warn(
        `PlantOrSortImage rendered a fallback because the image URL is ${reason}.`,
        entityName,
    );
}

function toCssDimension(value: number | string | undefined) {
    return typeof value === 'number' ? `${value}px` : value;
}

function PlantImageFallback({
    alt,
    fill,
    width,
    height,
    className,
    style,
}: Pick<
    ImageProps,
    'alt' | 'fill' | 'width' | 'height' | 'className' | 'style'
>) {
    const iconSize =
        typeof width === 'number' && typeof height === 'number'
            ? Math.max(16, Math.min(width, height) * 0.5)
            : 24;

    return (
        <div
            role="img"
            aria-label={alt}
            className={cx(
                'flex items-center justify-center overflow-hidden bg-muted text-muted-foreground',
                fill && 'absolute inset-0 size-full',
                className,
            )}
            style={{
                ...style,
                width: fill ? undefined : toCssDimension(width),
                height: fill ? undefined : toCssDimension(height),
            }}
        >
            <Sprout
                aria-hidden="true"
                style={{
                    width: `${iconSize}px`,
                    height: `${iconSize}px`,
                }}
                className="shrink-0 opacity-70"
            />
        </div>
    );
}

/**
 * A component for rendering plant or plant sort images from absolute URLs.
 * Image data is expected to be complete in the API payload.
 *
 * @example
 * ```tsx
 * // Using with plantSort object
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
 * // Using with direct URL (backward compatibility, no fallback)
 * <PlantOrSortImage
 *   coverUrl={plantSort.image?.cover?.url}
 *   alt={plantSort.information.name}
 *   width={60}
 *   height={60}
 * />
 * ```
 */
export function PlantOrSortImage(props: PlantOrSortImageProps) {
    if ('plant' in props) {
        const { plant, alt, ...imageProps } = props;
        const resolvedAlt = alt ?? plant?.information?.name ?? 'Slika biljke';
        const resolvedCoverUrl =
            plant?.image?.cover?.url ?? plant?.images?.cover?.url;

        if (!resolvedCoverUrl) {
            warnAboutPlantImageFallback('missing', resolvedAlt);
            return <PlantImageFallback alt={resolvedAlt} {...imageProps} />;
        }

        if (!/^https?:\/\//u.test(resolvedCoverUrl)) {
            warnAboutPlantImageFallback('invalid', resolvedAlt);
            return <PlantImageFallback alt={resolvedAlt} {...imageProps} />;
        }

        return (
            <Image src={resolvedCoverUrl} alt={resolvedAlt} {...imageProps} />
        );
    }

    if ('plantSort' in props) {
        const { plantSort, alt, ...imageProps } = props;
        const resolvedAlt =
            alt ?? plantSort?.information?.name ?? 'Slika biljke';
        const resolvedCoverUrl =
            plantSort?.image?.cover?.url ??
            plantSort?.images?.cover?.url ??
            plantSort?.information?.plant?.image?.cover?.url ??
            plantSort?.information?.plant?.images?.cover?.url;

        if (!resolvedCoverUrl) {
            warnAboutPlantImageFallback('missing', resolvedAlt);
            return <PlantImageFallback alt={resolvedAlt} {...imageProps} />;
        }

        if (!/^https?:\/\//u.test(resolvedCoverUrl)) {
            warnAboutPlantImageFallback('invalid', resolvedAlt);
            return <PlantImageFallback alt={resolvedAlt} {...imageProps} />;
        }

        return (
            <Image src={resolvedCoverUrl} alt={resolvedAlt} {...imageProps} />
        );
    }

    const { coverUrl, alt, ...imageProps } = props;

    if (!coverUrl) {
        warnAboutPlantImageFallback('missing', alt);
        return <PlantImageFallback alt={alt} {...imageProps} />;
    }

    if (!/^https?:\/\//u.test(coverUrl)) {
        warnAboutPlantImageFallback('invalid', alt);
        return <PlantImageFallback alt={alt} {...imageProps} />;
    }

    return <Image src={coverUrl} alt={alt} {...imageProps} />;
}
