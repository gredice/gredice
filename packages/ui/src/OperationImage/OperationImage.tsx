import Image from 'next/image';
import type { ComponentType, CSSProperties, SVGProps } from 'react';
import {
    GameBasketIcon,
    GameBlossomIcon,
    GameHarvestIcon,
    GameLeafIcon,
    GameRaisedBedSimpleIcon,
    GameSeedlingIcon,
    GameShovelIcon,
    GameToolsIcon,
    GameWaterIcon,
} from '../GameIcons';
import { Droplet, Hammer, Leaf, Sprout, Store, Tally3, Upload } from '../icons';
import { ShovelIcon } from '../ShovelIcon';
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
    variant?: 'default' | 'game';
};

export type OperationCategoryIconProps = SVGProps<SVGSVGElement> & {
    categoryName?: string | null;
    variant?: 'default' | 'game';
};

const categoryIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
    soilpreparation: function SoilPreparationIcon({
        className,
        ...rest
    }: SVGProps<SVGSVGElement>) {
        return <Tally3 {...rest} className={cx('rotate-90 mt-1', className)} />;
    },
    sowing: Sprout,
    planting: ShovelIcon,
    growth: Leaf,
    maintenance: Leaf,
    watering: Droplet,
    flowering: Leaf,
    harvest: Upload,
    storage: Store,
};

const gameCategoryIcons: Record<
    string,
    ComponentType<SVGProps<SVGSVGElement>>
> = {
    soilpreparation: GameRaisedBedSimpleIcon,
    sowing: GameSeedlingIcon,
    planting: GameShovelIcon,
    growth: GameLeafIcon,
    maintenance: GameToolsIcon,
    watering: GameWaterIcon,
    flowering: GameBlossomIcon,
    harvest: GameHarvestIcon,
    storage: GameBasketIcon,
};

function normalizeCategoryName(name: string | null | undefined) {
    return name?.toLowerCase().replace(/[\s_-]/g, '') ?? '';
}

export function OperationCategoryIcon({
    categoryName,
    variant = 'default',
    ...props
}: OperationCategoryIconProps) {
    const icons = variant === 'game' ? gameCategoryIcons : categoryIcons;
    const Icon =
        icons[normalizeCategoryName(categoryName)] ??
        (variant === 'game' ? GameToolsIcon : Hammer);
    return <Icon {...props} />;
}

export function OperationImage({
    operation,
    size,
    className,
    variant = 'default',
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
                    variant={variant}
                    style={
                        {
                            '--imageSize': size ? `${size / 2}px` : '24px',
                        } as CSSProperties
                    }
                    className={cx(
                        'shrink-0',
                        variant === 'game'
                            ? 'size-full p-2'
                            : 'size-[--imageSize]',
                    )}
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
