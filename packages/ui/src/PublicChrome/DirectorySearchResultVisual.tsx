import Image from 'next/image';
import type { ComponentType, SVGProps } from 'react';
import { Bug, FileText, Layers, Leaf, Shield, Sprout } from '../icons';
import { OperationCategoryIcon } from '../OperationImage';
import { PlantingSeedIcon } from '../PlantingSeedIcon';
import { cx } from '../utils';

type DirectorySearchResult = {
    entityType: string;
    imageAlt?: string | null;
    imageUrl?: string | null;
    visualKey?: string | null;
};

type ResultFallbackIconProps = SVGProps<SVGSVGElement>;

const resultFallbackIcons: Record<
    string,
    ComponentType<ResultFallbackIconProps>
> = {
    plant: Leaf,
    plantSort: Sprout,
    plantDisease: Shield,
    plantPest: Bug,
    block: Layers,
    seed: PlantingSeedIcon,
};

function resultFallbackKey(result: DirectorySearchResult) {
    if (result.entityType === 'operation') {
        return result.visualKey ?? 'operation';
    }

    return result.entityType;
}

export function DirectorySearchResultVisual({
    result,
    className,
    iconClassName,
    imageSize = 40,
}: {
    result: DirectorySearchResult;
    className?: string;
    iconClassName?: string;
    imageSize?: number;
}) {
    const fallbackKey = resultFallbackKey(result);
    const Icon = resultFallbackIcons[result.entityType] ?? FileText;

    return (
        <span
            className={cx(
                'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary',
                className,
            )}
        >
            {result.imageUrl ? (
                <Image
                    src={result.imageUrl}
                    alt={result.imageAlt ?? ''}
                    width={imageSize}
                    height={imageSize}
                    className="size-full object-cover"
                />
            ) : (
                <span
                    aria-hidden="true"
                    className="flex size-full items-center justify-center"
                    data-search-result-icon={fallbackKey}
                >
                    {result.entityType === 'operation' ? (
                        <OperationCategoryIcon
                            categoryName={result.visualKey}
                            className={cx('size-5 shrink-0', iconClassName)}
                        />
                    ) : (
                        <Icon
                            className={cx('size-5 shrink-0', iconClassName)}
                        />
                    )}
                </span>
            )}
        </span>
    );
}
