import {
    Droplet,
    Hammer,
    Leaf,
    Sprout,
    Store,
    Tally3,
    Upload,
} from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import Image from 'next/image';

export type OperationImageProps = {
    operation: {
        image?: {
            cover?: {
                url?: string | null;
            } | null;
        } | null;
        information?: {
            label?: string | null;
        } | null;
        attributes?: {
            category?: {
                information?: {
                    name?: string | null;
                } | null;
            } | null;
            stage?: {
                information?: {
                    name?: string | null;
                } | null;
            } | null;
        } | null;
    };
    size?: number;
    className?: string;
};

type OperationCategoryIconProps = {
    className?: string;
    style?: React.CSSProperties;
};

const categoryIcons: Record<string, React.ComponentType<OperationCategoryIconProps>> = {
    soilpreparation: function SoilPreparationIcon({
        className,
        style,
    }: {
        className?: string;
        style?: React.CSSProperties;
    }) {
        return (
            <Tally3 style={style} className={cx('rotate-90 mt-1', className)} />
        );
    },
    sowing: Sprout,
    planting: Sprout,
    growth: Leaf,
    maintenance: Leaf,
    watering: Droplet,
    flowering: Leaf,
    harvest: Upload,
    storage: Store,
};

function normalizeCategoryName(name: string | null | undefined) {
    return name?.toLowerCase().replace(/[\s_-]/g, '') ?? '';
}

export function OperationImage({
    operation,
    size,
    className,
}: OperationImageProps) {
    const categoryName =
        operation.attributes?.category?.information?.name ??
        operation.attributes?.stage?.information?.name;
    const Icon = categoryIcons[normalizeCategoryName(categoryName)] ?? Hammer;

    if (!operation.image?.cover?.url) {
        return (
            <div
                style={{
                    width: size ? `${size}px` : '48px',
                    height: size ? `${size}px` : '48px',
                }}
                className={cx(
                    'aspect-square flex items-center justify-center',
                    className,
                )}
            >
                <Icon
                    style={
                        {
                            '--imageSize': size ? `${size / 2}px` : '24px',
                        } as React.CSSProperties
                    }
                    className="size-[--imageSize] shrink-0"
                />
            </div>
        );
    }

    return (
        <Image
            src={operation.image.cover.url}
            width={size ?? 24}
            height={size ?? 24}
            style={{
                objectFit: 'contain',
                width: `${size ?? 24}px`,
                height: `${size ?? 24}px`,
            }}
            alt={operation.information?.label ?? 'Slika radnje'}
            className={className}
        />
    );
}
