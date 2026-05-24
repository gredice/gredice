import Image from 'next/image';
import type { ComponentType, CSSProperties, SVGProps } from 'react';
import { Droplet, Hammer, Leaf, Sprout, Store, Tally3, Upload } from '../icons';
import { cx } from '../utils';

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

export type OperationCategoryIconProps = SVGProps<SVGSVGElement> & {
    categoryName?: string | null;
};

const categoryIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
    soilpreparation: function SoilPreparationIcon({
        className,
        ...rest
    }: SVGProps<SVGSVGElement>) {
        return <Tally3 {...rest} className={cx('rotate-90 mt-1', className)} />;
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

export function OperationCategoryIcon({
    categoryName,
    ...props
}: OperationCategoryIconProps) {
    const Icon = categoryIcons[normalizeCategoryName(categoryName)] ?? Hammer;
    return <Icon {...props} />;
}

export function OperationImage({
    operation,
    size,
    className,
}: OperationImageProps) {
    const categoryName =
        operation.attributes?.category?.information?.name ??
        operation.attributes?.stage?.information?.name;
    const fallbackSize = size ?? 48;
    const imageSize = size ?? 24;

    if (!operation.image?.cover?.url) {
        return (
            <span
                style={{
                    width: `${fallbackSize}px`,
                    height: `${fallbackSize}px`,
                }}
                className={cx(
                    'aspect-square inline-flex shrink-0 items-center justify-center',
                    className,
                )}
            >
                <OperationCategoryIcon
                    categoryName={categoryName}
                    style={
                        {
                            '--imageSize': size ? `${size / 2}px` : '24px',
                        } as CSSProperties
                    }
                    className="size-[--imageSize] shrink-0"
                />
            </span>
        );
    }

    return (
        <span
            style={{
                width: `${imageSize}px`,
                height: `${imageSize}px`,
            }}
            className={cx(
                'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
                className,
            )}
        >
            <Image
                src={operation.image.cover.url}
                fill
                sizes={`${imageSize}px`}
                style={{ objectFit: 'contain' }}
                alt={operation.information?.label ?? 'Slika radnje'}
            />
        </span>
    );
}
