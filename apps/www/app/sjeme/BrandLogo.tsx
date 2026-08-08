import { Store } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';

type BrandWithLogo = {
    information: {
        name: string;
        logo?: {
            url: string;
        };
    };
};

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toLocaleUpperCase('hr-HR'))
        .join('');
}

export function BrandLogo({
    brand,
    fill = false,
    preload = false,
    sizes,
    width = 192,
    height = 192,
    className,
}: {
    brand: BrandWithLogo;
    fill?: boolean;
    preload?: boolean;
    sizes?: string;
    width?: number;
    height?: number;
    className?: string;
}) {
    const src = brand.information.logo?.url;
    const alt = `Logo brenda ${brand.information.name}`;

    if (!src) {
        return (
            <div
                aria-label={`Logo brenda ${brand.information.name} nije dostupan`}
                className={cx(
                    'flex size-full flex-col items-center justify-center gap-2 bg-muted px-3 text-center text-muted-foreground',
                    className,
                )}
                role="img"
            >
                <Store aria-hidden className="size-10" />
                <span className="text-xl font-semibold">
                    {initials(brand.information.name)}
                </span>
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
                className={cx('object-contain p-4', className)}
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
            className={cx('size-full object-contain p-4', className)}
        />
    );
}
