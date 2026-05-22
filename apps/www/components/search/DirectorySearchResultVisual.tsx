import type { components } from '@gredice/client';
import { FileText, Layers, Leaf, Sprout } from '@gredice/ui/icons';
import { OperationCategoryIcon } from '@gredice/ui/OperationImage';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import type { ComponentType, SVGProps } from 'react';

type DirectorySearchResult = Pick<
    components['schemas']['directory-search-result'],
    'entityType' | 'imageAlt' | 'imageUrl' | 'visualKey'
>;

type ResultFallbackIconProps = SVGProps<SVGSVGElement>;

const resultFallbackIcons: Record<
    string,
    ComponentType<ResultFallbackIconProps>
> = {
    plant: Leaf,
    plantSort: Sprout,
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
