import type { SeedData } from '@gredice/client';
import { Sprout } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import { seedPrimaryImageUrl } from './seedPresentation';

export function SeedImage({
    seed,
    fill = false,
    preload = false,
    sizes,
    width = 192,
    height = 192,
    className,
}: {
    seed: SeedData;
    fill?: boolean;
    preload?: boolean;
    sizes?: string;
    width?: number;
    height?: number;
    className?: string;
}) {
    const src = seedPrimaryImageUrl(seed);
    const hasPackageImage = Boolean(seed.images?.cover?.url);
    const alt = hasPackageImage
        ? `Pakiranje sjemena ${seed.information.name}`
        : `Sorta ${seed.information.plantSort.information.name} povezana sa sjemenom ${seed.information.name}`;

    if (!src) {
        return (
            <div
                aria-label={`Slika za ${seed.information.name} nije dostupna`}
                className={cx(
                    'flex size-full items-center justify-center bg-muted text-muted-foreground',
                    className,
                )}
                role="img"
            >
                <Sprout aria-hidden className="size-16" />
            </div>
        );
    }

    if (fill) {
        return (
            <Image
                src={src}
                alt={alt}
                fill
                preload={preload}
                sizes={sizes}
                className={cx('object-contain p-3', className)}
            />
        );
    }

    return (
        <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            preload={preload}
            className={cx('size-full object-contain p-3', className)}
        />
    );
}
